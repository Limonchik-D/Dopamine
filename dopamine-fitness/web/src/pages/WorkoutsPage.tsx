import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateWorkout, useDuplicateWorkout, useWorkouts } from "../features/workouts/useWorkouts";
import { toDiagnosticSuffix, toUserMessage } from "../services/apiErrors";

export function WorkoutsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useWorkouts();
  const createWorkout = useCreateWorkout();
  const duplicateWorkout = useDuplicateWorkout();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [errorText, setErrorText] = useState("");
  const [quickError, setQuickError] = useState("");
  const [duplicateError, setDuplicateError] = useState("");

  const openModal = () => { setName(""); setErrorText(""); setModalOpen(true); };
  const closeModal = () => setModalOpen(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorText("");
    try {
      const w = await createWorkout.mutateAsync({
        name: name.trim(),
        workout_date: new Date().toISOString().slice(0, 10),
      });
      closeModal();
      navigate(`/workouts/${w.id}`);
    } catch (error) {
      setErrorText(`${toUserMessage(error)}${toDiagnosticSuffix(error)}`);
    }
  };

  const onQuickStart = async () => {
    setQuickError("");
    try {
      const today = new Date();
      const dateIso = today.toISOString().slice(0, 10);
      const dateRu = today.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
      const w = await createWorkout.mutateAsync({
        name: `Тренировка ${dateRu}`,
        workout_date: dateIso,
      });
      navigate(`/workouts/${w.id}`);
    } catch (error) {
      setQuickError(`${toUserMessage(error)}${toDiagnosticSuffix(error)}`);
    }
  };

  const workouts = data?.workouts ?? [];

  const onDuplicateToday = async (id: number, name: string) => {
    setDuplicateError("");
    try {
      const today = new Date().toISOString().slice(0, 10);
      const w = await duplicateWorkout.mutateAsync({
        id,
        workout_date: today,
        name: `${name} (сегодня)`,
      });
      navigate(`/workouts/${w.id}`);
    } catch (error) {
      setDuplicateError(`${toUserMessage(error)}${toDiagnosticSuffix(error)}`);
    }
  };

  return (
    <div className="stack">
      {/* Быстрый старт */}
      <button className="wo-create-btn" onClick={onQuickStart} disabled={createWorkout.isPending}>
        <span className="wo-create-icon">▶</span>
        {createWorkout.isPending ? "Запуск..." : "Начать тренировку сейчас"}
      </button>

      <div className="row" style={{ gap: "var(--space-sm)", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={() => navigate("/workouts/new")}>🧩 Собрать план</button>
        <button className="btn btn-ghost" onClick={openModal}>＋ Создать вручную</button>
      </div>

      {quickError && <p className="text-error">{quickError}</p>}
      {duplicateError && <p className="text-error">{duplicateError}</p>}

      {/* Список тренировок */}
      {isLoading ? (
        <p className="text-muted" style={{ textAlign: "center", padding: "2rem 0" }}>Загрузка…</p>
      ) : workouts.length === 0 ? (
        <div className="wo-empty">
          <div className="wo-empty-icon">🏋️</div>
          <p>Нет тренировок</p>
          <span>Нажми «Начать тренировку сейчас» чтобы сразу записывать подходы</span>
        </div>
      ) : (
        <div className="stack">
          {workouts.map((w) => (
            <div key={w.id} className="wo-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-sm)" }}>
              <Link to={`/workouts/${w.id}`} style={{ textDecoration: "none", flex: 1, minWidth: 0 }}>
                <div className="wo-card-left">
                  <div className="wo-card-name">{w.name}</div>
                  <div className="wo-card-date">
                    {new Date(w.workout_date).toLocaleDateString("ru-RU", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </div>
                </div>
              </Link>
              <div className="row" style={{ gap: "6px", flexShrink: 0 }}>
                <button
                  className="btn btn-ghost"
                  onClick={() => onDuplicateToday(w.id, w.name)}
                  disabled={duplicateWorkout.isPending}
                  title="Скопировать эту тренировку на сегодня"
                >
                  {duplicateWorkout.isPending ? "..." : "⧉ Копия"}
                </button>
                <span className="wo-card-arrow">›</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно */}
      {modalOpen && (
        <div className="wo-modal-overlay" onClick={closeModal}>
          <div className="wo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wo-modal-header">
              <span className="wo-modal-title">Новая тренировка</span>
              <button className="wo-modal-close" onClick={closeModal}>✕</button>
            </div>
            <form onSubmit={onSubmit} className="wo-modal-body">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Название тренировки"
                autoFocus
              />
              {errorText && <p className="text-error">{errorText}</p>}
              <button
                type="submit"
                className="wo-modal-submit"
                disabled={createWorkout.isPending || !name.trim()}
              >
                {createWorkout.isPending ? "Создаём…" : "Создать"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


