import { FormEvent, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  useWorkout,
  useDeleteWorkout,
  useAddExerciseToWorkout,
  useRemoveExerciseFromWorkout,
  useAddSet,
  useUpdateSet,
  useDeleteSet,
  type WorkoutExerciseEntry,
  type WorkoutSet,
} from "../features/workouts/useWorkouts";
import { useExercises } from "../features/exercises/useExercises";
import { toUserMessage, toDiagnosticSuffix } from "../services/apiErrors";

// ─── Add Set Row ─────────────────────────────────────────────────────────────

function AddSetRow({ workoutId, we }: { workoutId: number; we: WorkoutExerciseEntry }) {
  const nextNum = (we.sets.length > 0 ? Math.max(...we.sets.map((s) => s.set_number)) : 0) + 1;
  const addSet = useAddSet(workoutId, we.id);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [rest, setRest] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await addSet.mutateAsync({
      set_number: nextNum,
      weight: weight ? parseFloat(weight) : undefined,
      reps: reps ? parseInt(reps, 10) : undefined,
      rest_seconds: rest ? parseInt(rest, 10) : undefined,
      completed: false,
    });
    setWeight("");
    setReps("");
    setRest("");
  };

  return (
    <form onSubmit={onSubmit} className="add-set-row">
      <div className="add-set-field">
        <label>Вес (кг)</label>
        <input className="set-input" type="number" min="0" step="0.5" placeholder="—" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </div>
      <div className="add-set-field">
        <label>Повторения</label>
        <input className="set-input" type="number" min="0" step="1" placeholder="—" value={reps} onChange={(e) => setReps(e.target.value)} />
      </div>
      <div className="add-set-field">
        <label>Отдых (сек)</label>
        <input className="set-input" type="number" min="0" step="5" placeholder="—" value={rest} onChange={(e) => setRest(e.target.value)} />
      </div>
      <Button type="submit" disabled={addSet.isPending}>
        {addSet.isPending ? "…" : `+ Подход ${nextNum}`}
      </Button>
    </form>
  );
}

// ─── Set Row ─────────────────────────────────────────────────────────────────

function SetRow({ s, workoutId, weId }: { s: WorkoutSet; workoutId: number; weId: number }) {
  const updateSet = useUpdateSet(workoutId, weId);
  const deleteSet = useDeleteSet(workoutId, weId);
  const [weight, setWeight] = useState(s.weight != null ? String(s.weight) : "");
  const [reps, setReps] = useState(s.reps != null ? String(s.reps) : "");

  const flush = async () => {
    await updateSet.mutateAsync({
      setId: s.id,
      payload: {
        weight: weight ? parseFloat(weight) : undefined,
        reps: reps ? parseInt(reps, 10) : undefined,
      },
    });
  };

  const toggleComplete = async () => {
    await updateSet.mutateAsync({ setId: s.id, payload: { completed: !s.completed } });
  };

  return (
    <tr>
      <td style={{ color: "var(--muted)", fontWeight: 600 }}>{s.set_number}</td>
      <td>
        <input
          className="set-input"
          type="number"
          min="0"
          step="0.5"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={flush}
          placeholder="—"
        />
      </td>
      <td>
        <input
          className="set-input"
          type="number"
          min="0"
          step="1"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={flush}
          placeholder="—"
        />
      </td>
      <td>{s.rest_seconds != null ? `${s.rest_seconds}с` : "—"}</td>
      <td>
        <Button
          className={`set-complete-btn${s.completed ? " is-done" : ""}`}
          onClick={toggleComplete}
          disabled={updateSet.isPending}
        >
          {s.completed ? "✓" : "○"}
        </Button>
      </td>
      <td>
        <Button
          className="btn-icon btn-ghost"
          onClick={() => deleteSet.mutate(s.id)}
          disabled={deleteSet.isPending}
          title="Удалить подход"
        >
          ✕
        </Button>
      </td>
    </tr>
  );
}

// ─── Exercise Block ───────────────────────────────────────────────────────────

