import { NavLink, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useUiSettings } from "../../features/settings/useUiSettings";
import { useMe } from "../../features/auth/useAuth";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "🏠", label: "Главная" },
  { to: "/workouts", icon: "💪", label: "Тренировки" },
  { to: "/exercises", icon: "📖", label: "Упражнения" },
  { to: "/progress", icon: "📈", label: "Прогресс" },
  { to: "/calendar", icon: "📅", label: "Календарь" },
  { to: "/my-exercises", icon: "⭐", label: "Мои упр." },
];

const SECONDARY_ITEMS = [
  { to: "/settings", icon: "⚙️", label: "Настройки" },
  { to: "/profile", icon: "👤", label: "Профиль" },
];

export function AppLayout() {
  const theme = useUiSettings((s) => s.theme);
  const { data: me } = useMe();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="sidebar-logo-icon">⚡</span>
          <span className="sidebar-logo-text">Dopamine</span>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}>
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
          {me?.role === "admin" && (
            <NavLink to="/admin" className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}>
              <span className="sidebar-link-icon">🛡️</span>
              <span className="sidebar-link-label">Админ</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-bottom">
          {SECONDARY_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-link sidebar-link-sm${isActive ? " is-active" : ""}`}>
              <span className="sidebar-link-icon">{item.icon}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
          {me && (
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                {me.username[0]?.toUpperCase()}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">{me.username}</span>
                <span className="sidebar-user-role">{me.role}</span>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="app-body">
        {/* Mobile topbar */}
        <header className="mobile-topbar">
          <span className="mobile-topbar-logo">⚡ Dopamine</span>
          {me && (
            <NavLink to="/profile" className="mobile-topbar-avatar">
              {me.username[0]?.toUpperCase()}
            </NavLink>
          )}
        </header>

        <main className="container">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="bottom-nav" aria-label="Навигация">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-nav-item${isActive ? " is-active" : ""}`}>
              <span className="bottom-nav-icon">{item.icon}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
