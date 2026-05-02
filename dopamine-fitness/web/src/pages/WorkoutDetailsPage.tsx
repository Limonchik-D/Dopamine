import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  type Workout,
  useWorkout,
  useDeleteWorkout,
  useAddExerciseToWorkout,
  useRemoveExerciseFromWorkout,
  useAddSet,
  useUpdateSet,
  useDeleteSet,
  useCompleteWorkout,
  type WorkoutExerciseEntry,
  type WorkoutSet,
} from "../features/workouts/useWorkouts";
import {
  useExercise,
  useEnrichExercise,
  useExercises,
  useFavorites,
  type EnrichedExercise,
} from "../features/exercises/useExercises";
import { useCustomExercises } from "../features/exercises/useCustomExercises";
import { ApiClientError, apiClient } from "../services/apiClient";
import { toUserMessage, toDiagnosticSuffix } from "../services/apiErrors";

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Resolve display name and media for a workout exercise entry */
function resolveExercise(we: WorkoutExerciseEntry) {
  const isCustom = we.custom_exercise_id != null;
  const name = isCustom
    ? (we.custom_name ?? `Упражнение #${we.order_index + 1}`)
    : (we.exercise_name ?? `Упражнение #${we.order_index + 1}`);
  const gifUrl = isCustom ? null : (we.exercise_gif_url ?? null);
  const imageUrl = isCustom ? null : (we.exercise_image_url ?? null);
  const photoKey = isCustom ? (we.custom_photo_key ?? null) : null;
  const target = isCustom
    ? (we.custom_target ?? we.target_muscle)
    : (we.exercise_target ?? we.target_muscle);
  const equipment = isCustom
    ? (we.custom_equipment ?? we.equipment)
    : (we.exercise_equipment ?? we.equipment);
  const instructionsEn = isCustom
    ? (we.custom_description ?? null)
    : (we.exercise_instructions_en ?? null);
  const instructionsRu = isCustom ? null : (we.exercise_instructions_ru ?? null);
  return {
    isCustom,
    name,
    gifUrl,
    imageUrl,
    photoKey,
    target,
    equipment,
    instructionsEn,
    instructionsRu,
    exerciseId: we.exercise_id ?? null,
  };
}

function parseInstructionList(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|\.\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10);
}

function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function sanitizeRestSeconds(value: number): number {
  if (!Number.isFinite(value)) return 90;
  return Math.min(1800, Math.max(15, Math.round(value)));
}

type SetPatchPayload = Partial<{
  weight: number;
  reps: number;
  rest_seconds: number;
  rir: number;
  completed: boolean;
}>;

type OfflineWorkoutMutation =
  | {
      id: string;
      kind: "set-patch";
      workoutId: number;
      workoutExerciseId: number;
      setId: number;
      payload: SetPatchPayload;
      createdAt: number;
    }
  | {
      id: string;
      kind: "complete-workout";
      workoutId: number;
      duration_minutes?: number;
      createdAt: number;
    };

const OFFLINE_WORKOUT_QUEUE_KEY = "df_workout_offline_queue_v1";

function readOfflineWorkoutQueue(): OfflineWorkoutMutation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(OFFLINE_WORKOUT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as OfflineWorkoutMutation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeOfflineWorkoutQueue(queue: OfflineWorkoutMutation[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OFFLINE_WORKOUT_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore localStorage write failures.
  }
}

function enqueueOfflineMutation(mutation: OfflineWorkoutMutation): void {
  const queue = readOfflineWorkoutQueue();
  queue.push(mutation);
  writeOfflineWorkoutQueue(queue);
}

function createOfflineMutationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isNetworkLikeError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof ApiClientError) {
    return error.status == null;
  }
  return error instanceof TypeError;
}

