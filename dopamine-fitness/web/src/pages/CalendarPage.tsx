import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { getRecentDays, useDailyCheckins } from "../features/checkins/useDailyCheckins";

function formatDateLabel(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
  });
}

function getBadge(streak: number) {
  if (streak >= 30) return "🏆 Легенда привычки";
  if (streak >= 14) return "🔥 Железная дисциплина";
  if (streak >= 7) return "⚡ Неделя без пропусков";
  if (streak >= 3) return "✅ Отличный старт";
  return "🌱 Формируем привычку";
}

export function CalendarPage() {
  const { checkins, checkinsSet, todayKey, checkedInToday, streak, checkInToday, isLoading } = useDailyCheckins();
  const days = getRecentDays(84, new Date());
  const thisWeekDone = days.slice(-7).filter((day) => checkinsSet.has(day)).length;

  return (
    <div className="stack">
      <Card>
        <div className="daily-checkin-header">
          <div>
            <h2>Календарь привычки</h2>
            <p className="daily-checkin-subtitle">Каждый заход фиксируется. Стабильность = прогресс.</p>
          </div>
          <Button onClick={checkInToday} disabled={checkedInToday || isLoading}>
            {checkedInToday ? "Сегодня уже отмечено" : "Отметить сегодня"}
          </Button>
        </div>
        <div className="glass-pill-row">
          <span className="glass-pill">Бейдж: {getBadge(streak)}</span>
          <span className="glass-pill">Эта неделя: {thisWeekDone}/7</span>
        </div>
      </Card>

      <Card>
        <div className="daily-stats-row">
          <div className="daily-stat-tile">
            <p className="daily-stat-label">Текущая серия</p>
            <p className="daily-stat-value">{streak} дн.</p>
          </div>
          <div className="daily-stat-tile">
            <p className="daily-stat-label">Выполнено за 7 дней</p>
            <p className="daily-stat-value">{thisWeekDone}/7</p>
          </div>
          <div className="daily-stat-tile">
            <p className="daily-stat-label">Всего отметок</p>
            <p className="daily-stat-value">{checkins.length}</p>
          </div>
        </div>

        <p className="daily-motivation">{getBadge(streak)}</p>

        <div className="calendar-legend-row">
          <span className="calendar-legend-item"><i className="legend-dot legend-dot-active" /> Был заход</span>
          <span className="calendar-legend-item"><i className="legend-dot legend-dot-today" /> Сегодня</span>
        </div>

        <div className="calendar-grid-large" aria-label="Календарь ежедневных заходов за 12 недель">
          {days.map((day) => {
            const active = checkinsSet.has(day);
            const isToday = day === todayKey;
            return (
              <div key={day} className={`checkin-day ${active ? "is-active" : ""} ${isToday ? "is-today" : ""}`.trim()}>
                <span>{formatDateLabel(day)}</span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
