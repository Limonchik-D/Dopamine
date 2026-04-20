import { NavLink, Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useUiSettings } from "../../features/settings/useUiSettings";
import { useT } from "../../i18n";

export function AppLayout() {
  const theme = useUiSettings((s) => s.theme);
  const t = useT();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>{t("app.title")}</h1>
        <nav className="nav-grid">
          <NavLink to="/">{t("nav.home")}</NavLink>
          <NavLink to="/dashboard">{t("nav.dashboard")}</NavLink>
          <NavLink to="/workouts">{t("nav.workouts")}</NavLink>
          <NavLink to="/exercises">{t("nav.exercises")}</NavLink>
          <NavLink to="/progress">{t("nav.progress")}</NavLink>
          <NavLink to="/settings">{t("nav.settings")}</NavLink>
          <NavLink to="/profile">{t("nav.profile")}</NavLink>
        </nav>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
