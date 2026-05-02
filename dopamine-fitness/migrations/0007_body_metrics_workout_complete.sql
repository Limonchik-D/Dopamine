-- ─── 0007: body metrics + workout completion ──────────────────────────────────

-- Добавляем рост и вес в профиль пользователя
ALTER TABLE user_profiles ADD COLUMN height_cm REAL;
ALTER TABLE user_profiles ADD COLUMN weight_kg REAL;

-- Завершение тренировки
ALTER TABLE workouts ADD COLUMN completed_at TEXT;
ALTER TABLE workouts ADD COLUMN duration_minutes INTEGER;

-- История измерений тела (для графика)
CREATE TABLE IF NOT EXISTS body_metrics (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg  REAL,
  height_cm  REAL,
  measured_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_body_metrics_user ON body_metrics(user_id, measured_at);
