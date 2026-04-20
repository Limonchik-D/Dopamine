-- Migration: 0003_db_hardening_indexes_triggers.sql
-- Purpose: performance hardening for hot queries + data consistency

-- ─── Workouts hot path indexes ─────────────────────────────────────────────
-- Used by: workouts list/count, stats aggregation
CREATE INDEX IF NOT EXISTS idx_workouts_user_deleted_date_created
  ON workouts(user_id, deleted_at, workout_date DESC, created_at DESC);

-- ─── Workout exercises hot path indexes ─────────────────────────────────────
-- Used by: get exercises in workout ordered by order_index
CREATE INDEX IF NOT EXISTS idx_workout_exercises_workout_order
  ON workout_exercises(workout_id, order_index ASC);

-- Prevent duplicate set numbers inside one workout exercise
CREATE UNIQUE INDEX IF NOT EXISTS idx_sets_unique_workout_exercise_setnum
  ON sets(workout_exercise_id, set_number);

-- Used by: stats query where sets.completed = 1
CREATE INDEX IF NOT EXISTS idx_sets_workout_exercise_completed
  ON sets(workout_exercise_id, completed);

-- ─── Custom exercises hot path indexes ──────────────────────────────────────
-- Used by: my custom exercises list (non-deleted)
CREATE INDEX IF NOT EXISTS idx_custom_exercises_user_deleted_created
  ON custom_exercises(user_id, deleted_at, created_at DESC);

-- ─── Favorites / media listing indexes ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_favorites_user_created
  ON favorites(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_exercise_media_custom_exercise
  ON exercise_media(custom_exercise_id, created_at DESC);

-- ─── Progress snapshots range query index ───────────────────────────────────
-- Used by: exercise-specific progress charts
CREATE INDEX IF NOT EXISTS idx_progress_user_exercise_date
  ON progress_snapshots(user_id, exercise_id, date ASC);

CREATE INDEX IF NOT EXISTS idx_progress_user_custom_exercise_date
  ON progress_snapshots(user_id, custom_exercise_id, date ASC);
