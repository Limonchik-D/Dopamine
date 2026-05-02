import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import {
  useExercises,
  useExerciseFilterOptions,
  useFavorites,
  useToggleFavorite,
  type ExerciseFilters,
  type Exercise,
} from "../features/exercises/useExercises";
import { useWorkouts } from "../features/workouts/useWorkouts";
import { useAddExerciseToWorkout } from "../features/workouts/useWorkouts";

const PAGE_SIZE = 24;

// ─── Add-to-Workout Popup ─────────────────────────────────────────────────────

function AddToWorkoutPopup({
  exercise,
  onClose,
}: {
  exercise: Exercise;
  onClose: () => void;
}) {
  const { data } = useWorkouts();
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<number | null>(null);
  const addExercise = useAddExerciseToWorkout(selectedWorkoutId ?? 0);

  const onAdd = async () => {
    if (!selectedWorkoutId) return;
    await addExercise.mutateAsync({ exercise_id: exercise.id });
    onClose();
  };

  const workouts = data?.workouts ?? [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(5,11,24,0.72)",
        backdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: "var(--space-md)",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 400, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", marginBottom: "var(--space-md)" }}>
          <h3 style={{ margin: 0 }}>Добавить в тренировку</h3>
          <Button className="btn-icon btn-ghost" onClick={onClose}>✕</Button>
        </div>
        <p style={{ color: "var(--muted)", fontSize: "var(--font-sm)", marginBottom: "var(--space-sm)" }}>
          {exercise.name_ru ?? exercise.name_en}
        </p>
        {workouts.length === 0 ? (
          <p style={{ color: "var(--muted)" }}>
            Нет тренировок.{" "}
            <Link to="/workouts">Создай первую</Link>
          </p>
        ) : (
          <>
            <select
              className="filter-select"
              style={{ marginBottom: "var(--space-md)" }}
              value={selectedWorkoutId ?? ""}
              onChange={(e) => setSelectedWorkoutId(Number(e.target.value))}
            >
              <option value="">— Выбери тренировку —</option>
              {workouts.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.workout_date})
                </option>
              ))}
            </select>
            <Button
              onClick={onAdd}
              disabled={!selectedWorkoutId || addExercise.isPending}
              style={{ width: "100%" }}
            >
              {addExercise.isPending ? "Добавление…" : "Добавить"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Exercise Card ────────────────────────────────────────────────────────────

function ExerciseCard({
  ex,
  isFav,
  onToggleFav,
  onAddToWorkout,
}: {
  ex: Exercise;
  isFav: boolean;
  onToggleFav: (ex: Exercise) => void;
  onAddToWorkout: (ex: Exercise) => void;
}) {
  return (
    <div className="exercise-card">
      <Link to={`/exercises/${ex.id}`} style={{ display: "contents" }}>
        {ex.gif_url ? (
          <img
            src={ex.gif_url}
            alt={ex.name_en}
            className="exercise-card-img"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="exercise-card-img-placeholder">🏋️</div>
        )}
        <div className="exercise-card-body">
          <div className="exercise-card-name">{ex.name_ru ?? ex.name_en}</div>
          <div className="exercise-card-meta">
            {[ex.target, ex.body_part].filter(Boolean).join(" · ")}
          </div>
        </div>
      </Link>
      <div className="exercise-card-actions">
        <Button
          className={`btn-fav${isFav ? " is-fav" : ""}`}
          onClick={() => onToggleFav(ex)}
          title={isFav ? "Убрать из избранного" : "В избранное"}
        >
          {isFav ? "★" : "☆"}
        </Button>
        <Button
          className="btn-add-to-workout"
          onClick={() => onAddToWorkout(ex)}
        >
          + В тренировку
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ExerciseCatalogPage() {
  const [filters, setFilters] = useState<ExerciseFilters>({ page: 1, limit: PAGE_SIZE });
  const [searchInput, setSearchInput] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addToWorkoutEx, setAddToWorkoutEx] = useState<Exercise | null>(null);

  // Debounce: отправляем поисковый запрос только после 400мс паузы
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({
        ...prev,
        search: searchInput || undefined,
        page: 1,
      }));
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useExercises(filters);
  const { data: filterOptions } = useExerciseFilterOptions();
  const { data: favorites } = useFavorites();
  const { add: favAdd, remove: favRemove } = useToggleFavorite();

  const favSet = new Set(favorites?.map((f) => f.exercise_id).filter(Boolean) as number[]);

  const setFilter = (key: keyof Omit<ExerciseFilters, "search">, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      page: 1,
    }));
  };

  const onToggleFav = (ex: Exercise) => {
    if (favSet.has(ex.id)) {
      favRemove.mutate(ex.id);
    } else {
      favAdd.mutate(ex.id);
    }
  };

  const exercises = data?.exercises ?? [];
  const total = data?.total ?? 0;
  const page = filters.page ?? 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      {addToWorkoutEx && (
        <AddToWorkoutPopup
          exercise={addToWorkoutEx}
          onClose={() => setAddToWorkoutEx(null)}
        />
      )}

      <div className="stack">
        {/* Поиск и мобильный тоггл фильтров */}
        <Card>
          <div className="catalog-header">
            <h2 style={{ margin: 0 }}>Каталог упражнений</h2>
            <Button
              className="filter-toggle-btn btn-ghost"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {filtersOpen ? "Скрыть фильтры" : "Фильтры"}
            </Button>
          </div>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Поиск на английском (напр. bench press, squat…)"
            style={{ marginTop: "var(--space-sm)" }}
          />
          {total > 0 && (
            <p className="catalog-count" style={{ marginTop: "var(--space-xs)" }}>
              Найдено: {total} · Страница {page}/{totalPages || 1}
            </p>
          )}
        </Card>

        <div className="catalog-layout">
          {/* Sidebar фильтры */}
          <div className={`catalog-filters card${filtersOpen ? " is-open" : ""}`}>
            <p style={{ fontWeight: 700, margin: "0 0 var(--space-sm)" }}>Фильтры</p>

            <div className="filter-group">
              <span className="filter-label">Группа мышц</span>
              <select
                className="filter-select"
                value={filters.target ?? ""}
                onChange={(e) => setFilter("target", e.target.value)}
              >
                <option value="">Все</option>
                {(filterOptions?.targets ?? []).map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Оборудование</span>
              <select
                className="filter-select"
                value={filters.equipment ?? ""}
                onChange={(e) => setFilter("equipment", e.target.value)}
              >
                <option value="">Всё</option>
                {(filterOptions?.equipment ?? []).map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <span className="filter-label">Часть тела</span>
              <select
                className="filter-select"
                value={filters.body_part ?? ""}
                onChange={(e) => setFilter("body_part", e.target.value)}
              >
                <option value="">Все</option>
                {(filterOptions?.bodyParts ?? []).map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {(filters.target || filters.equipment || filters.body_part || searchInput) && (
              <Button
                className="btn-ghost"
                onClick={() => { setSearchInput(""); setFilters({ page: 1, limit: PAGE_SIZE }); }}
                style={{ marginTop: "var(--space-xs)" }}
              >
                Сбросить
              </Button>
            )}
          </div>

          {/* Сетка упражнений */}
          <div>
            {isLoading ? (
              <div className="exercise-grid">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="exercise-card"
                    style={{ opacity: 0.4, pointerEvents: "none" }}
                  >
                    <div className="exercise-card-img-placeholder">…</div>
                    <div className="exercise-card-body">
                      <div className="exercise-card-name" style={{ background: "var(--border)", height: 14, borderRadius: 6 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : exercises.length === 0 ? (
              <Card>
                <div className="empty-state">
                  <div style={{ fontSize: "2.5rem" }}>🔍</div>
                  <p>Ничего не найдено. Попробуй изменить фильтры.</p>
                </div>
              </Card>
            ) : (
              <div className="exercise-grid" style={{ opacity: isFetching ? 0.7 : 1, transition: "opacity 0.2s" }}>
                {exercises.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    isFav={favSet.has(ex.id)}
                    onToggleFav={onToggleFav}
                    onAddToWorkout={setAddToWorkoutEx}
                  />
                ))}
              </div>
            )}

            {/* Пагинация */}
            {totalPages > 1 && (
              <div className="pagination-row">
                <Button
                  className="btn-ghost"
                  disabled={page <= 1 || isFetching}
                  onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) - 1 }))}
                >
                  ← Назад
                </Button>
                <span className="pagination-info">{page} / {totalPages}</span>
                <Button
                  className="btn-ghost"
                  disabled={page >= totalPages || isFetching}
                  onClick={() => setFilters((p) => ({ ...p, page: (p.page ?? 1) + 1 }))}
                >
                  Далее →
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

