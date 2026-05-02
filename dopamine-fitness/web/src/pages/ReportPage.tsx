import { lazy, Suspense, useEffect, useState } from "react";
import { useBodyMetrics, useAddBodyMetric } from "../features/auth/useAuth";
import { useWorkouts } from "../features/workouts/useWorkouts";
import {
  StatsPeriod,
  useProgress,
  useStatsSummary,
  useExerciseProgress,
  ExerciseProgressPoint,
  StatsPoint,
} from "../features/progress/useProgress";
import { useExercises } from "../features/exercises/useExercises";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";

const ProgressChart = lazy(() =>
  import("../components/charts/ProgressChart").then((m) => ({ default: m.ProgressChart }))
);

type WorkoutMetric = "volume" | "max_weight" | "total_reps" | "workout_count";
type ExerciseMetric = "volume" | "max_weight" | "total_reps" | "one_rm_estimate";
type Metric = WorkoutMetric | ExerciseMetric;
type ChartPoint = { date: string; value: number };

const WORKOUT_METRICS: WorkoutMetric[] = ["max_weight", "total_reps", "workout_count", "volume"];
const EXERCISE_METRICS: ExerciseMetric[] = ["max_weight", "total_reps", "volume", "one_rm_estimate"];

const METRIC_LABELS: Record<Metric, string> = {
  max_weight: "Лучший вес (кг)",
  total_reps: "Повторения",
  workout_count: "Тренировок",
  volume: "Тоннаж (кг×повт)",
  one_rm_estimate: "1ПМ (оценка)",
};

const METRIC_HINTS: Record<Metric, string> = {
  max_weight: "Показывает лучший рабочий вес за каждый день выбранного периода.",
  total_reps: "Показывает суммарное число повторений за день.",
  workout_count: "Показывает, сколько тренировок было в день.",
  volume: "Показывает тоннаж: вес × повторы. Полезно как доп. метрика нагрузки.",
  one_rm_estimate: "Оценка разового максимума (1ПМ) по рабочим подходам.",
};

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  week: "7 дней",
  month: "30 дней",
  "3months": "3 мес.",
  year: "12 мес.",
};

function mapWorkoutPoints(points: StatsPoint[], metric: WorkoutMetric): ChartPoint[] {
  return points.map((p) => ({ date: p.date, value: p[metric] ?? 0 }));
}

