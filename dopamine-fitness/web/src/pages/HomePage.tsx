import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useT } from "../i18n";

export function HomePage() {
  const t = useT();
  return (
    <Card>
      <h2>{t("app.title")}</h2>
      <p>Минималистичный трекер тренировок на Cloudflare Workers.</p>
      <Link to="/auth">
        <Button>{t("cta.start")}</Button>
      </Link>
    </Card>
  );
}
