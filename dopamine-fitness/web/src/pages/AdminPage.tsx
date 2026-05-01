import { Card } from "../components/ui/Card";
import { useAdminOverview, useAdminUsers } from "../features/admin/useAdmin";
import { useMe } from "../features/auth/useAuth";

export function AdminPage() {
  const { data: me, isLoading: meLoading } = useMe();
  const isAdmin = me?.role === "admin";

  const overview = useAdminOverview(isAdmin);
  const users = useAdminUsers(isAdmin);

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