function mapExercisePoints(
  points: ExerciseProgressPoint[],
  metric: "weight" | "volume" | "one_rm_estimate" | "reps"
): ChartPoint[] {
  return points.map((p) => ({ date: p.date, value: (p[metric] as number | null) ?? 0 }));
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="rep-stat-card">
      <div className="rep-stat-value" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="rep-stat-label">{label}</div>
      {sub && <div className="rep-stat-sub">{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="rep-section-title">{children}</div>;
}

export function ReportPage() {
  const { data: metrics = [] } = useBodyMetrics();
  const addMetric = useAddBodyMetric();
  const [newWeight, setNewWeight] = useState("");
  const [newHeight, setNewHeight] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const { data: workoutsData } = useWorkouts();
  const workouts = workoutsData?.workouts ?? [];
  const completed = workouts
    .filter((w) => w.completed_at)
    .sort((a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime());
  const all = [...workouts].sort(
    (a, b) => new Date(b.workout_date).getTime() - new Date(a.workout_date).getTime()
  );

  const { data: summary, isLoading: summaryLoading } = useStatsSummary();
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [metric, setMetric] = useState<Metric>("max_weight");
  const [showExtraCharts, setShowExtraCharts] = useState(false);
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [exSearch, setExSearch] = useState("");

  const { data: workoutData, isLoading: workoutLoading } = useProgress(period);
  const { data: exerciseData, isLoading: exLoading } = useExerciseProgress(exerciseId, period);
  const { data: exercisesData } = useExercises({ search: exSearch, page: 1, limit: 20 });
  const availableMetrics: Metric[] = exerciseId !== null ? EXERCISE_METRICS : WORKOUT_METRICS;

  useEffect(() => {
    if (!availableMetrics.includes(metric)) {
      setMetric("max_weight");
    }
  }, [metric, availableMetrics]);

  const isChartLoading = workoutLoading || (exerciseId !== null && exLoading);
  const chartPoints: ChartPoint[] =
    exerciseId !== null
      ? mapExercisePoints(
          exerciseData?.points ?? [],
          metric === "max_weight"
            ? "weight"
            : metric === "volume"
              ? "volume"
              : metric === "total_reps"
                ? "reps"
                : "one_rm_estimate"
        )
      : mapWorkoutPoints(workoutData?.points ?? [], metric as WorkoutMetric);
  const metricHint = METRIC_HINTS[metric];

  const lastWeight = metrics.find((m) => m.weight_kg)?.weight_kg;
  const lastHeight = metrics.find((m) => m.height_cm)?.height_cm;
  const bmi = lastWeight && lastHeight ? (lastWeight / (lastHeight / 100) ** 2).toFixed(1) : null;
  const bmiLabel = bmi
    ? parseFloat(bmi) < 18.5 ? "Дефицит" : parseFloat(bmi) < 25 ? "Норма ✓" : parseFloat(bmi) < 30 ? "Избыток" : "Ожирение"
    : undefined;
  const bmiAccent = bmi
    ? parseFloat(bmi) < 18.5 ? "#f59e0b" : parseFloat(bmi) < 25 ? "#84cc16" : parseFloat(bmi) < 30 ? "#f59e0b" : "#ef4444"
    : undefined;

  const weightData = [...metrics]
    .reverse()
    .filter((m) => m.weight_kg)
    .slice(-20)
    .map((m) => ({
      date: new Date(m.measured_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      кг: m.weight_kg,
    }));

  const weeklyMap: Record<string, number> = {};
  completed.forEach((w) => {
    const d = new Date(w.completed_at!);
    const yr = d.getFullYear();
    const wk = Math.ceil((d.getDate() + new Date(yr, d.getMonth(), 1).getDay()) / 7);
    const key = `${yr}-${String(d.getMonth() + 1).padStart(2, "0")}-W${wk}`;
    weeklyMap[key] = (weeklyMap[key] ?? 0) + 1;
  });
  const weeklyData = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([key, count]) => ({ week: key.slice(5), count }));

  const totalDuration = completed.reduce((a, w) => a + (w.duration_minutes ?? 0), 0);
  const avgDuration = completed.length > 0 ? Math.round(totalDuration / completed.length) : 0;

  const handleAddMetric = async () => {
    if (!newWeight && !newHeight) return;
    await addMetric.mutateAsync({
      weight_kg: newWeight ? parseFloat(newWeight) : undefined,
      height_cm: newHeight ? parseFloat(newHeight) : undefined,
    });
    setNewWeight(""); setNewHeight(""); setAddOpen(false);
  };

  const tooltipStyle = {
    contentStyle: {
      background: "#1a1a2e",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 10,
      color: "#e0e0e0",
      fontSize: 12,
    },
  };

  return (
    <div className="stack">
      <div className="rep-header">
        <h2 className="rep-title">📊 Отчёт</h2>
        <p className="rep-sub">Твои результаты, прогресс и история</p>
      </div>

      <SectionTitle>📈 Общая статистика</SectionTitle>
      <div className="rep-stats-grid">
        {summaryLoading ? (
          <p className="text-muted">Загрузка...</p>
        ) : (
          <>
            <StatCard label="Тренировок всего" value={summary?.total_workouts ?? 0} />
            <StatCard label="Завершено" value={completed.length} accent="#84cc16" />
            <StatCard label="Подходов" value={summary?.total_sets ?? 0} />
            <StatCard label="Рекорд, кг" value={summary?.max_weight ?? 0} accent="#84cc16" />
            <StatCard label="Активных дней" value={summary?.active_days ?? 0} />
            <StatCard label="Ср. время" value={avgDuration ? `${avgDuration} мин` : "—"} />
            <StatCard label="ИМТ" value={bmi ?? "—"} sub={bmiLabel} accent={bmiAccent} />
          </>
        )}
      </div>
      {!summaryLoading && (
        <p className="text-muted" style={{ marginTop: "var(--space-xs)", fontSize: "0.85rem" }}>
          Дополнительно: тоннаж за всё время — {summary ? Math.round(summary.total_volume).toLocaleString("ru-RU") : 0} кг×повт.
        </p>
      )}

      <SectionTitle>📉 Прогресс без лишнего</SectionTitle>
      <div className="rep-card">
        <div className="rep-switcher-row">
          {(Object.keys(PERIOD_LABELS) as StatsPeriod[]).map((p) => (
            <button key={p} className={`rep-seg-btn${period === p ? " is-active" : ""}`} onClick={() => setPeriod(p)}>
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="rep-switcher-row" style={{ marginTop: "0.5rem" }}>
          {availableMetrics.map((m) => (
            <button key={m} className={`rep-seg-btn${metric === m ? " is-active" : ""}`} onClick={() => setMetric(m)}>
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="text-muted" style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.85rem" }}>
          {metricHint}
        </p>
        <div className="rep-ex-filter">
          <span className="rep-ex-label">Упражнение:</span>
          <input
            className="input"
            placeholder="Все (или выбери упражнение...)"
            value={exSearch}
            onChange={(e) => setExSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          {exerciseId !== null && (
            <button className="rep-seg-btn" onClick={() => { setExerciseId(null); setExSearch(""); }}>✕ Все</button>
          )}
        </div>
        {exSearch.length > 1 && (exercisesData?.exercises?.length ?? 0) > 0 && (
          <ul className="rep-ex-dropdown">
            {exercisesData!.exercises.map((ex) => (
              <li
                key={ex.id}
                className={`rep-ex-option${exerciseId === ex.id ? " is-selected" : ""}`}
                onClick={() => { setExerciseId(ex.id); setExSearch(ex.name_ru || ex.name_en); }}
              >
                {ex.name_ru || ex.name_en}
              </li>
            ))}
          </ul>
        )}
        {isChartLoading ? (
          <p className="text-muted" style={{ padding: "24px 0", textAlign: "center" }}>Загрузка...</p>
        ) : chartPoints.length === 0 ? (
          <p className="text-muted" style={{ padding: "24px 0", textAlign: "center" }}>Нет данных за выбранный период</p>
        ) : (
          <Suspense fallback={<p className="text-muted" style={{ padding: "24px 0", textAlign: "center" }}>Загрузка графика...</p>}>
            <div className="glass-chart-wrap" style={{ marginTop: "1rem" }}>
              <ProgressChart points={chartPoints} />
            </div>
          </Suspense>
        )}
      </div>

      {weeklyData.length > 0 && (
        <>
          <SectionTitle>📅 Дополнительный график</SectionTitle>
          <div className="rep-card">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: showExtraCharts ? "var(--space-sm)" : 0, gap: "var(--space-sm)", flexWrap: "wrap" }}>
              <p className="text-muted" style={{ margin: 0 }}>
                По умолчанию скрыто, чтобы не перегружать отчёт.
              </p>
              <button className="rep-seg-btn" onClick={() => setShowExtraCharts((prev) => !prev)}>
                {showExtraCharts ? "Скрыть" : "Показать"}
              </button>
            </div>
            {showExtraCharts && (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} allowDecimals={false} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="count" name="Тренировок" fill="#84cc16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </>
      )}

      <SectionTitle>⚖️ Вес и рост</SectionTitle>
      <div className="rep-card">
        <div className="rep-card-header">
          <div className="rep-body-cur">
            {lastWeight && <span className="rep-body-val">⚖️ {lastWeight} кг</span>}
            {lastHeight && <span className="rep-body-val">📏 {lastHeight} см</span>}
            {bmi && <span className="rep-body-bmi" style={{ color: bmiAccent }}>ИМТ {bmi} — {bmiLabel}</span>}
          </div>
          <button className="rep-add-btn" onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? "✕ Отмена" : "+ Записать"}
          </button>
        </div>
        {addOpen && (
          <div className="rep-add-form">
            <div className="rep-add-row">
              <input className="input" type="number" min="20" max="500" step="0.1"
                value={newWeight} onChange={(e) => setNewWeight(e.target.value)} placeholder="Вес, кг" />
              <input className="input" type="number" min="100" max="300" step="1"
                value={newHeight} onChange={(e) => setNewHeight(e.target.value)} placeholder="Рост, см" />
              <button className="rep-save-btn" onClick={handleAddMetric} disabled={addMetric.isPending}>
                {addMetric.isPending ? "…" : "Сохранить"}
              </button>
            </div>
          </div>
        )}
        {weightData.length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} domain={["auto", "auto"]} />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="кг" stroke="#84cc16" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted" style={{ padding: "16px 0", textAlign: "center", fontSize: "0.85rem" }}>
            Запиши хотя бы 2 измерения, чтобы увидеть график веса
          </p>
        )}
        {metrics.length > 0 && (
          <div className="rep-metrics-list">
            <div className="rep-metrics-list-title">История измерений</div>
            {metrics.slice(0, 6).map((m) => (
              <div key={m.id} className="rep-metric-row">
                <span className="rep-metric-date">
                  {new Date(m.measured_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                </span>
                <div className="rep-metric-vals">
                  {m.weight_kg && <span className="rep-metric-val">⚖️ {m.weight_kg} кг</span>}
                  {m.height_cm && <span className="rep-metric-val">📏 {m.height_cm} см</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionTitle>🏋️ История тренировок</SectionTitle>
      <div className="rep-card">
        {all.length === 0 ? (
          <p className="text-muted" style={{ padding: "16px 0", textAlign: "center" }}>Тренировок пока нет</p>
        ) : (
          <div className="rep-history-list">
            {all.slice(0, 20).map((w) => {
              const isCompleted = !!w.completed_at;
              const completedDate = w.completed_at
                ? new Date(w.completed_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                : null;
              const completedTime = w.completed_at
                ? new Date(w.completed_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
                : null;
              const plannedDate = new Date(w.workout_date).toLocaleDateString("ru-RU", {
                day: "numeric", month: "long", year: "numeric",
              });
              return (
                <div key={w.id} className={`rep-history-row${isCompleted ? " is-done" : ""}`}>
                  <div className="rep-history-icon">{isCompleted ? "✅" : "📋"}</div>
                  <div className="rep-history-info">
                    <div className="rep-history-name">{w.name}</div>
                    <div className="rep-history-dates">
                      {isCompleted ? (
                        <>
                          <span className="rep-history-done-label">Завершена</span>
                          <span className="rep-history-date">{completedDate} в {completedTime}</span>
                        </>
                      ) : (
                        <>
                          <span className="rep-history-plan-label">Запланирована</span>
                          <span className="rep-history-date">{plannedDate}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="rep-history-meta">
                    {w.duration_minutes ? <span className="rep-history-dur">⏱ {w.duration_minutes} мин</span> : null}
                    {!isCompleted && <span className="rep-history-pending">В процессе</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
