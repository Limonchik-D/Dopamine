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
import { useCustomExercises } from "../features/exercises/useCustomExercises";
import { toUserMessage, toDiagnosticSuffix } from "../services/apiErrors";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Resolve display name and media for a workout exercise entry */
function resolveExercise(we: WorkoutExerciseEntry) {
  const isCustom = we.custom_exercise_id != null;
  const name = isCustom
    ? (we.custom_name ?? `Упражнение #${we.order_index + 1}`)
    : (we.exercise_name ?? `Упражнение #${we.order_index + 1}`);
  const gifUrl = isCustom ? null : (we.exercise_gif_url ?? null);
  const photoKey = isCustom ? (we.custom_photo_key ?? null) : null;
  const target = isCustom
    ? (we.custom_target ?? we.target_muscle)
    : (we.exercise_target ?? we.target_muscle);
  const equipment = isCustom
    ? (we.custom_equipment ?? we.equipment)
    : (we.exercise_equipment ?? we.equipment);
  return { isCustom, name, gifUrl, photoKey, target, equipment };
}

// ─── Set Row ──────────────────────────────────────────────────────────────────

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

  const toggleComplete = () =>
    updateSet.mutate({ setId: s.id, payload: { completed: !s.completed } });

  return (
    <div className={`wd-set-row${s.completed ? " is-done" : ""}`}>
      <span className="wd-set-num">Set {s.set_number}</span>
      <div className="wd-set-field">
        <label>кг</label>
        <input
          className="set-input"
          type="number" min="0" step="0.5"
          placeholder="—"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={flush}
        />
      </div>
      <div className="wd-set-field">
        <label>повт.</label>
        <input
          className="set-input"
          type="number" min="0" step="1"
          placeholder="—"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={flush}
        />
      </div>
      <button
        className={`wd-set-check${s.completed ? " checked" : ""}`}
        onClick={toggleComplete}
        disabled={updateSet.isPending}
        title="Отметить выполненным"
      >
        {s.completed ? "✓" : "○"}
      </button>
      <button
        className="wd-set-del"
        onClick={() => deleteSet.mutate(s.id)}
        disabled={deleteSet.isPending}
        title="Удалить"
      >
        ✕
      </button>
    </div>
  );
}

// ─── Add Set Form ─────────────────────────────────────────────────────────────

function AddSetForm({ workoutId, we }: { workoutId: number; we: WorkoutExerciseEntry }) {
  const nextNum = (we.sets.length > 0 ? Math.max(...we.sets.map((s) => s.set_number)) : 0) + 1;
  const addSet = useAddSet(workoutId, we.id);
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await addSet.mutateAsync({
      set_number: nextNum,
      weight: weight ? parseFloat(weight) : undefined,
      reps: reps ? parseInt(reps, 10) : undefined,
      completed: false,
    });
    setWeight("");
    setReps("");
  };

  return (
    <form onSubmit={onSubmit} className="wd-add-set-form">
      <span className="wd-set-num" style={{ opacity: 0.5 }}>Set {nextNum}</span>
      <div className="wd-set-field">
        <label>кг</label>
        <input
          className="set-input"
          type="number" min="0" step="0.5"
          placeholder="—"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
        />
      </div>
      <div className="wd-set-field">
        <label>повт.</label>
        <input
          className="set-input"
          type="number" min="0" step="1"
          placeholder="—"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={addSet.isPending} className="wd-add-set-btn">
        {addSet.isPending ? "…" : "+ Подход"}
      </Button>
    </form>
  );
}

// ─── Exercise Block ───────────────────────────────────────────────────────────

