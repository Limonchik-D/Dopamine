import { useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { useExercise } from "../features/exercises/useExercises";

export function ExerciseDetailsPage() {
  const { id } = useParams();
  const { data, isLoading } = useExercise(id);

  return (
    <Card>
      {isLoading ? <p>Загрузка...</p> : (
        <>
          <h2>{data?.name_ru ?? data?.name_en}</h2>
          <p>Цель: {data?.target ?? "-"}</p>
          <p>Оборудование: {data?.equipment ?? "-"}</p>
          {data?.gif_url && <img src={data.gif_url} alt={data.name_en} className="exercise-preview" />}
        </>
      )}
    </Card>
  );
}
