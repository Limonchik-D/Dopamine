import { lazy, Suspense, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  StatsPeriod,
  useProgress,
  useStatsSummary,
  useExerciseProgress,
  ExerciseProgressPoint,
  StatsPoint,
} from "../features/progress/useProgress";
import { useExercises } from "../features/exercises/useExercises";

const ProgressChart = lazy(() =>
  import("../components/charts/ProgressChart").then((m) => ({ default: m.ProgressChart }))
);

type Metric = "volume" | "max_weight" | "total_reps" | "workout_count";

const METRIC_LABELS: Record<Metric, string> = {
  volume: "Объём (кг×повт)",
  max_weight: "Макс. вес (кг)",
  total_reps: "Всего повторений",
  workout_count: "Тренировок",
};

const PERIOD_LABELS: Record<StatsPeriod, string> = {
  week: "7 дней",
  month: "30 дней",
  "3months": "3 месяца",
  year: "12 месяцев",
};

type ChartPoint = { date: string; value: number };

function mapWorkoutPoints(points: StatsPoint[], metric: Metric): ChartPoint[] {
  return points.map((p) => ({ date: p.date, value: p[metric] ?? 0 }));
}

function mapExercisePoints(points: ExerciseProgressPoint[], metric: "weight" | "volume" | "one_rm_estimate" | "reps"): ChartPoint[] {
  return points.map((p) => ({ date: p.date, value: (p[metric] as number | null) ?? 0 }));
}

export function ProgressPage() {
  const [period, setPeriod] = useState<StatsPeriod>("month");
  const [metric, setMetric] = useState<Metric>("volume");
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [exSearch, setExSearch] = useState("");

  const { data: summary, isLoading: summaryLoading } = useStatsSummary();
  const { data: workoutData, isLoading: workoutLoading } = useProgress(period);
  const { data: exerciseData, isLoading: exLoading } = useExerciseProgress(exerciseId, period);
  const { data: exercisesData } = useExercises({ search: exSearch, page: 1, limit: 20 });

  const isLoading = workoutLoading || (exerciseId !== null && exLoading);

  const chartPoints: ChartPoint[] = exerciseId !== null
    ? mapExercisePoints(
        exerciseData?.points ?? [],
        metric === "max_weight" ? "weight" : metric === "volume" ? "volume" : metric === "total_reps" ? "reps" : "one_rm_estimate"
      )
    : mapWorkoutPoints(workoutData?.points ?? [], metric);

  return (
    <div className="stack">
      {/* Summary cards */}
      <div className="progress-summary-grid">
        {summaryLoading ? (
          <p className="text-muted">Загрузка...</p>
        ) : (
          <>
            <div className="glass-stat-card">
              <span className="glass-stat-value">{summary?.total_workouts ?? 0}</span>
              <span className="glass-stat-label">Тренировок</span>
            </div>
            <div className="glass-stat-card">
              <span className="glass-stat-value">{summary ? Math.round(summary.total_volume).toLocaleString() : 0}</span>
              <span className="glass-stat-label">Объём, кг×повт</span>
            </div>
            <div className="glass-stat-card">
              <span className="glass-stat-value">{summary?.total_sets ?? 0}</span>
              <span className="glass-stat-label">Подходов</span>
            </div>
            <div className="glass-stat-card">
              <span className="glass-stat-value">{summary?.max_weight ?? 0}</span>
              <span className="glass-stat-label">Рекорд, кг</span>
            </div>
            <div className="glass-stat-card">
              <span className="glass-stat-value">{summary?.active_days ?? 0}</span>
              <span className="glass-stat-label">Активных дней</span>
            </div>
          </>
        )}
      </div>

      {/* Chart card */}
      <Card>
        {/* Period switcher */}
        <div className="row period-switcher">
          {(Object.keys(PERIOD_LABELS) as StatsPeriod[]).map((p) => (
            <Button
              key={p}
              className={period === p ? "btn-segment is-active" : "btn-segment"}
              onClick={() => setPeriod(p)}
            >
              {PERIOD_LABELS[p]}
            </Button>
          ))}
        </div>

        {/* Metric switcher */}
        <div className="row period-switcher" style={{ marginTop: "0.5rem" }}>
          {(Object.keys(METRIC_LABELS) as Metric[]).map((m) => (
            <Button
              key={m}
              className={metric === m ? "btn-segment is-active" : "btn-segment"}
              onClick={() => setMetric(m)}
            >
              {METRIC_LABELS[m]}
            </Button>
          ))}
        </div>

        {/* Exercise filter */}
        <div className="progress-exercise-filter">
          <span className="progress-exercise-label">Упражнение:</span>
          <input
            className="input"
            placeholder="Поиск упражнения..."
            value={exSearch}
            onChange={(e) => setExSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          {exerciseId !== null && (
            <Button
              className="btn-segment"
              onClick={() => { setExerciseId(null); setExSearch(""); }}
            >
              ✕ Все
            </Button>
          )}
        </div>
        {exSearch.length > 1 && (exercisesData?.exercises?.length ?? 0) > 0 && (
          <ul className="progress-exercise-dropdown">
            {exercisesData!.exercises.map((ex) => (
              <li
                key={ex.id}
                className={`progress-exercise-option${exerciseId === ex.id ? " is-selected" : ""}`}
                onClick={() => { setExerciseId(ex.id); setExSearch(ex.name_ru || ex.name_en); }}
              >
                {ex.name_ru || ex.name_en}
              </li>
            ))}
          </ul>
        )}

        {/* Chart */}
        {isLoading ? (
          <p className="text-muted">Загрузка графика...</p>
        ) : chartPoints.length === 0 ? (
          <p className="text-muted empty-chart">Нет данных за выбранный период</p>
        ) : (
          <Suspense fallback={<p className="text-muted">Загрузка графика...</p>}>
            <div className="glass-chart-wrap">
              <ProgressChart points={chartPoints} />
            </div>
          </Suspense>
        )}
      </Card>
    </div>
  );
}
