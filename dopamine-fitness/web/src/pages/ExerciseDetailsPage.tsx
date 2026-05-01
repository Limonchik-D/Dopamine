import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  useExercise,
  useFavorites,
  useToggleFavorite,
  useEnrichExercise,
  type EnrichedExercise,
} from "../features/exercises/useExercises";
import { useWorkouts, useAddExerciseToWorkout } from "../features/workouts/useWorkouts";

// ─── Add-to-Workout Panel ─────────────────────────────────────────────────────

function AddToWorkoutPanel({ exerciseId }: { exerciseId: number }) {
  const { data } = useWorkouts();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const addExercise = useAddExerciseToWorkout(selectedId ?? 0);

  const onAdd = async () => {
    if (!selectedId) return;
    await addExercise.mutateAsync({ exercise_id: exerciseId });
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  };

  const workouts = data?.workouts ?? [];

  return (
    <div className="add-to-workout-panel">
      <h3>Добавить в тренировку</h3>
      {workouts.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: "var(--font-sm)" }}>
          Нет тренировок. <Link to="/workouts">Создать</Link>
        </p>
      ) : (
        <div className="row" style={{ alignItems: "flex-end" }}>
          <select
            className="filter-select"
            style={{ flex: 1 }}
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
          >
            <option value="">— Выбери тренировку —</option>
            {workouts.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name} ({w.workout_date})
              </option>
            ))}
          </select>
          <Button onClick={onAdd} disabled={!selectedId || addExercise.isPending}>
            {done ? "✓ Добавлено" : addExercise.isPending ? "…" : "Добавить"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ExerciseDetailsPage() {
  const { id } = useParams();
  const { data: baseEx, isLoading, error } = useExercise(id);
  const { data: favorites } = useFavorites();
  const { add: favAdd, remove: favRemove } = useToggleFavorite();
  const enrich = useEnrichExercise(baseEx?.id);

  // enriched data overlays base data when available
  const ex = (enrich.data as EnrichedExercise | undefined) ?? baseEx;
  const enriched = enrich.data as EnrichedExercise | undefined;

  const isFav = Boolean(favorites?.some((f) => f.exercise_id === ex?.id));

  const toggleFav = () => {
    if (!ex) return;
    if (isFav) favRemove.mutate(ex.id);
    else favAdd.mutate(ex.id);
  };

  const instructions = ex?.instructions_ru ?? ex?.instructions_en ?? null;
  const instructionList: string[] = instructions
    ? instructions.split(/\.\s+/).map((s) => s.trim()).filter(Boolean)
    : [];

  const DIFFICULTY_COLORS: Record<string, string> = {
    beginner: "#4ade80",
    intermediate: "#facc15",
    expert: "#f87171",
  };

  if (isLoading) {
    return (
      <Card>
        <p style={{ color: "var(--muted)" }}>Загрузка…</p>
      </Card>
    );
  }

  if (error || !ex) {
    return (
      <Card>
        <p className="error-text">Упражнение не найдено</p>
        <Link to="/exercises" style={{ marginTop: "var(--space-sm)", display: "inline-block" }}>
          ← Назад в каталог
        </Link>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-sm)" }}>
          <Link to="/exercises" style={{ fontSize: "var(--font-sm)", color: "var(--muted)" }}>
            ← Каталог
          </Link>
          <Button
            className={`btn-fav${isFav ? " is-fav" : ""}`}
            style={{ minWidth: 44, minHeight: 44 }}
            onClick={toggleFav}
            title={isFav ? "Убрать из избранного" : "В избранное"}
          >
            {isFav ? "★" : "☆"}
          </Button>
        </div>

        <div className="exercise-details-layout">
          {/* GIF / image */}
          <div className="exercise-details-media-col">
            {ex.gif_url ? (
              <img src={ex.gif_url} alt={ex.name_en} className="exercise-details-gif" />
            ) : ex.image_url ? (
              <img src={ex.image_url} alt={ex.name_en} className="exercise-details-gif" />
            ) : (
              <div className="exercise-details-gif-placeholder">🏋️</div>
            )}

            {/* GIF enrichment button — shown only when no GIF yet */}
            {!ex.gif_url && (
              <Button
                className="enrich-gif-btn"
                onClick={() => enrich.mutate()}
                disabled={enrich.isPending}
                style={{ marginTop: "var(--space-sm)", width: "100%" }}
              >
                {enrich.isPending
                  ? "⏳ Загружаем GIF…"
                  : enrich.isError
                  ? "❌ Не удалось — повторить"
                  : "▶ Загрузить GIF"}
              </Button>
            )}

            {/* Enrichment source badge */}
            {enriched?.enriched_from && enriched.enriched_from.length > 0 && (
              <div className="enrich-source-badge">
                Обогащено: {enriched.enriched_from.join(", ")}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <h2 style={{ margin: "0 0 var(--space-xs)" }}>
              {ex.name_ru ?? ex.name_en}
            </h2>
            {ex.name_ru && (
              <p style={{ color: "var(--muted)", fontSize: "var(--font-sm)", margin: "0 0 var(--space-sm)" }}>
                {ex.name_en}
              </p>
            )}

            <div className="exercise-tags-row">
              {ex.target && <span className="exercise-tag">{ex.target}</span>}
              {ex.body_part && <span className="exercise-tag">{ex.body_part}</span>}
              {ex.equipment && <span className="exercise-tag tag-secondary">{ex.equipment}</span>}
              {enriched?.difficulty && (
                <span
                  className="exercise-tag"
                  style={{
                    background: `${DIFFICULTY_COLORS[enriched.difficulty] ?? "var(--accent)"}22`,
                    color: DIFFICULTY_COLORS[enriched.difficulty] ?? "var(--accent)",
                    borderColor: DIFFICULTY_COLORS[enriched.difficulty] ?? "var(--accent)",
                  }}
                >
                  {enriched.difficulty}
                </span>
              )}
              {ex.source && (
                <span className="exercise-tag tag-secondary" style={{ opacity: 0.7 }}>
                  {ex.source}
                </span>
              )}
            </div>

            {/* Secondary muscles */}
            {enriched?.secondary_muscles && enriched.secondary_muscles.length > 0 && (
              <div className="exercise-secondary-muscles">
                <span className="exercise-secondary-label">Вторичные мышцы:</span>
                {enriched.secondary_muscles.map((m) => (
                  <span key={m} className="exercise-tag tag-secondary" style={{ fontSize: "0.78rem" }}>{m}</span>
                ))}
              </div>
            )}

            {instructionList.length > 0 && (
              <div className="exercise-instructions">
                <h3>Техника выполнения</h3>
                <ol>
                  {instructionList.map((step, i) => (
                    <li key={i}>{step}.</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Enrich button inside info col when no instructions yet */}
            {!instructions && !enrich.isPending && !enrich.data && (
              <Button
                className="enrich-gif-btn"
                onClick={() => enrich.mutate()}
                style={{ marginTop: "var(--space-md)" }}
              >
                ✨ Загрузить инструкции и сложность
              </Button>
            )}

            <AddToWorkoutPanel exerciseId={ex.id} />
          </div>
        </div>
      </Card>
    </div>
  );
}