function RestTimerCard({
  durationSeconds,
  remainingSeconds,
  isRunning,
  autoStart,
  onDurationChange,
  onStart,
  onPause,
  onReset,
  onAutoStartChange,
}: {
  durationSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  autoStart: boolean;
  onDurationChange: (seconds: number) => void;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  onAutoStartChange: (next: boolean) => void;
}) {
  return (
    <Card>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-sm)" }}>
        <h3 style={{ margin: 0 }}>Таймер отдыха</h3>
        <span className="text-muted" style={{ fontSize: "var(--font-sm)" }}>
          {isRunning ? "Идёт" : "Пауза"}
        </span>
      </div>

      <div style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "var(--space-sm)", letterSpacing: "0.02em" }}>
        {formatTimer(remainingSeconds)}
      </div>

      <div className="row" style={{ gap: "8px", flexWrap: "wrap", marginBottom: "var(--space-sm)" }}>
        {[60, 90, 120, 180].map((preset) => (
          <button
            key={preset}
            type="button"
            className={`btn-segment${durationSeconds === preset ? " is-active" : ""}`}
            onClick={() => onDurationChange(preset)}
          >
            {preset}с
          </button>
        ))}
        <input
          className="set-input"
          type="number"
          min={15}
          max={1800}
          step={5}
          value={durationSeconds}
          onChange={(e) => onDurationChange(Number(e.target.value))}
          style={{ width: 96 }}
          title="Длительность отдыха в секундах"
        />
      </div>

      <div className="row" style={{ gap: "8px", flexWrap: "wrap", marginBottom: "var(--space-sm)" }}>
        <Button type="button" onClick={onStart}>
          ▶ Старт таймера
        </Button>
        <Button type="button" className="btn-ghost" onClick={onPause} disabled={!isRunning}>
          ⏸ Пауза
        </Button>
        <Button type="button" className="btn-ghost" onClick={onReset}>
          ↺ Сброс
        </Button>
      </div>

      <label className="text-muted" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: "var(--font-sm)" }}>
        <input
          type="checkbox"
          checked={autoStart}
          onChange={(e) => onAutoStartChange(e.target.checked)}
        />
        Автостарт после отметки подхода
      </label>
    </Card>
  );
}

function getSuggestedSetValues(we: WorkoutExerciseEntry): {
  weight: number | null;
  reps: number | null;
  source: "current" | "history" | null;
} {
  const current = [...we.sets]
    .reverse()
    .find((s) => s.weight != null || s.reps != null);

  if (current) {
    return {
      weight: current.weight,
      reps: current.reps,
      source: "current",
    };
  }

  if (we.last_weight != null || we.last_reps != null) {
    return {
      weight: we.last_weight ?? null,
      reps: we.last_reps ?? null,
      source: "history",
    };
  }

  return { weight: null, reps: null, source: null };
}

