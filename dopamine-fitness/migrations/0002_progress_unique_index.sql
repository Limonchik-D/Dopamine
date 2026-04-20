-- Migration: 0002_progress_unique_index.sql
-- Add unique constraint on progress_snapshots for upsert support

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_unique
  ON progress_snapshots(user_id, exercise_id, date)
  WHERE exercise_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_progress_custom_unique
  ON progress_snapshots(user_id, custom_exercise_id, date)
  WHERE custom_exercise_id IS NOT NULL;