function ExerciseBlock({ we, workoutId }: { we: WorkoutExerciseEntry; workoutId: number }) {
  const removeExercise = useRemoveExerciseFromWorkout(workoutId);
  const [open, setOpen] = useState(true);
  const { isCustom, name, gifUrl, photoKey, target, equipment } = resolveExercise(we);

  const photoUrl = photoKey ? `/api/uploads/photo/${photoKey}` : null;
  const completedCount = we.sets.filter((s) => s.completed).length;

  return (
    <div className="wd-exercise-block">
      {/* Header */}
      <div className="wd-exercise-header" onClick={() => setOpen((v) => !v)}>
        {/* Media thumbnail */}
        <div className="wd-exercise-thumb">
          {gifUrl ? (
            <img src={gifUrl} alt={name} className="wd-exercise-thumb-img" />
          ) : photoUrl ? (
            <img src={photoUrl} alt={name} className="wd-exercise-thumb-img" />
          ) : (
            <span className="wd-exercise-thumb-icon">{isCustom ? "⭐" : "🏋️"}</span>
          )}
        </div>

        {/* Info */}
        <div className="wd-exercise-info">
          <div className="wd-exercise-name">
            {name}
            {isCustom && <span className="wd-custom-badge">Своё</span>}
          </div>
          <div className="wd-exercise-meta">
            {[target, equipment].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>

        {/* Progress + controls */}
        <div className="wd-exercise-right">
          <span className="wd-set-progress">
            {completedCount}/{we.sets.length} подх.
          </span>
          <button
            className="wd-exercise-del"
            onClick={(e) => { e.stopPropagation(); removeExercise.mutate(we.id); }}
            disabled={removeExercise.isPending}
            title="Удалить упражнение"
          >
            🗑
          </button>
          <span className="wd-chevron">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="wd-exercise-body">
          {/* GIF (catalog only) — lazy load strip */}
          {gifUrl && (
            <div className="wd-gif-strip">
              <img src={gifUrl} alt={name} className="wd-gif-img" />
            </div>
          )}

          {/* Sets */}
          {we.sets.length > 0 ? (
            <div className="wd-sets-list">
              <div className="wd-sets-header">
                <span></span>
                <span>кг</span>
                <span>повт.</span>
                <span></span>
                <span></span>
              </div>
              {we.sets.map((s) => (
                <SetRow key={s.id} s={s} workoutId={workoutId} weId={we.id} />
              ))}
            </div>
          ) : (
            <p className="text-muted" style={{ margin: "var(--space-sm) 0", fontSize: "var(--font-sm)" }}>
              Нет подходов — добавь первый!
            </p>
          )}

          <AddSetForm workoutId={workoutId} we={we} />
        </div>
      )}
    </div>
  );
}

// ─── Add Exercise Panel ───────────────────────────────────────────────────────

type Tab = "catalog" | "mine";

