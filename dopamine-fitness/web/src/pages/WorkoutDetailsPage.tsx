import { useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { useWorkout } from "../features/workouts/useWorkouts";

export function WorkoutDetailsPage() {
  const { id } = useParams();
  const { data, isLoading } = useWorkout(id);

  return (
    <Card>
      <h2>Тренировка</h2>
      {isLoading ? <p>Загрузка...</p> : (
        <>
          <p>{data?.name}</p>
          <p>Дата: {data?.workout_date}</p>
          <p>Упражнений: {data?.exercises?.length ?? 0}</p>
        </>
      )}
    </Card>
  );
}