function ExerciseBlock({ we, workoutId }: { we: WorkoutExerciseEntry; workoutId: number }) {
  const removeExercise = useRemoveExerciseFromWorkout(workoutId);

  return (
    <div className="exercise-block">
      <div className="exercise-block-header">
        <div>
          <div className="exercise-block-title">
            {we.exercise_name ?? `Упражнение #${we.order_index + 1}`}
          </div>
          <div className="exercise-block-meta">
            {[we.target_muscle, we.equipment].filter(Boolean).join(" · ") || "Мышцы не указаны"}
          </div>
        </div>
        <Button
          className="btn-icon btn-ghost btn-danger"
          onClick={() => removeExercise.mutate(we.id)}
          disabled={removeExercise.isPending}
          title="Удалить упражнение"
        >
          🗑
        </Button>
      </div>

      <div className="sets-table-wrap">
        {we.sets.length > 0 ? (
          <table className="sets-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Вес</th>
                <th>Повт.</th>
                <th>Отдых</th>
                <th>Готово</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {we.sets.map((s) => (
                <SetRow key={s.id} s={s} workoutId={workoutId} weId={we.id} />
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: "var(--font-sm)", margin: "var(--space-sm) 0" }}>
            Нет подходов
          </p>
        )}
      </div>

      <AddSetRow workoutId={workoutId} we={we} />
    </div>
  );
}

// ─── Add Exercise Panel ───────────────────────────────────────────────────────

function AddExercisePanel({ workoutId, onClose }: { workoutId: number; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useExercises({ search, limit: 20 });
  const addExercise = useAddExerciseToWorkout(workoutId);

  const pick = async (exerciseId: number) => {
    await addExercise.mutateAsync({ exercise_id: exerciseId });
    onClose();
  };

  return (
    <div className="add-exercise-panel">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
        <h3 style={{ margin: 0 }}>Добавить упражнение</h3>
        <Button className="btn-icon btn-ghost" onClick={onClose}>✕</Button>
      </div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по названию…"
        autoFocus
      />
      <div className="exercise-search-results">
        {isLoading && <p style={{ color: "var(--muted)" }}>Загрузка…</p>}
        {!isLoading && (data?.exercises ?? []).length === 0 && (
          <p style={{ color: "var(--muted)" }}>Ничего не найдено</p>
        )}
        {(data?.exercises ?? []).map((ex) => (
          <div key={ex.id} className="exercise-search-item" onClick={() => pick(ex.id)}>
            <div>
              <div className="exercise-search-name">{ex.name_ru ?? ex.name_en}</div>
              <div className="exercise-search-meta">
                {[ex.target, ex.equipment].filter(Boolean).join(" · ")}
              </div>
            </div>
            <Button disabled={addExercise.isPending} style={{ flexShrink: 0 }}>
              + Добавить
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function WorkoutDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useWorkout(id);
  const deleteWorkout = useDeleteWorkout();
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const onDelete = async () => {
    if (!data || !confirm(`Удалить тренировку «${data.name}»?`)) return;
    setDeleteError("");
    try {
      await deleteWorkout.mutateAsync(data.id);
      navigate("/workouts");
    } catch (err) {
      setDeleteError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <p style={{ color: "var(--muted)" }}>Загрузка…</p>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <p className="error-text">Тренировка не найдена</p>
      </Card>
    );
  }

  const exercises = data.exercises ?? [];
  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const completedSets = exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0);

  return (
    <div className="stack">
      {/* Header */}
      <Card>
        <div className="workout-header">
          <div>
            <h2>{data.name}</h2>
            <p className="workout-meta">
              {new Date(data.workout_date).toLocaleDateString("ru-RU", {
                day: "numeric", month: "long", year: "numeric",
              })}
              {data.description && ` · ${data.description}`}
            </p>
          </div>
          <Button className="btn-icon btn-ghost btn-danger" onClick={onDelete} disabled={deleteWorkout.isPending} title="Удалить тренировку">
            🗑
          </Button>
        </div>

        {deleteError && <p className="error-text" style={{ marginTop: "var(--space-sm)" }}>{deleteError}</p>}

        <div className="glass-pill-row" style={{ marginTop: "var(--space-md)" }}>
          <span className="glass-pill">Упражнений: {exercises.length}</span>
          <span className="glass-pill">Подходов: {completedSets}/{totalSets}</span>
          {data.notes && <span className="glass-pill">📝 {data.notes}</span>}
        </div>
      </Card>

      {/* Exercises */}
      {exercises.length === 0 && !showAddExercise && (
        <Card>
          <div className="empty-state">
            <div style={{ fontSize: "2.5rem" }}>🏋️</div>
            <p>Нет упражнений. Добавь первое!</p>
          </div>
        </Card>
      )}

      {exercises.map((we) => (
        <ExerciseBlock key={we.id} we={we} workoutId={data.id} />
      ))}

      {/* Add Exercise Panel */}
      {showAddExercise ? (
        <AddExercisePanel workoutId={data.id} onClose={() => setShowAddExercise(false)} />
      ) : (
        <Button onClick={() => setShowAddExercise(true)}>
          + Добавить упражнение
        </Button>
      )}
    </div>
  );
}

