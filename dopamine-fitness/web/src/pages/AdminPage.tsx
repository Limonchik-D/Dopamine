import { Card } from "../components/ui/Card";
import { useAdminDiagnostics, useAdminOverview, useAdminUsers } from "../features/admin/useAdmin";
import { useMe } from "../features/auth/useAuth";

export function AdminPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const isAdmin = me?.role === "admin";

  const overview = useAdminOverview(isAdmin);
  const users = useAdminUsers(isAdmin);
  const diagnostics = useAdminDiagnostics(isAdmin);

  if (meLoading) {
    return (
      <Card>
        <h2>Админ панель</h2>
        <p>Загрузка...</p>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <h2>Админ панель</h2>
        <p>Недостаточно прав.</p>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card>
        <h2>Админ панель</h2>
        {diagnostics.data && (
          <p className="daily-checkin-subtitle">
            Система: {diagnostics.data.ready ? "готова" : "degraded"} · DB: {diagnostics.data.dependencies.db ? "ok" : "fail"} · KV: {diagnostics.data.dependencies.kv ? "ok" : "fail"}
          </p>
        )}
        {diagnostics.data && (
          <div className="glass-pill-row">
            <span className="glass-pill">Status: {diagnostics.data.ready ? "ready" : "degraded"}</span>
            <span className="glass-pill">Migration: {diagnostics.data.latestMigration?.name ?? "n/a"}</span>
          </div>
        )}
        {overview.isLoading ? (
          <p>Загрузка метрик...</p>
        ) : (
          <div className="daily-stats-row">
            <div className="daily-stat-tile">
              <p className="daily-stat-label">Пользователи</p>
              <p className="daily-stat-value">{overview.data?.users ?? 0}</p>
            </div>
            <div className="daily-stat-tile">
              <p className="daily-stat-label">Тренировки</p>
              <p className="daily-stat-value">{overview.data?.workouts ?? 0}</p>
            </div>
            <div className="daily-stat-tile">
              <p className="daily-stat-label">Кастом упражнения</p>
              <p className="daily-stat-value">{overview.data?.customExercises ?? 0}</p>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <h3>Диагностика и масштабирование</h3>
        {diagnostics.isLoading ? (
          <p>Загрузка диагностики...</p>
        ) : (
          <div className="stack">
            <div className="daily-stats-row">
              <div className="daily-stat-tile">
                <p className="daily-stat-label">Check-ins</p>
                <p className="daily-stat-value">{diagnostics.data?.counters.checkins ?? 0}</p>
              </div>
              <div className="daily-stat-tile">
                <p className="daily-stat-label">Последняя миграция</p>
                <p className="daily-stat-value" style={{ fontSize: "var(--font-md)" }}>{diagnostics.data?.latestMigration?.name ?? "n/a"}</p>
              </div>
            </div>
            <p className="daily-checkin-subtitle">
              Обновлено: {diagnostics.data ? new Date(diagnostics.data.ts).toLocaleString("ru-RU") : "n/a"}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <h3>Последние пользователи</h3>
        {users.isLoading ? (
          <p>Загрузка...</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Создан</th>
                </tr>
              </thead>
              <tbody>
                {(users.data?.users ?? []).map((user) => (
                  <tr key={user.id}>
                    <td>{user.id}</td>
                    <td>{user.email}</td>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td>{new Date(user.created_at).toLocaleString("ru-RU")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
