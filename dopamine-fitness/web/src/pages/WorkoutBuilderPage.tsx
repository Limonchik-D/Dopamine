/**
 * WorkoutBuilderPage — offline-first план тренировки.
 * Пользователь набирает упражнения + подходы в памяти,
 * нажимает "Сохранить" → создаётся тренировка через API,
 * потом добавляются упражнения и подходы.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useCreateWorkout } from "../features/workouts/useWorkouts";
import { useExercises } from "../features/exercises/useExercises";
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

// ─── ExercisePicker ───────────────────────────────────────────────────────────

interface ExercisePickerProps {
  onPick: (name: string, exerciseId?: number, customExerciseId?: number) => void;
  onClose: () => void;
}

function ExercisePicker({ onPick, onClose }: ExercisePickerProps) {
  const [search, setSearch] = useState("");
  const { data: catalogData, isLoading: catalogLoading } = useExercises({ search: search || undefined, limit: 20 });
  const { data: customData, isLoading: customLoading } = useCustomExercises();

  const catalog = catalogData?.exercises ?? [];
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
          placeholder="Поиск…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

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
                  <span className="builder-picker-item-name">{ex.name_ru ?? ex.name_en}</span>
                  {ex.target && <span className="text-muted" style={{ fontSize: "var(--font-sm)" }}>{ex.target}</span>}
                </div>
              ))}
            </>
          )}

          {!isLoading && catalog.length === 0 && custom.length === 0 && (
            <p className="text-muted" style={{ padding: "8px 0" }}>Ничего не найдено</p>
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
  onAddSet: (id: number) => void;
  onDeleteSet: (exId: number, setId: number) => void;
  onChangeSet: (exId: number, setId: number, field: "reps" | "weight", val: string) => void;
}

function LocalExerciseCard({ ex, onRemove, onAddSet, onDeleteSet, onChangeSet }: ExerciseCardProps) {
  return (
    <div className="builder-exercise-card">
      <div className="builder-exercise-header">
        <span className="builder-exercise-name">{ex.name}</span>
        <button className="builder-exercise-remove" onClick={() => onRemove(ex.localId)} title="Удалить упражнение">✕</button>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export function WorkoutBuilderPage() {
  const navigate = useNavigate();
  const createWorkout = useCreateWorkout();

  // Plan fields
  const [planName, setPlanName] = useState("");
  const [planDesc, setPlanDesc] = useState("");
  const [planGoal, setPlanGoal] = useState<GoalType>("hypertrophy");
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));

  // Exercises in builder
  const [exercises, setExercises] = useState<LocalExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);

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
        Add Exercise
      </button>

      {/* Picker modal */}
      {showPicker && (
        <ExercisePicker onPick={onPickExercise} onClose={() => setShowPicker(false)} />
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
