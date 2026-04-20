import { ChangeEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { useExercises } from "../features/exercises/useExercises";

export function ExerciseCatalogPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useExercises(search);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => setSearch(e.target.value);

  return (
    <div className="stack">
      <Card>
        <h2>Каталог упражнений</h2>
        <input value={search} onChange={onChange} placeholder="Поиск" />
      </Card>
      <Card>
        {isLoading ? <p>Загрузка...</p> : (
          <ul>
            {(data?.exercises ?? []).map((ex) => (
              <li key={ex.id}>
                <Link to={`/exercises/${ex.id}`}>{ex.name_ru ?? ex.name_en}</Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