function AddExercisePanel({ workoutId, onClose }: { workoutId: number; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("catalog");
  const [search, setSearch] = useState("");
  const { data: catalogData, isLoading: catalogLoading } = useExercises({ search: search || undefined, limit: 30 });
  const { data: customData, isLoading: customLoading } = useCustomExercises();
  const addExercise = useAddExerciseToWorkout(workoutId);

  const addCatalog = async (exerciseId: number) => {
    await addExercise.mutateAsync({ exercise_id: exerciseId });
    onClose();
  };

  const addCustom = async (customId: number) => {
    await addExercise.mutateAsync({ custom_exercise_id: customId });
    onClose();
  };

  const filteredCustom = (customData ?? []).filter((ex) =>
    !search || ex.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="add-exercise-panel">
      {/* Panel header */}
      <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
        <h3 style={{ margin: 0 }}>Добавить упражнение</h3>
        <Button className="btn-icon btn-ghost" onClick={onClose}>✕</Button>
      </div>

      {/* Tabs */}
      <div className="row period-switcher" style={{ marginBottom: "var(--space-sm)" }}>
        <button
          className={`btn-segment${tab === "catalog" ? " is-active" : ""}`}
          onClick={() => setTab("catalog")}
        >
          📚 Каталог
        </button>
        <button
          className={`btn-segment${tab === "mine" ? " is-active" : ""}`}
          onClick={() => setTab("mine")}
        >
          ⭐ Мои упражнения
        </button>
      </div>

      {/* Search */}
      <input
        className="input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tab === "catalog" ? "Поиск по каталогу…" : "Поиск по моим…"}
        autoFocus
        style={{ marginBottom: "var(--space-sm)" }}
      />

      {/* Results */}
      <div className="exercise-search-results">
        {/* ── Catalog tab ── */}
        {tab === "catalog" && (
          <>
            {catalogLoading && <p className="text-muted">Загрузка…</p>}
            {!catalogLoading && (catalogData?.exercises ?? []).length === 0 && (
              <p className="text-muted">Ничего не найдено</p>
            )}
            {(catalogData?.exercises ?? []).map((ex) => (
              <div
                key={ex.id}
                className="exercise-search-item"
                onClick={() => addCatalog(ex.id)}
              >
                {ex.gif_url && (
                  <img src={ex.gif_url} alt="" className="exercise-search-thumb" />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="exercise-search-name">{ex.name_ru ?? ex.name_en}</div>
                  <div className="exercise-search-meta">{[ex.target, ex.equipment].filter(Boolean).join(" · ")}</div>
                </div>
                <Button disabled={addExercise.isPending} style={{ flexShrink: 0 }}>+</Button>
              </div>
            ))}
          </>
        )}

        {/* ── My exercises tab ── */}
        {tab === "mine" && (
          <>
            {customLoading && <p className="text-muted">Загрузка…</p>}
            {!customLoading && filteredCustom.length === 0 && (
              <p className="text-muted">
                Нет своих упражнений.{" "}
                <a href="/my-exercises" style={{ color: "var(--accent)" }}>Создать →</a>
              </p>
            )}
            {filteredCustom.map((ex) => (
              <div
                key={ex.id}
                className="exercise-search-item"
                onClick={() => addCustom(ex.id)}
              >
                <span className="exercise-search-thumb" style={{ fontSize: "1.4rem", display: "flex", alignItems: "center", justifyContent: "center" }}>⭐</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="exercise-search-name">{ex.name}</div>
                  <div className="exercise-search-meta">{[ex.target, ex.equipment].filter(Boolean).join(" · ") || "Своё упражнение"}</div>
                </div>
                <Button disabled={addExercise.isPending} style={{ flexShrink: 0 }}>+</Button>
              </div>
            ))}
          </>
        )}
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

  if (isLoading) return <Card><p className="text-muted">Загрузка…</p></Card>;
  if (error || !data) return <Card><p className="text-error">Тренировка не найдена</p></Card>;

  const exercises = data.exercises ?? [];
  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const completedSets = exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0);

  return (
    <div className="stack">
      {/* Header card */}
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
          <Button
            className="btn-icon btn-ghost btn-danger"
            onClick={onDelete}
            disabled={deleteWorkout.isPending}
            title="Удалить тренировку"
          >
            🗑
          </Button>
        </div>

        {deleteError && <p className="text-error" style={{ marginTop: "var(--space-sm)" }}>{deleteError}</p>}

        <div className="glass-pill-row" style={{ marginTop: "var(--space-md)" }}>
          <span className="glass-pill">Упражнений: {exercises.length}</span>
          <span className="glass-pill">
            Подходов: {completedSets}/{totalSets}
            {totalSets > 0 && (
              <span style={{ marginLeft: 6, color: completedSets === totalSets ? "var(--accent)" : "var(--muted)" }}>
                {completedSets === totalSets ? " ✓" : ` ${Math.round((completedSets / totalSets) * 100)}%`}
              </span>
            )}
          </span>
          {data.notes && <span className="glass-pill">📝 {data.notes}</span>}
        </div>
      </Card>

      {/* Progress bar */}
      {totalSets > 0 && (
        <div className="wd-progress-bar-wrap">
          <div
            className="wd-progress-bar-fill"
            style={{ width: `${(completedSets / totalSets) * 100}%` }}
          />
        </div>
      )}

      {/* Empty state */}
      {exercises.length === 0 && !showAddExercise && (
        <Card>
          <div className="empty-state">
            <div style={{ fontSize: "2.5rem" }}>🏋️</div>
            <p>Нет упражнений. Добавь первое!</p>
          </div>
        </Card>
      )}

      {/* Exercise blocks */}
      {exercises.map((we) => (
        <ExerciseBlock key={we.id} we={we} workoutId={data.id} />
      ))}

      {/* Add Exercise Panel / Button */}
      {showAddExercise ? (
        <AddExercisePanel workoutId={data.id} onClose={() => setShowAddExercise(false)} />
      ) : (
        <button className="wd-add-exercise-btn" onClick={() => setShowAddExercise(true)}>
          <span style={{ fontSize: "1.3rem" }}>+</span>
          Добавить упражнение
        </button>
      )}
    </div>
  );
}
