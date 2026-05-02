import { NavLink, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useUiSettings } from "../../features/settings/useUiSettings";
import { useMe } from "../../features/auth/useAuth";

const NAV_ITEMS = [
  { to: "/dashboard", icon: "⊞", label: "Главная" },
  { to: "/workouts", icon: "◈", label: "Тренировки" },
  { to: "/exercises", icon: "◉", label: "Каталог" },
  { to: "/progress", icon: "╱╲", label: "Прогресс" },
  { to: "/report", icon: "▣", label: "Отчёт" },
  { to: "/calendar", icon: "▦", label: "Календарь" },
  { to: "/my-exercises", icon: "★", label: "Мои упр." },
];

const SECONDARY_ITEMS = [
  { to: "/settings", icon: "⊙", label: "Настройки" },
  { to: "/profile", icon: "◯", label: "Профиль" },
];

// Emoji иконки для sidebar (читаемые)
const NAV_EMOJI: Record<string, string> = {
  "/dashboard": "🏠",
  "/workouts": "💪",
  "/exercises": "📖",
  "/progress": "📈",
  "/report": "📊",
  "/calendar": "📅",
  "/my-exercises": "⭐",
  "/settings": "⚙️",
  "/profile": "👤",
  "/admin": "🛡️",
};

// Bottom nav (только 5 основных)
const BOTTOM_NAV = [
  { to: "/dashboard", emoji: "🏠", label: "Главная" },
  { to: "/workouts", emoji: "💪", label: "Трениров." },
  { to: "/progress", emoji: "📈", label: "Прогресс" },
  { to: "/report", emoji: "📊", label: "Отчёт" },
  { to: "/my-exercises", emoji: "⭐", label: "Мои упр." },
];

export function AppLayout() {
  const theme = useUiSettings((s) => s.theme);
  const { data: me } = useMe();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme ?? "fitness");
  }, [theme]);

  return (
    <div className="app-shell">
      {/* ── Desktop Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">⚡</div>
          <span className="sidebar-logo-text">Dopamine</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Навигация</div>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}
            >
              <span className="sidebar-link-icon">{NAV_EMOJI[item.to]}</span>
              <span className="sidebar-link-label">{item.label}</span>
            </NavLink>
          ))}
          {me?.role === "admin" && (
            <NavLink to="/admin" className={({ isActive }) => `sidebar-link${isActive ? " is-active" : ""}`}>
              <span className="sidebar-link-icon">{NAV_EMOJI["/admin"]}</span>
              <span className="sidebar-link-label">Админ</span>
            </NavLink>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-section-label">Аккаунт</div>
          {SECONDARY_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `sidebar-link sidebar-link-sm${isActive ? " is-active" : ""}`}
            >
              <span className="sidebar-link-icon">{NAV_EMOJI[item.to]}</span>
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
          <span className="mobile-topbar-logo">
            <span>Dopamine</span>
          </span>
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
          {BOTTOM_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `bottom-nav-item${isActive ? " is-active" : ""}`}
            >
              <span className="bottom-nav-icon">{item.emoji}</span>
              <span className="bottom-nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
