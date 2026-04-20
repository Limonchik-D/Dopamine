-- Migration: 0001_initial_schema.sql
-- Dopamine Fitness — initial database schema

-- ─── Users ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT   NOT NULL,
  username     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ─── User Profiles ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  avatar_url TEXT,
  bio        TEXT,
  locale     TEXT NOT NULL DEFAULT 'ru' CHECK(locale IN ('ru','en')),
  theme      TEXT NOT NULL DEFAULT 'calm' CHECK(theme IN ('calm','sport','minimal','dark')),
  units      TEXT NOT NULL DEFAULT 'metric' CHECK(units IN ('metric','imperial'))
);

-- ─── User Settings ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_settings (
  user_id                INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme                  TEXT    NOT NULL DEFAULT 'calm' CHECK(theme IN ('calm','sport','minimal','dark')),
  locale                 TEXT    NOT NULL DEFAULT 'ru' CHECK(locale IN ('ru','en')),
  units                  TEXT    NOT NULL DEFAULT 'metric' CHECK(units IN ('metric','imperial')),
  notifications_enabled  INTEGER NOT NULL DEFAULT 1 CHECK(notifications_enabled IN (0,1))
);

-- ─── Exercise Catalog ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercise_catalog (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  source             TEXT    NOT NULL CHECK(source IN ('exercisedb','wger','seed','custom')),
  source_exercise_id TEXT    NOT NULL,
  name_en            TEXT    NOT NULL,
  name_ru            TEXT,
  target             TEXT,
  equipment          TEXT,
  body_part          TEXT,
  gif_url            TEXT,
  image_url          TEXT,
  instructions_en    TEXT,
  instructions_ru    TEXT,
  UNIQUE(source, source_exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_target    ON exercise_catalog(target);
CREATE INDEX IF NOT EXISTS idx_exercise_equipment ON exercise_catalog(equipment);
CREATE INDEX IF NOT EXISTS idx_exercise_body_part ON exercise_catalog(body_part);
CREATE INDEX IF NOT EXISTS idx_exercise_name_en   ON exercise_catalog(name_en COLLATE NOCASE);

-- ─── Custom Exercises ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS custom_exercises (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  description  TEXT,
  target       TEXT,
  equipment    TEXT,
  photo_r2_key TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_id ON custom_exercises(user_id);

-- ─── Exercise Media ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exercise_media (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id        INTEGER REFERENCES exercise_catalog(id) ON DELETE CASCADE,
  custom_exercise_id INTEGER REFERENCES custom_exercises(id) ON DELETE CASCADE,
  r2_key             TEXT    NOT NULL,
  media_type         TEXT    NOT NULL CHECK(media_type IN ('image','gif','video')),
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK(
    (exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR
    (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)
  )
);

-- ─── Workouts ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workouts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  description  TEXT,
  workout_date TEXT    NOT NULL,
  notes        TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  deleted_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_workouts_user_id      ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_workouts_workout_date ON workouts(workout_date);
CREATE INDEX IF NOT EXISTS idx_workouts_created_at   ON workouts(created_at);

-- ─── Workout Exercises ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workout_exercises (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id         INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id        INTEGER REFERENCES exercise_catalog(id) ON DELETE SET NULL,
  custom_exercise_id INTEGER REFERENCES custom_exercises(id) ON DELETE SET NULL,
  order_index        INTEGER NOT NULL DEFAULT 0,
  target_muscle      TEXT,
  equipment          TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK(
    (exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR
    (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_id   ON workout_exercises(workout_id);
CREATE INDEX IF NOT EXISTS idx_workout_exercises_exercise_id  ON workout_exercises(exercise_id);

-- ─── Sets ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sets (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number          INTEGER NOT NULL,
  weight              REAL,
  reps                INTEGER,
  rest_seconds        INTEGER,
  rir                 INTEGER,
  completed           INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1))
);

CREATE INDEX IF NOT EXISTS idx_sets_workout_exercise_id ON sets(workout_exercise_id);

-- ─── Favorites ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS favorites (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id        INTEGER REFERENCES exercise_catalog(id) ON DELETE CASCADE,
  custom_exercise_id INTEGER REFERENCES custom_exercises(id) ON DELETE CASCADE,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, exercise_id),
  UNIQUE(user_id, custom_exercise_id),
  CHECK(
    (exercise_id IS NOT NULL AND custom_exercise_id IS NULL) OR
    (exercise_id IS NULL AND custom_exercise_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);

-- ─── Progress Snapshots ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS progress_snapshots (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id        INTEGER REFERENCES exercise_catalog(id) ON DELETE SET NULL,
  custom_exercise_id INTEGER REFERENCES custom_exercises(id) ON DELETE SET NULL,
  date               TEXT    NOT NULL,
  weight             REAL,
  reps               INTEGER,
  volume             REAL,
  one_rm_estimate    REAL
);

CREATE INDEX IF NOT EXISTS idx_progress_user_id     ON progress_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_exercise_id ON progress_snapshots(exercise_id);
CREATE INDEX IF NOT EXISTS idx_progress_date        ON progress_snapshots(date);
