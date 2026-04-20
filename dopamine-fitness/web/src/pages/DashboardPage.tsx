import { Card } from "../components/ui/Card";
import { useWorkouts } from "../features/workouts/useWorkouts";

export function DashboardPage() {
  const { data, isLoading } = useWorkouts();
  const latest = data?.workouts?.[0];

  return (
    <div className="stack">
      <Card>
        <h2>Дашборд</h2>
        {isLoading ? <p>Загрузка...</p> : <p>Последняя тренировка: {latest?.name ?? "Нет данных"}</p>}
      </Card>
    </div>
  );
}
