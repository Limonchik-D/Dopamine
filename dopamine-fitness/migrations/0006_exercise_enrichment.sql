-- ─── Exercise enrichment: difficulty column + name mapping table ─────────────

-- Add difficulty to exercise_catalog (beginner/intermediate/expert)
ALTER TABLE exercise_catalog ADD COLUMN difficulty TEXT;

-- Add secondary_muscles JSON array column
ALTER TABLE exercise_catalog ADD COLUMN secondary_muscles TEXT;

-- Normalized name for cross-API matching (lowercase, no punctuation)
ALTER TABLE exercise_catalog ADD COLUMN name_normalized TEXT;

-- Build initial normalized names from existing data
UPDATE exercise_catalog
SET name_normalized = LOWER(REPLACE(REPLACE(REPLACE(name_en, '-', ' '), '_', ' '), '  ', ' '));

CREATE INDEX IF NOT EXISTS idx_exercise_name_normalized ON exercise_catalog(name_normalized);

-- ─── Name mapping table for cross-API identity ───────────────────────────────
-- Stores the known mapping: our exercise_catalog id ↔ external source id
CREATE TABLE IF NOT EXISTS exercise_name_map (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  exercise_id        INTEGER NOT NULL REFERENCES exercise_catalog(id) ON DELETE CASCADE,
  external_source    TEXT    NOT NULL CHECK(external_source IN ('exercisedb','wger','ninjas')),
  external_id        TEXT    NOT NULL,
  external_name      TEXT    NOT NULL,
  confidence         REAL    NOT NULL DEFAULT 1.0,  -- 1.0 = exact, <1 = fuzzy
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(exercise_id, external_source)
);

CREATE INDEX IF NOT EXISTS idx_name_map_exercise_id ON exercise_name_map(exercise_id);
CREATE INDEX IF NOT EXISTS idx_name_map_external     ON exercise_name_map(external_source, external_id);
