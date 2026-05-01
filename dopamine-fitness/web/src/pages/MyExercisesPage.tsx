import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  useCustomExercises,
  useCreateCustomExercise,
  useUpdateCustomExercise,
  useDeleteCustomExercise,
  useUploadExercisePhoto,
  type CustomExercise,
  type CreateCustomExerciseInput,
} from "../features/exercises/useCustomExercises";
import { toUserMessage, toDiagnosticSuffix } from "../services/apiErrors";
import "../styles/my-exercises.css";

const MUSCLE_OPTIONS = [
  "chest", "back", "shoulders", "biceps", "triceps",
  "forearms", "core", "glutes", "quads", "hamstrings",
  "calves", "full body", "cardio",
];

const EQUIPMENT_OPTIONS = [
  "barbell", "dumbbell", "cable", "machine", "kettlebell",
  "resistance band", "bodyweight", "pull-up bar", "bench", "other",
];

// ─── Photo Upload Field ───────────────────────────────────────────────────────

function PhotoUploadField({
  currentUrl,
  onUploaded,
  customExerciseId,
}: {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  customExerciseId?: number;
}) {
  const upload = useUploadExercisePhoto();
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const onChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Максимальный размер фото — 5 МБ");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Допустимы только изображения");
      return;
    }

    setError("");
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);

    try {
      const result = await upload.mutateAsync({ file, customExerciseId });
      onUploaded(result.url);
    } catch (err) {
      setError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
      setPreview(currentUrl ?? null);
    }
  };

  return (
    <div className="form-field">
      <label>Фото упражнения</label>
      <div className={`photo-upload-area${preview ? " has-file" : ""}`}>
        <input
          ref={inputRef}
          className="photo-upload-input"
          type="file"
          accept="image/*"
          onChange={onChange}
        />
        {preview ? (
          <>
            <img src={preview} alt="Превью" className="photo-preview" />
            <p className="photo-upload-hint" style={{ marginTop: "var(--space-xs)" }}>
              Нажми, чтобы заменить
            </p>
          </>
        ) : (
          <>
            <div className="photo-upload-icon">📷</div>
            <p className="photo-upload-hint">
              <strong>Нажми</strong> или перетащи фото
            </p>
            <p className="photo-upload-hint">JPG, PNG, WebP · до 5 МБ</p>
          </>
        )}
        {upload.isPending && (
          <div className="upload-progress">
            <div className="upload-progress-bar" style={{ width: "70%" }} />
          </div>
        )}
      </div>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

// ─── Create Form ──────────────────────────────────────────────────────────────

function CreateExerciseForm({ onCreated }: { onCreated: () => void }) {
  const create = useCreateCustomExercise();
  const uploadPhoto = useUploadExercisePhoto();
  const [form, setForm] = useState<CreateCustomExerciseInput>({
    name: "", description: "", target: "", equipment: "",
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const set = (key: keyof CreateCustomExerciseInput, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  const onPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setPhotoError("Максимум 5 МБ"); return; }
    if (!file.type.startsWith("image/")) { setPhotoError("Только изображения"); return; }
    setPhotoError("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError("");

    try {
      const exercise = await create.mutateAsync({
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        target: form.target?.trim() || undefined,
        equipment: form.equipment?.trim() || undefined,
      });

      // Загружаем фото если выбрано
      if (photoFile) {
        await uploadPhoto.mutateAsync({ file: photoFile, customExerciseId: exercise.id });
      }

      setForm({ name: "", description: "", target: "", equipment: "" });
      setPhotoFile(null);
      setPhotoPreview(null);
      if (inputRef.current) inputRef.current.value = "";
      onCreated();
    } catch (err) {
      setError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
    }
  };

  const isPending = create.isPending || uploadPhoto.isPending;

  return (
    <form onSubmit={onSubmit} className="create-exercise-form">
      <div className="form-row">
        <div className="form-field">
          <label>Название *</label>
          <input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Например: Тяга резинки"
            required
          />
        </div>
        <div className="form-field">
          <label>Группа мышц</label>
          <select
            className="filter-select"
            value={form.target ?? ""}
            onChange={(e) => set("target", e.target.value)}
          >
            <option value="">— Выбери —</option>
            {MUSCLE_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-field">
          <label>Оборудование</label>
          <select
            className="filter-select"
            value={form.equipment ?? ""}
            onChange={(e) => set("equipment", e.target.value)}
          >
            <option value="">— Выбери —</option>
            {EQUIPMENT_OPTIONS.map((eq) => (
              <option key={eq} value={eq}>{eq}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Описание</label>
          <textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Техника, особенности…"
          />
        </div>
      </div>

      {/* Photo Upload */}
      <div className="form-field">
        <label>Фото упражнения</label>
        <div className={`photo-upload-area${photoPreview ? " has-file" : ""}`}>
          <input
            ref={inputRef}
            className="photo-upload-input"
            type="file"
            accept="image/*"
            onChange={onPhotoChange}
          />
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="Превью" className="photo-preview" />
              <p className="photo-upload-hint" style={{ marginTop: "var(--space-xs)" }}>
                Нажми, чтобы заменить
              </p>
            </>
          ) : (
            <>
              <div className="photo-upload-icon">📷</div>
              <p className="photo-upload-hint"><strong>Нажми</strong> или перетащи фото</p>
              <p className="photo-upload-hint">JPG, PNG, WebP · до 5 МБ</p>
            </>
          )}
          {uploadPhoto.isPending && (
            <div className="upload-progress">
              <div className="upload-progress-bar" style={{ width: "70%" }} />
            </div>
          )}
        </div>
        {photoError && <p className="error-text">{photoError}</p>}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="row">
        <Button type="submit" disabled={isPending || !form.name.trim()}>
          {isPending ? "Создание…" : "Создать упражнение"}
        </Button>
      </div>
    </form>
  );
}

// ─── Edit Form (inline) ───────────────────────────────────────────────────────

function EditExerciseForm({
  ex,
  onDone,
}: {
  ex: CustomExercise;
  onDone: () => void;
}) {
  const update = useUpdateCustomExercise();
  const uploadPhoto = useUploadExercisePhoto();
  const [name, setName] = useState(ex.name);
  const [description, setDescription] = useState(ex.description ?? "");
  const [target, setTarget] = useState(ex.target ?? "");
  const [equipment, setEquipment] = useState(ex.equipment ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    ex.photo_r2_key ? `/api/uploads/media/${ex.photo_r2_key}` : null
  );
  const [photoError, setPhotoError] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const onPhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setPhotoError("Максимум 5 МБ"); return; }
    if (!file.type.startsWith("image/")) { setPhotoError("Только изображения"); return; }
    setPhotoError("");
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await update.mutateAsync({
        id: ex.id,
        payload: {
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          target: target.trim() || undefined,
          equipment: equipment.trim() || undefined,
        },
      });
      if (photoFile) {
        await uploadPhoto.mutateAsync({ file: photoFile, customExerciseId: ex.id });
      }
      onDone();
    } catch (err) {
      setError(`${toUserMessage(err)}${toDiagnosticSuffix(err)}`);
    }
  };

  const isPending = update.isPending || uploadPhoto.isPending;

  return (
    <form onSubmit={onSubmit} className="edit-form-inline">
      <div className="form-row">
        <div className="form-field">
          <label>Название</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="form-field">
          <label>Группа мышц</label>
          <select className="filter-select" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">—</option>
            {MUSCLE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Оборудование</label>
          <select className="filter-select" value={equipment} onChange={(e) => setEquipment(e.target.value)}>
            <option value="">—</option>
            {EQUIPMENT_OPTIONS.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Описание</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {/* Photo */}
      <div className="form-field">
        <label>Заменить фото</label>
        <div className={`photo-upload-area${photoFile ? " has-file" : ""}`}>
          <input ref={inputRef} className="photo-upload-input" type="file" accept="image/*" onChange={onPhotoChange} />
          {photoPreview ? (
            <>
              <img src={photoPreview} alt="Превью" className="photo-preview" />
              <p className="photo-upload-hint" style={{ marginTop: "var(--space-xs)" }}>Нажми, чтобы заменить</p>
            </>
          ) : (
            <>
              <div className="photo-upload-icon">📷</div>
              <p className="photo-upload-hint">Нажми для замены</p>
            </>
          )}
          {uploadPhoto.isPending && (
            <div className="upload-progress">
              <div className="upload-progress-bar" style={{ width: "70%" }} />
            </div>
          )}
        </div>
        {photoError && <p className="error-text">{photoError}</p>}
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="row">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Сохранение…" : "Сохранить"}
        </Button>
        <Button type="button" className="btn-ghost" onClick={onDone} disabled={isPending}>
          Отмена
        </Button>
      </div>
    </form>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function MyExerciseCard({ ex }: { ex: CustomExercise }) {
  const deleteEx = useDeleteCustomExercise();
  const [editing, setEditing] = useState(false);

  const photoUrl = ex.photo_r2_key
    ? `/api/uploads/media/${ex.photo_r2_key}`
    : null;

  const onDelete = () => {
    if (!confirm(`Удалить «${ex.name}»?`)) return;
    deleteEx.mutate(ex.id);
  };

  return (
    <div className="my-exercise-card">
      {photoUrl ? (
        <img src={photoUrl} alt={ex.name} className="my-exercise-photo" loading="lazy" />
      ) : (
        <div className="my-exercise-photo-placeholder">🏋️</div>
      )}

      <div className="my-exercise-body">
        <div className="my-exercise-name">{ex.name}</div>
        <div className="my-exercise-meta">
          {[ex.target, ex.equipment].filter(Boolean).join(" · ") || "Мышцы не указаны"}
        </div>
        {ex.description && (
          <div className="my-exercise-desc">{ex.description}</div>
        )}
      </div>

      <div className="my-exercise-actions">
        <Button
          className="btn-fav"
          style={{ flex: 1 }}
          onClick={() => setEditing((v) => !v)}
        >
          {editing ? "✕ Закрыть" : "✏️ Изменить"}
        </Button>
        <Button
          className="btn-icon btn-ghost btn-danger"
          onClick={onDelete}
          disabled={deleteEx.isPending}
          title="Удалить"
        >
          🗑
        </Button>
      </div>

      {editing && (
        <EditExerciseForm ex={ex} onDone={() => setEditing(false)} />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function MyExercisesPage() {
  const { data, isLoading } = useCustomExercises();
  const [showCreate, setShowCreate] = useState(false);

  const exercises = data ?? [];

  return (
    <div className="stack">
      {/* Header */}
      <Card>
        <div className="workout-header">
          <div>
            <h2>Мои упражнения</h2>
            <p className="workout-meta">Собственные упражнения с фото и описанием</p>
          </div>
          <Button onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "✕ Закрыть" : "+ Создать"}
          </Button>
        </div>
      </Card>

      {/* Форма создания */}
      {showCreate && (
        <Card>
          <h3 style={{ margin: "0 0 var(--space-md)" }}>Новое упражнение</h3>
          <CreateExerciseForm onCreated={() => setShowCreate(false)} />
        </Card>
      )}

      {/* Список */}
      {isLoading ? (
        <Card>
          <p style={{ color: "var(--muted)" }}>Загрузка…</p>
        </Card>
      ) : exercises.length === 0 ? (
        <Card>
          <div className="empty-state">
            <div style={{ fontSize: "2.5rem" }}>💪</div>
            <p>Нет собственных упражнений.</p>
            <p style={{ fontSize: "var(--font-sm)" }}>
              Создай своё упражнение с фото и описанием техники.
            </p>
          </div>
        </Card>
      ) : (
        <>
          <div className="glass-pill-row">
            <span className="glass-pill">Всего: {exercises.length}</span>
          </div>
          <div className="my-exercises-grid">
            {exercises.map((ex) => (
              <MyExerciseCard key={ex.id} ex={ex} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

