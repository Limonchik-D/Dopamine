import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useT } from "../i18n";
import { getAuthToken } from "../services/auth";

export function HomePage() {
  const t = useT();
  const origin = window.location.origin;
  const token = getAuthToken();
  const googleStartHref = `/api/auth/google/start?origin=${encodeURIComponent(origin)}`;

  const handleGoogleSignIn = () => {
    window.location.href = googleStartHref;
  };

  const handleLogout = () => {
    localStorage.removeItem("df_token");
    window.location.reload();
  };

  return (
    <Card>
      <h2>{t("app.title")}</h2>
      <p>Минималистичный трекер тренировок на Cloudflare Workers.</p>
      <div className="row">
        <Link to="/auth">
          <Button>{t("cta.start")}</Button>
        </Link>
        <Button type="button" onClick={handleGoogleSignIn}>Войти через Google</Button>
        {token && <Button type="button" onClick={handleLogout}>Выйти</Button>}
      </div>
    </Card>
  );
}
