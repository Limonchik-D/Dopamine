import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateWorkout, useWorkouts } from "../features/workouts/useWorkouts";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { toDiagnosticSuffix, toUserMessage } from "../services/apiErrors";

export function WorkoutsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useWorkouts();
  const createWorkout = useCreateWorkout();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [errorText, setErrorText] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorText("");
    try {
      await createWorkout.mutateAsync({
        name: name.trim(),
        workout_date: new Date().toISOString().slice(0, 10),
        description: description.trim() || undefined,
      });
      setName("");
      setDescription("");
      setExpanded(false);
    } catch (error) {
      setErrorText(`${toUserMessage(error)}${toDiagnosticSuffix(error)}`);
    }
  };

  const workouts = data?.workouts ?? [];

  return (
    <div className="stack">
      {/* Floating create plan button */}
      <button className="builder-create-plan-btn" onClick={() => navigate("/workouts/new")}>
        <span className="builder-create-plan-icon">+</span>
        Create Workout Plan
      </button>

      <Card>
        <h2>Мои тренировки</h2>
        <form onSubmit={onSubmit} className="stack" style={{ marginTop: "var(--space-md)" }}>
          <div className="row">
            <input
              className="input"
              value={name}
              onChange={(e) => { setName(e.target.value); if (e.target.value) setExpanded(true); }}
              placeholder="Название тренировки"
              style={{ flex: 1 }}
            />
            <Button type="submit" disabled={createWorkout.isPending || !name.trim()}>
              {createWorkout.isPending ? "…" : "+ Создать"}
            </Button>
          </div>
          {expanded && (
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Описание (необязательно)"
            />
          )}
          {errorText && <p className="text-error">{errorText}</p>}
        </form>
      </Card>

      {isLoading ? (
        <Card><p className="text-muted">Загрузка…</p></Card>
      ) : workouts.length === 0 ? (
        <Card>
          <div className="empty-state">
            <div style={{ fontSize: "2.5rem" }}>📋</div>
            <p className="text-muted">Нет тренировок. Создай первую!</p>
          </div>
        </Card>
      ) : (
        <div className="stack">
          {workouts.map((w) => (
            <Link key={w.id} to={`/workouts/${w.id}`} style={{ textDecoration: "none" }}>
              <div className="card workout-list-card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{w.name}</div>
                    <div className="text-muted" style={{ fontSize: "var(--font-sm)", marginTop: 2 }}>
                      {new Date(w.workout_date).toLocaleDateString("ru-RU", {
                        day: "numeric", month: "long", year: "numeric",
                      })}
                      {w.description && ` · ${w.description}`}
                    </div>
                  </div>
                  <span style={{ color: "var(--accent)", fontSize: "1.2rem" }}>›</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}


