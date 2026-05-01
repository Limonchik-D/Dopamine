import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { getRecentDays, useDailyCheckins } from "../features/checkins/useDailyCheckins";
import { useWorkouts } from "../features/workouts/useWorkouts";
import { useStatsSummary } from "../features/progress/useProgress";
import { useMe } from "../features/auth/useAuth";

function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function getStreakBadge(streak: number) {
  if (streak >= 30) return { icon: "🏆", label: "Легенда привычки" };
  if (streak >= 14) return { icon: "🔥", label: "Железная дисциплина" };
  if (streak >= 7)  return { icon: "⚡", label: "Неделя без пропусков" };
  if (streak >= 3)  return { icon: "✅", label: "Отличный старт" };
  return { icon: "🌱", label: "Формируем привычку" };
}

const QUICK_ACTIONS = [
  { to: "/workouts", icon: "💪", label: "Тренировки" },
  { to: "/exercises", icon: "📖", label: "Каталог" },
  { to: "/progress", icon: "📈", label: "Прогресс" },
  { to: "/calendar", icon: "📅", label: "Календарь" },
  { to: "/my-exercises", icon: "⭐", label: "Мои упр." },
  { to: "/settings", icon: "⚙️", label: "Настройки" },
];

export function DashboardPage() {
  const { data: me } = useMe();
  const { data: workoutsData, isLoading: workoutsLoading } = useWorkouts();
  const { data: summary } = useStatsSummary();
  const latest = workoutsData?.workouts?.[0];

  const {
    checkins,
    checkinsSet,
    todayKey,
    checkedInToday,
    streak,
    checkInToday,
    isLoading: checkinsLoading,
  } = useDailyCheckins();

  const recentDays = getRecentDays(28, new Date());
  const badge = getStreakBadge(streak);
  const thisWeekDone = recentDays.slice(-7).filter((d) => checkinsSet.has(d)).length;

  return (
    <div className="stack">
      {/* Welcome */}
      <div className="dashboard-welcome">
        <div>
          <h2 className="dashboard-greeting">
            Привет{me?.username ? `, ${me.username}` : ""}! 👋
          </h2>
          <p className="text-muted dashboard-subline">
            {checkedInToday ? "Сегодня уже отмечено. Так держать!" : "Не забудь отметить сегодняшний день."}
          </p>
        </div>
        <Button onClick={checkInToday} disabled={checkedInToday || checkinsLoading}>
          {checkedInToday ? "✓ Отмечено" : "Отметить день"}
        </Button>
      </div>

      {/* Stats summary */}
      <div className="progress-summary-grid">
        <div className="glass-stat-card">
          <span className="glass-stat-value">{streak}</span>
          <span className="glass-stat-label">Серия, дн.</span>
        </div>
        <div className="glass-stat-card">
          <span className="glass-stat-value">{thisWeekDone}/7</span>
          <span className="glass-stat-label">Эта неделя</span>
        </div>
        <div className="glass-stat-card">
          <span className="glass-stat-value">{summary?.total_workouts ?? "—"}</span>
          <span className="glass-stat-label">Тренировок</span>
        </div>
      </div>

      {/* Last workout */}
      <Card>
        <div className="dashboard-section-title">
          <span>Последняя тренировка</span>
          <Link to="/workouts" className="dashboard-link">Все →</Link>
        </div>
        {workoutsLoading ? (
          <p className="text-muted">Загрузка...</p>
        ) : latest ? (
          <Link to={`/workouts/${latest.id}`} className="dashboard-workout-card">
            <span className="dashboard-workout-icon">💪</span>
            <div>
              <p className="dashboard-workout-name">{latest.name}</p>
              <p className="text-muted" style={{ fontSize: "0.8rem" }}>{latest.workout_date}</p>
            </div>
          </Link>
        ) : (
          <div className="dashboard-empty">
            <p className="text-muted">Тренировок ещё нет</p>
            <Link to="/workouts"><Button>Создать первую</Button></Link>
          </div>
        )}
      </Card>

      {/* Streak badge */}
      <Card>
        <div className="dashboard-badge-row">
          <span className="dashboard-badge-icon">{badge.icon}</span>
          <div>
            <p className="dashboard-badge-label">{badge.label}</p>
            <p className="text-muted" style={{ fontSize: "0.8rem" }}>Серия: {streak} дн. · Всего отметок: {checkins.length}</p>
          </div>
        </div>

        {/* Mini calendar */}
        <div className="checkin-calendar-grid" style={{ marginTop: "var(--space-md)" }} aria-label="Календарь активности">
          {recentDays.map((day) => (
            <div
              key={day}
              className={`checkin-day${checkinsSet.has(day) ? " is-active" : ""}${day === todayKey ? " is-today" : ""}`}
            >
              <span>{formatShortDate(day)}</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "var(--space-sm)", textAlign: "right" }}>
          <Link to="/calendar" className="dashboard-link">Подробный календарь →</Link>
        </div>
      </Card>

      {/* Quick actions */}
      <Card>
        <p className="dashboard-section-title"><span>Быстрые переходы</span></p>
        <div className="dashboard-quick-grid">
          {QUICK_ACTIONS.map((a) => (
            <Link key={a.to} to={a.to} className="dashboard-quick-card">
              <span className="dashboard-quick-icon">{a.icon}</span>
              <span className="dashboard-quick-label">{a.label}</span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

