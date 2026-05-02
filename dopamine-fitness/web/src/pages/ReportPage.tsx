import { useState } from "react";
import { useBodyMetrics, useAddBodyMetric } from "../features/auth/useAuth";
import { useWorkouts } from "../features/workouts/useWorkouts";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rep-stat-card">
      <div className="rep-stat-value">{value}</div>
      <div className="rep-stat-label">{label}</div>
      {sub && <div className="rep-stat-sub">{sub}</div>}
    </div>
  );
}

export function ReportPage() {
  const { data: metrics = [] } = useBodyMetrics();
  const { data: workoutsData } = useWorkouts();
  const addMetric = useAddBodyMetric();
  const [newWeight, setNewWeight] = useState("");
  const [newHeight, setNewHeight] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const workouts = workoutsData?.workouts ?? [];
  const completed = workouts.filter((w) => w.completed_at);

  // Статистика тренировок
  const totalWorkouts = completed.length;
  const totalDuration = completed.reduce((a, w) => a + (w.duration_minutes ?? 0), 0);
  const avgDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;

  // Последние 12 недель — количество тренировок
  const weeklyMap: Record<string, number> = {};
  completed.forEach((w) => {
    const d = new Date(w.workout_date);
    const week = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    weeklyMap[week] = (weeklyMap[week] ?? 0) + 1;
  });
  const weeklyData = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, count]) => ({ week: week.slice(5), count }));

  // График веса
  const weightData = [...metrics]
    .reverse()
    .filter((m) => m.weight_kg)
    .slice(-20)
    .map((m) => ({
      date: new Date(m.measured_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }),
      кг: m.weight_kg,
    }));

  const lastWeight = metrics.find((m) => m.weight_kg)?.weight_kg;
  const lastHeight = metrics.find((m) => m.height_cm)?.height_cm;
  const bmi = lastWeight && lastHeight ? (lastWeight / ((lastHeight / 100) ** 2)).toFixed(1) : null;

  const handleAddMetric = async () => {
    if (!newWeight && !newHeight) return;
    await addMetric.mutateAsync({
      weight_kg: newWeight ? parseFloat(newWeight) : undefined,
      height_cm: newHeight ? parseFloat(newHeight) : undefined,
    });
    setNewWeight("");
    setNewHeight("");
    setAddOpen(false);
  };

  return (
    <div className="stack">
      <div className="rep-header">
        <h2 className="rep-title">📊 Отчёт</h2>
        <p className="rep-sub">Твои результаты и прогресс</p>
      </div>

      {/* Основные показатели */}
      <div className="rep-stats-grid">
        <StatCard label="Тренировок" value={totalWorkouts} />
        <StatCard label="Среднее время" value={`${avgDuration} мин`} />
        <StatCard label="Вес" value={lastWeight ? `${lastWeight} кг` : "—"} />
        <StatCard label="ИМТ" value={bmi ?? "—"} sub={bmi ? (parseFloat(bmi) < 18.5 ? "Дефицит" : parseFloat(bmi) < 25 ? "Норма" : parseFloat(bmi) < 30 ? "Избыток" : "Ожирение") : undefined} />
      </div>

      {/* График тренировок по неделям */}
      {weeklyData.length > 0 && (
        <div className="rep-card">
          <div className="rep-card-title">Тренировки по неделям</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#e0e0e0" }}
              />
              <Bar dataKey="count" name="Тренировок" fill="#84cc16" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* График веса */}
      <div className="rep-card">
        <div className="rep-card-header">
          <span className="rep-card-title">Вес / Рост</span>
          <button className="rep-add-btn" onClick={() => setAddOpen((v) => !v)}>
            {addOpen ? "Отмена" : "+ Записать"}
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
              <Tooltip
                contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#e0e0e0" }}
              />
              <Line type="monotone" dataKey="кг" stroke="#84cc16" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-muted" style={{ padding: "16px 0", textAlign: "center", fontSize: "0.85rem" }}>
            Запиши хотя бы 2 измерения чтобы увидеть график
          </p>
        )}

        {/* История измерений */}
        {metrics.length > 0 && (
          <div className="rep-metrics-list">
            {metrics.slice(0, 5).map((m) => (
              <div key={m.id} className="rep-metric-row">
                <span className="rep-metric-date">
                  {new Date(m.measured_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                </span>
                {m.weight_kg && <span className="rep-metric-val">{m.weight_kg} кг</span>}
                {m.height_cm && <span className="rep-metric-val">{m.height_cm} см</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Последние тренировки */}
      {completed.length > 0 && (
        <div className="rep-card">
          <div className="rep-card-title">Последние тренировки</div>
          <div className="rep-workouts-list">
            {completed.slice(0, 8).map((w) => (
              <div key={w.id} className="rep-workout-row">
                <div>
                  <div className="rep-workout-name">{w.name}</div>
                  <div className="rep-workout-date">
                    {new Date(w.workout_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                  </div>
                </div>
                {w.duration_minutes && (
                  <span className="rep-workout-dur">{w.duration_minutes} мин</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
