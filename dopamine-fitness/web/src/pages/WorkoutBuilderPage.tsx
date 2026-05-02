/**
 * WorkoutBuilderPage — offline-first план тренировки.
 * Пользователь набирает упражнения + подходы в памяти,
 * нажимает "Сохранить" → создаётся тренировка через API,
 * потом добавляются упражнения и подходы.
 */
import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useCreateWorkout } from "../features/workouts/useWorkouts";
import { useExercise, useExercises, useEnrichExercise, useFavorites, type EnrichedExercise } from "../features/exercises/useExercises";
import { useCustomExercises } from "../features/exercises/useCustomExercises";
import { apiClient } from "../services/apiClient";
import { toUserMessage, toDiagnosticSuffix } from "../services/apiErrors";

// ─── Local types ──────────────────────────────────────────────────────────────

type GoalType = "strength" | "hypertrophy" | "endurance";

interface LocalSet {
  localId: number;
  reps: string;
  weight: string;
}

interface LocalExercise {
  localId: number;
  exerciseId?: number;
  customExerciseId?: number;
  name: string;
  sets: LocalSet[];
}

interface BuilderDraft {
  version: 1;
  savedAt: number;
  planName: string;
  planDesc: string;
  planGoal: GoalType;
  planDate: string;
  exercises: LocalExercise[];
}

let _setId = 0;
const newSet = (): LocalSet => ({ localId: ++_setId, reps: "", weight: "" });

let _exId = 0;
const newExercise = (name: string, exerciseId?: number, customExerciseId?: number): LocalExercise => ({
  localId: ++_exId,
  exerciseId,
  customExerciseId,
  name,
  sets: [newSet()],
});

const GOAL_LABELS: Record<GoalType, string> = {
  strength: "💪 Сила",
  hypertrophy: "🏋️ Масса",
  endurance: "🏃 Выносливость",
};

const BUILDER_DRAFT_KEY = "df_workout_builder_draft_v1";

function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function readBuilderDraft(): BuilderDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BUILDER_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuilderDraft>;
    if (parsed.version !== 1) return null;
    if (!Array.isArray(parsed.exercises)) return null;
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      planName: typeof parsed.planName === "string" ? parsed.planName : "",
      planDesc: typeof parsed.planDesc === "string" ? parsed.planDesc : "",
      planGoal: parsed.planGoal === "strength" || parsed.planGoal === "hypertrophy" || parsed.planGoal === "endurance"
        ? parsed.planGoal
        : "hypertrophy",
      planDate: typeof parsed.planDate === "string" && parsed.planDate.length >= 10
        ? parsed.planDate
        : getTodayIsoDate(),
      exercises: parsed.exercises as LocalExercise[],
    };
  } catch {
    return null;
  }
}

function writeBuilderDraft(draft: BuilderDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BUILDER_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore localStorage write failures (quota/private mode)
  }
}

function clearBuilderDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(BUILDER_DRAFT_KEY);
}

function parseInstructionList(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n|\.\s+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);
}

// ─── ExercisePicker ───────────────────────────────────────────────────────────

interface ExercisePickerProps {
  onPick: (name: string, exerciseId?: number, customExerciseId?: number) => void;
  onClose: () => void;
}

