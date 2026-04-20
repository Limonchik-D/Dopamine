import { useQuery } from "@tanstack/react-query";
import { Card } from "../components/ui/Card";
import { apiClient } from "../services/apiClient";

type CustomExercise = {
  id: number;
  name: string;
  target: string | null;
  equipment: string | null;
};

export function MyExercisesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["custom-exercises"],
    queryFn: () => apiClient.get<CustomExercise[]>("/custom-exercises"),
  });

  return (
    <Card>
      <h2>Мои упражнения</h2>
      {isLoading ? <p>Загрузка...</p> : (
        <ul>
          {(data ?? []).map((item) => (
            <li key={item.id}>{item.name} ({item.target ?? "-"})</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
