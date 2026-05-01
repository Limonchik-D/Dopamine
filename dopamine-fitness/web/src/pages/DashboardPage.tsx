import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { getRecentDays, useDailyCheckins } from "../features/checkins/useDailyCheckins";
import { useWorkouts } from "../features/workouts/useWorkouts";

function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

export function DashboardPage() {
  const { data, isLoading: workoutsLoading } = useWorkouts();
  const latest = data?.workouts?.[0];
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

  const motivationText =
    streak >= 14
      ? "Ты в режиме чемпиона. Не сбавляй темп."
      : streak >= 7
        ? "Сильная серия. Ещё немного и новая привычка закрепится."
        : streak >= 3
          ? "Отличный старт. Продолжай каждый день."
          : "Сделай ежедневный заход и начни новую серию уже сегодня.";

  return (
    <div className="stack">
      <Card>
        <h2>Дашборд</h2>
        {workoutsLoading ? <p>Загрузка...</p> : <p>Последняя тренировка: {latest?.name ?? "Нет данных"}</p>}
      </Card>

      <Card>
        <div className="daily-checkin-header">
          <div>
            <h3>Ежедневный заход</h3>
            <p className="daily-checkin-subtitle">Отмечай день и поддерживай спортивный ритм.</p>
          </div>
          <Button onClick={checkInToday} disabled={checkedInToday || checkinsLoading}>
            {checkedInToday ? "Сегодня уже отмечено" : "Отметить сегодня"}
          </Button>
        </div>

        <div className="daily-stats-row">
          <div className="daily-stat-tile">
            <p className="daily-stat-label">Текущая серия</p>
            <p className="daily-stat-value">{streak} дн.</p>
          </div>
          <div className="daily-stat-tile">
            <p className="daily-stat-label">Всего отметок</p>
            <p className="daily-stat-value">{checkins.length}</p>
          </div>
        </div>

        <p className="daily-motivation">{motivationText}</p>

        <div className="row">
          <Link to="/calendar">Открыть календарь привычки</Link>
        </div>

        <div className="checkin-calendar-grid" aria-label="Календарь ежедневных заходов">
          {recentDays.map((day) => {
            const active = checkinsSet.has(day);
            const isToday = day === todayKey;
            return (
              <div key={day} className={`checkin-day ${active ? "is-active" : ""} ${isToday ? "is-today" : ""}`.trim()}>
                <span>{formatShortDate(day)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