function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const { data: catalogData, isLoading: catalogLoading } = useExercises({ search: search || undefined, limit: 20 });
  const { data: favorites } = useFavorites();
  const { data: customData, isLoading: customLoading } = useCustomExercises();

  const favoriteExerciseIds = new Set(
    (favorites ?? [])
      .map((item) => item.exercise_id)
      .filter((id): id is number => typeof id === "number")
  );

  const catalog = [...(catalogData?.exercises ?? [])]
    .sort((a, b) => Number(favoriteExerciseIds.has(b.id)) - Number(favoriteExerciseIds.has(a.id)))
    .filter((ex) => !favoritesOnly || favoriteExerciseIds.has(ex.id));

  const custom = (customData ?? []).filter((ex) =>
    !search || ex.name.toLowerCase().includes(search.toLowerCase())
  );
  const isLoading = catalogLoading || customLoading;

  return (
    <div className="builder-picker-overlay" onClick={onClose}>
      <div className="builder-picker" onClick={(e) => e.stopPropagation()}>
        <div className="builder-picker-header">
          <span className="builder-picker-title">Выбрать упражнение</span>
          <button className="builder-picker-close" onClick={onClose}>✕</button>
        </div>

        <input
          className="input"
          placeholder="Поиск (рус/eng): жим лежа / bench press"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="row" style={{ gap: "8px", marginTop: "var(--space-sm)", flexWrap: "wrap" }}>
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

        <div className="builder-picker-list">
          {isLoading && <p className="text-muted" style={{ padding: "8px 0" }}>Загрузка…</p>}

          {custom.length > 0 && (
            <>
              <div className="builder-picker-section-label">Мои упражнения</div>
              {custom.map((ex) => (
                <div
                  key={`c${ex.id}`}
                  className="builder-picker-item"
                  onClick={() => { onPick(ex.name, undefined, ex.id); onClose(); }}
                >
                  <span className="builder-picker-item-name">{ex.name}</span>
                  {ex.target && <span className="text-muted" style={{ fontSize: "var(--font-sm)" }}>{ex.target}</span>}
                </div>
              ))}
            </>
          )}

          {catalog.length > 0 && (
            <>
              <div className="builder-picker-section-label">Каталог</div>
              {catalog.map((ex) => (
                <div
                  key={`e${ex.id}`}
                  className="builder-picker-item"
                  onClick={() => { onPick(ex.name_ru ?? ex.name_en, ex.id); onClose(); }}
                >
                  <span className="builder-picker-item-name">
                    {favoriteExerciseIds.has(ex.id) ? "⭐ " : ""}
                    {ex.name_ru ?? ex.name_en}
                  </span>
                  {ex.target && <span className="text-muted" style={{ fontSize: "var(--font-sm)" }}>{ex.target}</span>}
                </div>
              ))}
            </>
          )}

          {!isLoading && catalog.length === 0 && custom.length === 0 && (
            <p className="text-muted" style={{ padding: "8px 0" }}>
              {favoritesOnly ? "В избранном пока пусто" : "Ничего не найдено"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SetRow ───────────────────────────────────────────────────────────────────

interface SetRowProps {
  set: LocalSet;
  index: number;
  onChange: (id: number, field: "reps" | "weight", val: string) => void;
  onDelete: (id: number) => void;
}

function LocalSetRow({ set, index, onChange, onDelete }: SetRowProps) {
  return (
    <div className="builder-set-row">
      <span className="builder-set-num">Set {index + 1}</span>
      <input
        className="set-input"
        type="number"
        min="0"
        step="1"
        placeholder="Reps"
        value={set.reps}
        onChange={(e) => onChange(set.localId, "reps", e.target.value)}
      />
      <input
        className="set-input"
        type="number"
        min="0"
        step="0.5"
        placeholder="kg"
        value={set.weight}
        onChange={(e) => onChange(set.localId, "weight", e.target.value)}
      />
      <button className="builder-set-delete" onClick={() => onDelete(set.localId)} title="Удалить подход">✕</button>
    </div>
  );
}

// ─── ExerciseCard ─────────────────────────────────────────────────────────────

interface ExerciseCardProps {
  ex: LocalExercise;
  onRemove: (id: number) => void;
  onPreview: (exercise: LocalExercise) => void;
  onAddSet: (id: number) => void;
  onDeleteSet: (exId: number, setId: number) => void;
  onChangeSet: (exId: number, setId: number, field: "reps" | "weight", val: string) => void;
}

function LocalExerciseCard({ ex, onRemove, onPreview, onAddSet, onDeleteSet, onChangeSet }: ExerciseCardProps) {
  return (
    <div className="builder-exercise-card">
      <div className="builder-exercise-header">
        <span className="builder-exercise-name">{ex.name}</span>
        <div className="builder-exercise-actions">
          <button
            type="button"
            className="builder-exercise-preview"
            onClick={() => onPreview(ex)}
            title="Посмотреть упражнение"
          >
            👁
          </button>
          <button
            type="button"
            className="builder-exercise-remove"
            onClick={() => onRemove(ex.localId)}
            title="Убрать упражнение"
          >
            ⊖
          </button>
        </div>
      </div>

      <div className="builder-sets-list">
        <div className="builder-sets-header">
          <span>Подход</span>
          <span>Повт.</span>
          <span>Вес (кг)</span>
          <span></span>
        </div>
        {ex.sets.map((s, i) => (
          <LocalSetRow
            key={s.localId}
            set={s}
            index={i}
            onChange={(sid, field, val) => onChangeSet(ex.localId, sid, field, val)}
            onDelete={(sid) => onDeleteSet(ex.localId, sid)}
          />
        ))}
      </div>

      <Button
        className="btn-accent-outline"
        style={{ marginTop: "var(--space-sm)", width: "100%" }}
        onClick={() => onAddSet(ex.localId)}
      >
        + Добавить подход
      </Button>
    </div>
  );
}

interface ExercisePreviewModalProps {
  exercise: LocalExercise;
  onClose: () => void;
}

function ExercisePreviewModal({ exercise, onClose }: ExercisePreviewModalProps) {
  const { data: customExercises } = useCustomExercises();
  const { data: baseExercise, isLoading } = useExercise(
    exercise.exerciseId ? String(exercise.exerciseId) : undefined
  );
  const enrich = useEnrichExercise(exercise.exerciseId);

  const enriched = enrich.data as EnrichedExercise | undefined;
  const details = enriched ?? baseExercise;
  const customExercise = customExercises?.find((item) => item.id === exercise.customExerciseId);

  const title = details?.name_ru ?? details?.name_en ?? customExercise?.name ?? exercise.name;
  const imageUrl = details?.gif_url ?? details?.image_url ?? null;
  const customPhotoUrl = customExercise?.photo_r2_key
    ? `/api/uploads/media/${customExercise.photo_r2_key}`
    : null;
  const instructions = parseInstructionList(
    details?.instructions_ru ?? details?.instructions_en ?? customExercise?.description
  );

  const showEnrichButton = Boolean(
    exercise.exerciseId &&
      !enrich.isPending &&
      (!details?.gif_url || (!details?.instructions_ru && !details?.instructions_en))
  );

  return (
    <div className="builder-preview-overlay" onClick={onClose}>
      <div className="builder-preview" onClick={(e) => e.stopPropagation()}>
        <div className="builder-picker-header">
          <span className="builder-picker-title">Просмотр упражнения</span>
          <button type="button" className="builder-picker-close" onClick={onClose}>✕</button>
        </div>

        <div className="stack" style={{ gap: "var(--space-sm)" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>

          {isLoading && exercise.exerciseId ? (
            <p className="text-muted">Загрузка…</p>
          ) : (
            <>
              {imageUrl ? (
                <img src={imageUrl} alt={title} className="builder-preview-media" />
              ) : customPhotoUrl ? (
                <img src={customPhotoUrl} alt={title} className="builder-preview-media" />
              ) : (
                <div className="builder-preview-placeholder">🏋️</div>
              )}

              <div className="row" style={{ gap: "6px" }}>
                {details?.target && <span className="exercise-tag">{details.target}</span>}
                {details?.equipment && <span className="exercise-tag tag-secondary">{details.equipment}</span>}
                {!details && customExercise?.target && <span className="exercise-tag">{customExercise.target}</span>}
                {!details && customExercise?.equipment && <span className="exercise-tag tag-secondary">{customExercise.equipment}</span>}
              </div>

              {instructions.length > 0 ? (
                <div className="exercise-instructions" style={{ marginTop: 0 }}>
                  <h3>Описание / техника</h3>
                  <ol>
                    {instructions.map((item, idx) => (
                      <li key={`${item}-${idx}`}>{item}.</li>
                    ))}
                  </ol>
                </div>
              ) : (
                <p className="text-muted">Описание пока не найдено.</p>
              )}

              {showEnrichButton && (
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function WorkoutBuilderPage() {
  const navigate = useNavigate();
  const createWorkout = useCreateWorkout();
  const restoredDraft = useState(() => readBuilderDraft())[0];
  const [isOnline, setIsOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [draftNotice, setDraftNotice] = useState(() =>
    restoredDraft?.savedAt
      ? `Черновик восстановлен (${new Date(restoredDraft.savedAt).toLocaleString("ru-RU")})`
      : ""
  );

  // Plan fields
  const [planName, setPlanName] = useState(restoredDraft?.planName ?? "");
  const [planDesc, setPlanDesc] = useState(restoredDraft?.planDesc ?? "");
  const [planGoal, setPlanGoal] = useState<GoalType>(restoredDraft?.planGoal ?? "hypertrophy");
  const [planDate, setPlanDate] = useState(restoredDraft?.planDate ?? getTodayIsoDate());

  // Exercises in builder
  const [exercises, setExercises] = useState<LocalExercise[]>(restoredDraft?.exercises ?? []);
  const [showPicker, setShowPicker] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<LocalExercise | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const maxExerciseId = exercises.reduce((max, ex) => Math.max(max, ex.localId), 0);
    const maxSetId = exercises.reduce(
      (max, ex) => Math.max(max, ...ex.sets.map((s) => s.localId), 0),
      0
    );
    _exId = Math.max(_exId, maxExerciseId);
    _setId = Math.max(_setId, maxSetId);
  }, [exercises]);

  useEffect(() => {
    if (saved) return;

    const hasContent = Boolean(planName.trim() || planDesc.trim() || exercises.length > 0);
    const saveTimer = window.setTimeout(() => {
      if (!hasContent) {
        clearBuilderDraft();
        return;
      }
      writeBuilderDraft({
        version: 1,
        savedAt: Date.now(),
        planName,
        planDesc,
        planGoal,
        planDate,
        exercises,
      });
    }, 250);

    return () => window.clearTimeout(saveTimer);
  }, [planName, planDesc, planGoal, planDate, exercises, saved]);

  const resetDraft = useCallback(() => {
    clearBuilderDraft();
    setPlanName("");
    setPlanDesc("");
    setPlanGoal("hypertrophy");
    setPlanDate(getTodayIsoDate());
    setExercises([]);
    setPreviewExercise(null);
    setSaveError("");
    setDraftNotice("");
  }, []);

  const saveDraftNow = useCallback(() => {
    const hasContent = Boolean(planName.trim() || planDesc.trim() || exercises.length > 0);
    if (!hasContent) {
      setDraftNotice("Нечего сохранять: добавь название или упражнения");
      return;
    }

    writeBuilderDraft({
      version: 1,
      savedAt: Date.now(),
      planName,
      planDesc,
      planGoal,
      planDate,
      exercises,
    });
    setDraftNotice(`Черновик сохранён (${new Date().toLocaleString("ru-RU")})`);
  }, [planName, planDesc, planGoal, planDate, exercises]);

  const restoreDraftNow = useCallback(() => {
    const draft = readBuilderDraft();
    if (!draft) {
      setDraftNotice("Сохранённый черновик не найден");
      return;
    }
    setPlanName(draft.planName);
    setPlanDesc(draft.planDesc);
    setPlanGoal(draft.planGoal);
    setPlanDate(draft.planDate);
    setExercises(draft.exercises);
    setSaveError("");
    setDraftNotice(`Черновик восстановлен (${new Date(draft.savedAt).toLocaleString("ru-RU")})`);
  }, []);

  // ── Exercise mutations ── (created after workout is saved)
  // We do them imperatively inside onSave to keep the flow serial.

  const onPickExercise = useCallback((name: string, exerciseId?: number, customExerciseId?: number) => {
    setExercises((prev) => [...prev, newExercise(name, exerciseId, customExerciseId)]);
  }, []);

  const onRemoveExercise = useCallback((localId: number) => {
    setExercises((prev) => prev.filter((e) => e.localId !== localId));
  }, []);

  const onAddSet = useCallback((exLocalId: number) => {
    setExercises((prev) =>
      prev.map((e) => e.localId === exLocalId ? { ...e, sets: [...e.sets, newSet()] } : e)
    );
  }, []);

  const onDeleteSet = useCallback((exLocalId: number, setLocalId: number) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.localId === exLocalId
          ? { ...e, sets: e.sets.filter((s) => s.localId !== setLocalId) }
          : e
      )
    );
  }, []);

  const onChangeSet = useCallback((exLocalId: number, setLocalId: number, field: "reps" | "weight", val: string) => {
    setExercises((prev) =>
      prev.map((e) =>
        e.localId === exLocalId
          ? { ...e, sets: e.sets.map((s) => s.localId === setLocalId ? { ...s, [field]: val } : s) }
          : e
      )
    );
  }, []);

  const onSave = async () => {
    if (!planName.trim()) return;
    setSaveError("");
    setSaving(true);

    try {
      // 1. Create workout
      const goalDescriptions: Record<GoalType, string> = { strength: "Сила", hypertrophy: "Масса", endurance: "Выносливость" };
      const workout = await createWorkout.mutateAsync({
        name: planName.trim(),
        workout_date: planDate,
        description: planDesc.trim() || goalDescriptions[planGoal],
      });

      const workoutId = workout.id;

      // 2. Add exercises serially
      for (let ei = 0; ei < exercises.length; ei++) {
        const ex = exercises[ei];
        const weData = await apiClient.post<{ id: number }>(
          `/workouts/${workoutId}/exercises`,
          {
            exercise_id: ex.exerciseId ?? null,
            custom_exercise_id: ex.customExerciseId ?? null,
            order_index: ei,
          }
        );
        const weId = weData.id;
        if (!weId) continue;

        // 3. Add sets for this exercise
        for (let si = 0; si < ex.sets.length; si++) {
          const s = ex.sets[si];
          await apiClient.post(`/workouts/exercises/${weId}/sets`, {
            set_number: si + 1,
            reps: s.reps ? parseInt(s.reps, 10) : null,
            weight: s.weight ? parseFloat(s.weight) : null,
            completed: false,
          });
        }
      }

      clearBuilderDraft();
      setDraftNotice("");
      setSaved(true);
      setTimeout(() => navigate(`/workouts/${workoutId}`), 1800);
    } catch (err) {
      setSaveError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
      setSaving(false);
    }
  };

  // ── Success screen ─────────────────────────────────────────────────────────
  if (saved) {
    return (
      <div className="builder-success">
        <div className="builder-success-icon">✓</div>
        <h2 className="builder-success-title">План сохранён!</h2>
        <p className="text-muted">Переход к тренировке…</p>
      </div>
    );
  }

  // ── Main builder ───────────────────────────────────────────────────────────
  return (
    <div className="stack">
      {/* Header */}
      <Card>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2>Новый план тренировки</h2>
          <button className="builder-back-btn" onClick={() => navigate("/workouts")}>← Назад</button>
        </div>
        {!isOnline && (
          <p className="text-muted" style={{ marginTop: "var(--space-sm)", color: "#f59e0b" }}>
            Оффлайн-режим: черновик сохраняется локально. Отправишь на сервер, когда вернётся сеть.
          </p>
        )}
        {(draftNotice || exercises.length > 0 || planName.trim() || planDesc.trim()) && (
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)", marginTop: "var(--space-sm)", flexWrap: "wrap" }}>
            <span className="text-muted" style={{ fontSize: "var(--font-sm)" }}>
              {draftNotice || "Черновик сохраняется автоматически"}
            </span>
            <div className="row" style={{ gap: "8px", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={saveDraftNow} type="button">
                Сохранить черновик
              </button>
              <button className="btn btn-ghost" onClick={restoreDraftNow} type="button">
                Восстановить
              </button>
              <button className="btn btn-ghost" onClick={resetDraft} type="button">
                Очистить
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Plan meta */}
      <Card>
        <div className="stack">
          <div className="builder-field-group">
            <label className="builder-label">Название плана *</label>
            <input
              className="input"
              placeholder="Например: Push Day A"
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
            />
          </div>

          <div className="builder-field-group">
            <label className="builder-label">Описание</label>
            <input
              className="input"
              placeholder="Необязательно"
              value={planDesc}
              onChange={(e) => setPlanDesc(e.target.value)}
            />
          </div>

          <div className="builder-field-group">
            <label className="builder-label">Цель</label>
            <div className="row period-switcher">
              {(Object.entries(GOAL_LABELS) as [GoalType, string][]).map(([key, label]) => (
                <button
                  key={key}
                  className={`btn-segment${planGoal === key ? " is-active" : ""}`}
                  onClick={() => setPlanGoal(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="builder-field-group">
            <label className="builder-label">Дата</label>
            <input
              className="input"
              type="date"
              value={planDate}
              onChange={(e) => setPlanDate(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Exercises */}
      {exercises.length > 0 && (
        <div className="stack">
          {exercises.map((ex) => (
            <LocalExerciseCard
              key={ex.localId}
              ex={ex}
              onRemove={onRemoveExercise}
              onPreview={setPreviewExercise}
              onAddSet={onAddSet}
              onDeleteSet={onDeleteSet}
              onChangeSet={onChangeSet}
            />
          ))}
        </div>
      )}

      {/* Add Exercise button */}
      <button className="builder-add-exercise-btn" onClick={() => setShowPicker(true)}>
        <span className="builder-add-icon">+</span>
        Добавить упражнение
      </button>

      {/* Picker modal */}
      {showPicker && (
        <ExercisePicker onPick={onPickExercise} onClose={() => setShowPicker(false)} />
      )}

      {previewExercise && (
        <ExercisePreviewModal
          exercise={previewExercise}
          onClose={() => setPreviewExercise(null)}
        />
      )}

      {/* Save */}
      {saveError && <Card><p className="text-error">{saveError}</p></Card>}

      <Button
        className="btn-primary builder-save-btn"
        onClick={onSave}
        disabled={saving || !planName.trim()}
      >
        {saving ? "Сохранение…" : "💾 Сохранить план"}
      </Button>
    </div>
  );
}
