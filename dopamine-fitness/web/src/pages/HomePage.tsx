import { Link, Navigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { getAuthToken } from "../services/auth";

const FEATURES = [
  { icon: "💪", title: "Тренировки", desc: "Создавай планы, добавляй упражнения, фиксируй подходы и веса." },
  { icon: "📈", title: "Прогресс", desc: "Графики объёма, 1RM и рекордов по каждому упражнению." },
  { icon: "📅", title: "Привычка", desc: "Ежедневный чекин и серия активности держат тебя в тонусе." },
  { icon: "📖", title: "Каталог", desc: "Более 1000 упражнений с GIF-анимацией и фильтрами." },
  { icon: "⭐", title: "Свои упражнения", desc: "Добавляй кастомные упражнения с фото и описанием." },
  { icon: "🌙", title: "Glassmorphism UI", desc: "Тёмная тема, неоновые акценты, плавные анимации." },
];

export function HomePage() {
  if (getAuthToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  const googleHref = `/api/auth/google/start?origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <div className="stack">
      {/* Hero */}
      <div className="home-hero">
        <span className="home-hero-icon">⚡</span>
        <h1 className="home-hero-title">Dopamine Fitness</h1>
        <p className="home-hero-sub">
          Умный трекер тренировок на Cloudflare Workers. Отслеживай прогресс,
          выстраивай привычки и бей личные рекорды.
        </p>
        <div className="row" style={{ justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/auth">
            <Button>Начать бесплатно</Button>
          </Link>
          <Button type="button" onClick={() => { window.location.href = googleHref; }}>
            🔑 Войти через Google
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="home-features-grid">
        {FEATURES.map((f) => (
          <div key={f.title} className="home-feature-card">
            <span className="home-feature-icon">{f.icon}</span>
            <p className="home-feature-title">{f.title}</p>
            <p className="home-feature-desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
