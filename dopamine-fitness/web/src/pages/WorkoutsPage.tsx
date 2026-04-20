import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useCreateWorkout, useWorkouts } from "../features/workouts/useWorkouts";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toDiagnosticSuffix, toUserMessage } from "../services/apiErrors";

export function WorkoutsPage() {
  const { data, isLoading } = useWorkouts();
  const createWorkout = useCreateWorkout();
  const [name, setName] = useState("");
  const [errorText, setErrorText] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorText("");
    try {
      await createWorkout.mutateAsync({ name, workout_date: new Date().toISOString().slice(0, 10) });
      setName("");
    } catch (error) {
      setErrorText(`${toUserMessage(error)}${toDiagnosticSuffix(error)}`);
    }
  };

  return (
    <div className="stack">
      <Card>
        <h2>Мои тренировки</h2>
        <form onSubmit={onSubmit} className="row">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
          <Button type="submit">Новая тренировка</Button>
        </form>
        {errorText && <p className="error-text">{errorText}</p>}
      </Card>
      <Card>
        {isLoading ? <p>Загрузка...</p> : (
          <ul>
            {(data?.workouts ?? []).map((w) => (
              <li key={w.id}>
                <Link to={`/workouts/${w.id}`}>{w.name}</Link> — {w.workout_date}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