function WorkoutExercisePreviewModal({
  exercise,
  onClose,
}: {
  exercise: WorkoutExerciseEntry;
  onClose: () => void;
}) {
  const resolved = resolveExercise(exercise);
  const exerciseId = resolved.exerciseId ?? undefined;
  const { data: baseExercise, isLoading } = useExercise(exerciseId ? String(exerciseId) : undefined);
  const enrich = useEnrichExercise(exerciseId);
  const [showGif, setShowGif] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const enriched = enrich.data as EnrichedExercise | undefined;
  const details = enriched ?? baseExercise;

  const title = details?.name_ru ?? details?.name_en ?? resolved.name;
  const photoUrl = resolved.photoKey ? `/api/uploads/photo/${resolved.photoKey}` : null;
  const gifUrl = details?.gif_url ?? resolved.gifUrl;
  const staticImageUrl = photoUrl ?? details?.image_url ?? resolved.imageUrl;
  const hasRuInstructions = Boolean(details?.instructions_ru ?? resolved.instructionsRu);
  const hasStaticImage = Boolean(staticImageUrl);

  useEffect(() => {
    setAutoTriggered(false);
  }, [exerciseId]);

  useEffect(() => {
    const shouldAutoEnrich = Boolean(
      exerciseId &&
      !resolved.isCustom &&
      (!hasRuInstructions || !hasStaticImage)
    );

    if (!shouldAutoEnrich || autoTriggered || enrich.isPending) return;
    setAutoTriggered(true);
    enrich.mutate();
  }, [exerciseId, resolved.isCustom, hasRuInstructions, hasStaticImage, autoTriggered, enrich]);

  const instructions = parseInstructionList(
    details?.instructions_ru ??
      details?.instructions_en ??
      resolved.instructionsRu ??
      resolved.instructionsEn
  );

  return (
    <div className="wd-preview-overlay" onClick={onClose}>
      <div className="wd-preview" onClick={(e) => e.stopPropagation()}>
        <div className="wd-preview-header">
          <span className="wd-preview-title">Описание упражнения</span>
          <button type="button" className="wd-preview-close" onClick={onClose}>✕</button>
        </div>

        <div className="stack" style={{ gap: "var(--space-sm)" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>

          {isLoading && exerciseId ? (
            <p className="text-muted">Загрузка…</p>
          ) : (
            <>
              {showGif && gifUrl ? (
                <img src={gifUrl} alt={title} className="wd-preview-media" />
              ) : staticImageUrl ? (
                <img src={staticImageUrl} alt={title} className="wd-preview-media" />
              ) : (
                <div className="wd-preview-placeholder">🏋️</div>
              )}

              <div className="row" style={{ gap: "6px", flexWrap: "wrap" }}>
                {(details?.target ?? resolved.target) && (
                  <span className="exercise-tag">{details?.target ?? resolved.target}</span>
                )}
                {(details?.equipment ?? resolved.equipment) && (
                  <span className="exercise-tag tag-secondary">{details?.equipment ?? resolved.equipment}</span>
                )}
              </div>

              {instructions.length > 0 ? (
                <div className="exercise-instructions" style={{ marginTop: 0 }}>
                  <h3>Техника выполнения</h3>
                  <ol>
                    {instructions.map((item, idx) => (
                      <li key={`${item}-${idx}`}>{item}</li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="text-muted">Описание пока не найдено.</p>
              )}

              {gifUrl && (
                <Button
                  type="button"
                  className="enrich-gif-btn"
                  onClick={() => setShowGif((prev) => !prev)}
                >
                  {showGif ? "🖼 Показать картинку" : "▶ Показать GIF"}
                </Button>
              )}

              {!gifUrl && exerciseId && (
                <Button
                  type="button"
                  className="enrich-gif-btn"
                  onClick={() => enrich.mutate()}
                  disabled={enrich.isPending}
                >
                  {enrich.isPending ? "⏳ Загружаем данные…" : "✨ Подгрузить GIF и описание"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Set Row ──────────────────────────────────────────────────────────────────

function SetRow({
  s,
  workoutId,
  weId,
  onCompleted,
  onQueueSetPatch,
}: {
  s: WorkoutSet;
  workoutId: number;
  weId: number;
  onCompleted?: () => void;
  onQueueSetPatch: (params: { workoutExerciseId: number; setId: number; payload: SetPatchPayload }) => void;
}) {
  const updateSet = useUpdateSet(workoutId, weId);
  const deleteSet = useDeleteSet(workoutId, weId);
  const [weight, setWeight] = useState(s.weight != null ? String(s.weight) : "");
  const [reps, setReps] = useState(s.reps != null ? String(s.reps) : "");
  const [rowError, setRowError] = useState("");

  useEffect(() => {
    setWeight(s.weight != null ? String(s.weight) : "");
  }, [s.weight]);

  useEffect(() => {
    setReps(s.reps != null ? String(s.reps) : "");
  }, [s.reps]);

  const flush = async () => {
    setRowError("");
    const nextWeight = weight ? parseFloat(weight) : undefined;
    const nextReps = reps ? parseInt(reps, 10) : undefined;
    const hasSameWeight = (nextWeight ?? null) === (s.weight ?? null);
    const hasSameReps = (nextReps ?? null) === (s.reps ?? null);
    if (hasSameWeight && hasSameReps) return;

    const payload: SetPatchPayload = {
      weight: nextWeight,
      reps: nextReps,
    };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      onQueueSetPatch({ workoutExerciseId: weId, setId: s.id, payload });
      setRowError("Нет сети: изменение поставлено в очередь синхронизации");
      return;
    }

    try {
      await updateSet.mutateAsync({ setId: s.id, payload });
    } catch (err) {
      if (isNetworkLikeError(err)) {
        onQueueSetPatch({ workoutExerciseId: weId, setId: s.id, payload });
        setRowError("Нет сети: изменение поставлено в очередь синхронизации");
        return;
      }
      setRowError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
    }
  };

  const toggleComplete = async () => {
    setRowError("");
    const nextCompleted = !s.completed;
    const payload: SetPatchPayload = { completed: nextCompleted };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      onQueueSetPatch({ workoutExerciseId: weId, setId: s.id, payload });
      if (nextCompleted) onCompleted?.();
      setRowError("Нет сети: отметка подхода поставлена в очередь синхронизации");
      return;
    }

    try {
      await updateSet.mutateAsync({ setId: s.id, payload });
      if (nextCompleted) onCompleted?.();
    } catch (err) {
      if (isNetworkLikeError(err)) {
        onQueueSetPatch({ workoutExerciseId: weId, setId: s.id, payload });
        if (nextCompleted) onCompleted?.();
        setRowError("Нет сети: отметка подхода поставлена в очередь синхронизации");
        return;
      }
      setRowError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
    }
  };

  const onDelete = async () => {
    setRowError("");
    try {
      await deleteSet.mutateAsync(s.id);
    } catch (err) {
      if (isNetworkLikeError(err)) {
        setRowError("Нет сети: удаление подхода доступно только онлайн");
        return;
      }
      setRowError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
    }
  };

  return (
    <>
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
          onClick={onDelete}
          disabled={deleteSet.isPending}
          title="Удалить"
        >
          ✕
        </button>
      </div>
      {rowError && (
        <p className="text-muted" style={{ fontSize: "0.78rem", margin: "2px 0 4px 0" }}>
          {rowError}
        </p>
      )}
    </>
  );
}

// ─── Add Set Form ─────────────────────────────────────────────────────────────

function AddSetForm({ workoutId, we }: { workoutId: number; we: WorkoutExerciseEntry }) {
  const nextNum = (we.sets.length > 0 ? Math.max(...we.sets.map((s) => s.set_number)) : 0) + 1;
  const addSet = useAddSet(workoutId, we.id);
  const suggestion = getSuggestedSetValues(we);
  const suggestedWeight = suggestion.weight;
  const suggestedReps = suggestion.reps;

  const [weight, setWeight] = useState(
    suggestedWeight != null ? String(suggestedWeight) : ""
  );
  const [reps, setReps] = useState(
    suggestedReps != null ? String(suggestedReps) : ""
  );
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!weight && suggestedWeight != null) setWeight(String(suggestedWeight));
    if (!reps && suggestedReps != null) setReps(String(suggestedReps));
  }, [suggestedWeight, suggestedReps, weight, reps]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError("");

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSubmitError("Нет сети: новый подход можно добавить после восстановления соединения");
      return;
    }

    try {
      await addSet.mutateAsync({
        set_number: nextNum,
        weight: weight ? parseFloat(weight) : undefined,
        reps: reps ? parseInt(reps, 10) : undefined,
        completed: false,
      });
    } catch (err) {
      if (isNetworkLikeError(err)) {
        setSubmitError("Нет сети: новый подход можно добавить после восстановления соединения");
        return;
      }
      setSubmitError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
    }
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
      {suggestion.source === "history" && we.sets.length === 0 && (
        <span className="text-muted" style={{ fontSize: "0.78rem", marginLeft: "6px" }}>
          Подставлено из прошлой тренировки
        </span>
      )}
      {submitError && (
        <span className="text-muted" style={{ fontSize: "0.78rem", marginLeft: "6px" }}>
          {submitError}
        </span>
      )}
    </form>
  );
}

// ─── Exercise Block ───────────────────────────────────────────────────────────

function ExerciseBlock({
  we,
  workoutId,
  onPreview,
  onSetCompleted,
  onQueueSetPatch,
}: {
  we: WorkoutExerciseEntry;
  workoutId: number;
  onPreview: (exercise: WorkoutExerciseEntry) => void;
  onSetCompleted?: () => void;
  onQueueSetPatch: (params: { workoutExerciseId: number; setId: number; payload: SetPatchPayload }) => void;
}) {
  const removeExercise = useRemoveExerciseFromWorkout(workoutId);
  const [open, setOpen] = useState(true);
  const { isCustom, name, imageUrl, photoKey, target, equipment } = resolveExercise(we);

  const photoUrl = photoKey ? `/api/uploads/photo/${photoKey}` : null;
  const completedCount = we.sets.filter((s) => s.completed).length;

  return (
    <div className="wd-exercise-block">
      {/* Header */}
      <div className="wd-exercise-header" onClick={() => setOpen((v) => !v)}>
        {/* Media thumbnail */}
        <div className="wd-exercise-thumb">
          {photoUrl ? (
            <img src={photoUrl} alt={name} className="wd-exercise-thumb-img" />
          ) : imageUrl ? (
            <img src={imageUrl} alt={name} className="wd-exercise-thumb-img" />
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
            className="wd-exercise-preview"
            onClick={(e) => {
              e.stopPropagation();
              onPreview(we);
            }}
            title="Описание и иллюстрация"
          >
            👁
          </button>
          <button
            className="wd-exercise-del"
            onClick={(e) => { e.stopPropagation(); removeExercise.mutate(we.id); }}
            disabled={removeExercise.isPending}
            title="Удалить упражнение"
          >
            ⊖
          </button>
          <span className="wd-chevron">{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="wd-exercise-body">
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
                <SetRow
                  key={s.id}
                  s={s}
                  workoutId={workoutId}
                  weId={we.id}
                  onCompleted={onSetCompleted}
                  onQueueSetPatch={onQueueSetPatch}
                />
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
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { data: catalogData, isLoading: catalogLoading } = useExercises({ search: search || undefined, limit: 30 });
  const { data: favorites } = useFavorites();
  const { data: customData, isLoading: customLoading } = useCustomExercises();
  const addExercise = useAddExerciseToWorkout(workoutId);

  const favoriteExerciseIds = new Set(
    (favorites ?? [])
      .map((item) => item.exercise_id)
      .filter((id): id is number => typeof id === "number")
  );

  const catalogVisible = [...(catalogData?.exercises ?? [])]
    .sort((a, b) => Number(favoriteExerciseIds.has(b.id)) - Number(favoriteExerciseIds.has(a.id)))
    .filter((ex) => !favoritesOnly || favoriteExerciseIds.has(ex.id));

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

      {tab === "catalog" && (
        <div className="row" style={{ gap: "8px", marginBottom: "var(--space-sm)", flexWrap: "wrap" }}>
          <button
            className={`btn-segment${!favoritesOnly ? " is-active" : ""}`}
            onClick={() => setFavoritesOnly(false)}
          >
            Все
          </button>
          <button
            className={`btn-segment${favoritesOnly ? " is-active" : ""}`}
            onClick={() => setFavoritesOnly(true)}
          >
            ⭐ Избранные
          </button>
        </div>
      )}

      {/* Search */}
      <input
        className="input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tab === "catalog" ? "Поиск (рус/eng): жим лежа / bench press" : "Поиск по моим упражнениям…"}
        autoFocus
        style={{ marginBottom: "var(--space-sm)" }}
      />

      {/* Results */}
      <div className="exercise-search-results">
        {/* ── Catalog tab ── */}
        {tab === "catalog" && (
          <>
            {catalogLoading && <p className="text-muted">Загрузка…</p>}
            {!catalogLoading && catalogVisible.length === 0 && (
              <p className="text-muted">
                {favoritesOnly ? "В избранном пока пусто. Добавь упражнения в избранное в каталоге." : "Ничего не найдено"}
              </p>
            )}
            {catalogVisible.map((ex) => (
              <div
                key={ex.id}
                className="exercise-search-item"
                onClick={() => addCatalog(ex.id)}
              >
                {ex.gif_url && (
                  <img src={ex.gif_url} alt="" className="exercise-search-thumb" />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="exercise-search-name">
                    {favoriteExerciseIds.has(ex.id) ? "⭐ " : ""}
                    {ex.name_ru ?? ex.name_en}
                  </div>
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
  const workoutId = parseInt(id ?? "0", 10);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useWorkout(id);
  const deleteWorkout = useDeleteWorkout();
  const completeWorkout = useCompleteWorkout(workoutId);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<WorkoutExerciseEntry | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [completeError, setCompleteError] = useState("");
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncMessage, setSyncMessage] = useState("");
  const syncInFlightRef = useRef(false);
  const [startTime] = useState(() => Date.now());
  const [restDurationSeconds, setRestDurationSeconds] = useState(() => {
    const raw = localStorage.getItem("df_rest_seconds");
    return sanitizeRestSeconds(raw ? Number(raw) : 90);
  });
  const [restRemainingSeconds, setRestRemainingSeconds] = useState(() => {
    const raw = localStorage.getItem("df_rest_seconds");
    return sanitizeRestSeconds(raw ? Number(raw) : 90);
  });
  const [restRunning, setRestRunning] = useState(false);
  const [autoStartRestTimer, setAutoStartRestTimer] = useState(() => {
    const raw = localStorage.getItem("df_rest_auto_start");
    return raw == null ? true : raw === "1";
  });

  const refreshPendingSyncCount = useCallback(() => {
    const queue = readOfflineWorkoutQueue();
    setPendingSyncCount(queue.filter((item) => item.workoutId === workoutId).length);
  }, [workoutId]);

  const applyOptimisticSetPatch = useCallback((weId: number, setId: number, payload: SetPatchPayload) => {
    queryClient.setQueryData<Workout & { exercises: WorkoutExerciseEntry[] }>(
      ["workout", String(workoutId)],
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          exercises: prev.exercises.map((exercise) => {
            if (exercise.id !== weId) return exercise;
            return {
              ...exercise,
              sets: exercise.sets.map((set) => {
                if (set.id !== setId) return set;
                return {
                  ...set,
                  ...(payload.weight !== undefined ? { weight: payload.weight } : {}),
                  ...(payload.reps !== undefined ? { reps: payload.reps } : {}),
                  ...(payload.rest_seconds !== undefined ? { rest_seconds: payload.rest_seconds } : {}),
                  ...(payload.rir !== undefined ? { rir: payload.rir } : {}),
                  ...(payload.completed !== undefined ? { completed: payload.completed } : {}),
                };
              }),
            };
          }),
        };
      }
    );
  }, [queryClient, workoutId]);

  const applyOptimisticWorkoutComplete = useCallback((durationMinutes?: number) => {
    const completedAt = new Date().toISOString();

    queryClient.setQueryData<Workout & { exercises: WorkoutExerciseEntry[] }>(
      ["workout", String(workoutId)],
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          completed_at: completedAt,
          duration_minutes: durationMinutes ?? prev.duration_minutes,
        };
      }
    );

    queryClient.setQueryData<{ workouts: Workout[]; total: number }>(["workouts"], (prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        workouts: prev.workouts.map((workout) =>
          workout.id === workoutId
            ? {
                ...workout,
                completed_at: completedAt,
                duration_minutes: durationMinutes ?? workout.duration_minutes,
              }
            : workout
        ),
      };
    });
  }, [queryClient, workoutId]);

  const enqueueSetPatchMutation = useCallback((params: { workoutExerciseId: number; setId: number; payload: SetPatchPayload }) => {
    enqueueOfflineMutation({
      id: createOfflineMutationId(),
      kind: "set-patch",
      workoutId,
      workoutExerciseId: params.workoutExerciseId,
      setId: params.setId,
      payload: params.payload,
      createdAt: Date.now(),
    });

    applyOptimisticSetPatch(params.workoutExerciseId, params.setId, params.payload);
    setSyncMessage("Оффлайн: изменения сохранены и ждут синхронизации");
    refreshPendingSyncCount();
  }, [applyOptimisticSetPatch, refreshPendingSyncCount, workoutId]);

  const enqueueCompleteMutation = useCallback((durationMinutes?: number) => {
    enqueueOfflineMutation({
      id: createOfflineMutationId(),
      kind: "complete-workout",
      workoutId,
      duration_minutes: durationMinutes,
      createdAt: Date.now(),
    });

    applyOptimisticWorkoutComplete(durationMinutes);
    setSyncMessage("Оффлайн: завершение тренировки сохранено и ждёт синхронизации");
    refreshPendingSyncCount();
  }, [applyOptimisticWorkoutComplete, refreshPendingSyncCount, workoutId]);

  const flushOfflineMutations = useCallback(async () => {
    if (syncInFlightRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    let queue = readOfflineWorkoutQueue();
    if (queue.length === 0) {
      refreshPendingSyncCount();
      return;
    }

    syncInFlightRef.current = true;
    let hasSuccessfulSync = false;

    try {
      while (queue.length > 0) {
        const mutation = queue[0];

        try {
          if (mutation.kind === "set-patch") {
            await apiClient.patch<unknown>(
              `/workouts/exercises/${mutation.workoutExerciseId}/sets/${mutation.setId}`,
              mutation.payload
            );
          } else {
            await apiClient.post<unknown>(
              `/workouts/${mutation.workoutId}/complete`,
              mutation.duration_minutes != null ? { duration_minutes: mutation.duration_minutes } : {}
            );
          }
        } catch (err) {
          if (isNetworkLikeError(err)) {
            break;
          }

          setSyncMessage(`Часть оффлайн-изменений отклонена: ${toUserMessage(err)}`);
        }

        queue = queue.slice(1);
        writeOfflineWorkoutQueue(queue);
        hasSuccessfulSync = true;
      }

      if (hasSuccessfulSync) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["workouts"] }),
          queryClient.invalidateQueries({ queryKey: ["workout", String(workoutId)] }),
          queryClient.invalidateQueries({ queryKey: ["progress"] }),
          queryClient.invalidateQueries({ queryKey: ["stats"] }),
        ]);

        if (queue.length === 0) {
          setSyncMessage("Оффлайн-очередь синхронизирована");
        }
      }
    } finally {
      syncInFlightRef.current = false;
      refreshPendingSyncCount();
    }
  }, [queryClient, refreshPendingSyncCount, workoutId]);

  useEffect(() => {
    localStorage.setItem("df_rest_seconds", String(restDurationSeconds));
  }, [restDurationSeconds]);

  useEffect(() => {
    localStorage.setItem("df_rest_auto_start", autoStartRestTimer ? "1" : "0");
  }, [autoStartRestTimer]);

  useEffect(() => {
    if (restRunning) return;
    setRestRemainingSeconds(restDurationSeconds);
  }, [restDurationSeconds, restRunning]);

  useEffect(() => {
    if (!restRunning) return;
    const timerId = window.setInterval(() => {
      setRestRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(timerId);
          setRestRunning(false);
          if ("vibrate" in navigator) navigator.vibrate(120);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [restRunning]);

  useEffect(() => {
    const onOnline = () => {
      setIsOnline(true);
      void flushOfflineMutations();
    };
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushOfflineMutations]);

  useEffect(() => {
    refreshPendingSyncCount();
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void flushOfflineMutations();
    }
  }, [flushOfflineMutations, refreshPendingSyncCount]);

  useEffect(() => {
    if (!isOnline || pendingSyncCount <= 0) return;
    void flushOfflineMutations();
  }, [flushOfflineMutations, isOnline, pendingSyncCount]);

  const startRestTimer = (seconds?: number) => {
    const target = sanitizeRestSeconds(seconds ?? restDurationSeconds);
    if (seconds != null) setRestDurationSeconds(target);
    setRestRemainingSeconds(target);
    setRestRunning(true);
  };

  const onSetCompleted = () => {
    if (!autoStartRestTimer) return;
    startRestTimer();
  };

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

  const onComplete = async () => {
    setCompleteError("");
    if (!data || !confirm("Завершить тренировку?")) return;
    const duration = Math.round((Date.now() - startTime) / 60000);
    const durationMinutes = duration > 0 ? duration : undefined;

    if (!isOnline) {
      enqueueCompleteMutation(durationMinutes);
      navigate("/workouts");
      return;
    }

    try {
      await completeWorkout.mutateAsync(durationMinutes);
      navigate("/workouts");
    } catch (err) {
      if (isNetworkLikeError(err)) {
        enqueueCompleteMutation(durationMinutes);
        navigate("/workouts");
        return;
      }
      setCompleteError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
    }
  };

  if (isLoading) return <Card><p className="text-muted">Загрузка…</p></Card>;
  if (error || !data) return <Card><p className="text-error">Тренировка не найдена</p></Card>;

  const exercises = data.exercises ?? [];
  const totalSets = exercises.reduce((acc, e) => acc + e.sets.length, 0);
  const completedSets = exercises.reduce((acc, e) => acc + e.sets.filter((s) => s.completed).length, 0);

  return (
    <div className="stack">
      <RestTimerCard
        durationSeconds={restDurationSeconds}
        remainingSeconds={restRemainingSeconds}
        isRunning={restRunning}
        autoStart={autoStartRestTimer}
        onDurationChange={(seconds) => setRestDurationSeconds(sanitizeRestSeconds(seconds))}
        onStart={() => {
          if (restRemainingSeconds <= 0) {
            startRestTimer();
            return;
          }
          setRestRunning(true);
        }}
        onPause={() => setRestRunning(false)}
        onReset={() => {
          setRestRunning(false);
          setRestRemainingSeconds(restDurationSeconds);
        }}
        onAutoStartChange={setAutoStartRestTimer}
      />

      {(!isOnline || pendingSyncCount > 0 || syncMessage) && (
        <Card>
          {!isOnline ? (
            <p className="text-muted" style={{ margin: 0 }}>
              Оффлайн-режим: отметки подходов и завершение тренировки сохраняются локально.
            </p>
          ) : (
            <p className="text-muted" style={{ margin: 0 }}>
              Онлайн: оффлайн-очередь будет отправлена автоматически.
            </p>
          )}

          {pendingSyncCount > 0 && (
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-sm)", gap: "8px", flexWrap: "wrap" }}>
              <span className="text-muted">В очереди синхронизации: {pendingSyncCount}</span>
              <Button
                type="button"
                className="btn-ghost"
                onClick={() => void flushOfflineMutations()}
                disabled={!isOnline}
              >
                Синхронизировать сейчас
              </Button>
            </div>
          )}

          {syncMessage && (
            <p className="text-muted" style={{ marginTop: "var(--space-sm)", marginBottom: 0, fontSize: "var(--font-sm)" }}>
              {syncMessage}
            </p>
          )}
        </Card>
      )}

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
  {completeError && <p className="text-error" style={{ marginTop: "var(--space-sm)" }}>{completeError}</p>}

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
        <ExerciseBlock
          key={we.id}
          we={we}
          workoutId={data.id}
          onPreview={setPreviewExercise}
          onSetCompleted={onSetCompleted}
          onQueueSetPatch={enqueueSetPatchMutation}
        />
      ))}

      {previewExercise && (
        <WorkoutExercisePreviewModal
          exercise={previewExercise}
          onClose={() => setPreviewExercise(null)}
        />
      )}

      {/* Add Exercise Panel / Button */}
      {showAddExercise ? (
        <AddExercisePanel workoutId={data.id} onClose={() => setShowAddExercise(false)} />
      ) : (
        <button className="wd-add-exercise-btn" onClick={() => setShowAddExercise(true)}>
          <span style={{ fontSize: "1.3rem" }}>+</span>
          Добавить упражнение
        </button>
      )}

      {/* Finish workout */}
      {!data.completed_at && exercises.length > 0 && !showAddExercise && (
        <button
          className="wd-finish-btn"
          onClick={onComplete}
          disabled={completeWorkout.isPending}
        >
          {completeWorkout.isPending ? "Сохраняем…" : "✓ Закончить тренировку"}
        </button>
      )}
      {data.completed_at && (
        <div className="wd-completed-badge">
          ✅ Тренировка завершена · {new Date(data.completed_at).toLocaleDateString("ru-RU")}
        </div>
      )}
    </div>
  );
}
