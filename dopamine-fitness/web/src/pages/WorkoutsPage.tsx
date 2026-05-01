import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCreateWorkout, useWorkouts } from "../features/workouts/useWorkouts";
import { toDiagnosticSuffix, toUserMessage } from "../services/apiErrors";

export function WorkoutsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useWorkouts();
  const createWorkout = useCreateWorkout();
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [errorText, setErrorText] = useState("");

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

  const workouts = data?.workouts ?? [];

  return (
    <div className="stack">
      {/* Кнопка создания */}
      <button className="wo-create-btn" onClick={openModal}>
        <span className="wo-create-icon">＋</span>
        Создать тренировку
      </button>

      {/* Список тренировок */}
      {isLoading ? (
        <p className="text-muted" style={{ textAlign: "center", padding: "2rem 0" }}>Загрузка…</p>
      ) : workouts.length === 0 ? (
        <div className="wo-empty">
          <div className="wo-empty-icon">🏋️</div>
          <p>Нет тренировок</p>
          <span>Нажми «Создать тренировку» чтобы начать</span>
        </div>
      ) : (
        <div className="stack">
          {workouts.map((w) => (
            <Link key={w.id} to={`/workouts/${w.id}`} style={{ textDecoration: "none" }}>
              <div className="wo-card">
                <div className="wo-card-left">
                  <div className="wo-card-name">{w.name}</div>
                  <div className="wo-card-date">
                    {new Date(w.workout_date).toLocaleDateString("ru-RU", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </div>
                </div>
                <span className="wo-card-arrow">›</span>
              </div>
            </Link>
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


