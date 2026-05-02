import type { Workout, WorkoutExercise, Set } from "../types/index.js";
import { isUniqueConstraintError } from "../utils/dbErrors.js";
import { conflict } from "../utils/appError.js";
import { ErrorCodes } from "../utils/errorCodes.js";

export class WorkoutRepository {
  constructor(private db: D1Database) {}

  async findByUser(
    userId: number,
    limit: number,
    offset: number
  ): Promise<{ workouts: Workout[]; total: number }> {
    const [rows, countRow] = await Promise.all([
      this.db
        .prepare(
          `SELECT * FROM workouts
           WHERE user_id = ?1 AND deleted_at IS NULL
           ORDER BY workout_date DESC, created_at DESC
           LIMIT ?2 OFFSET ?3`
        )
        .bind(userId, limit, offset)
        .all<Workout>(),
      this.db
        .prepare("SELECT COUNT(*) as cnt FROM workouts WHERE user_id = ?1 AND deleted_at IS NULL")
        .bind(userId)
        .first<{ cnt: number }>(),
    ]);

    return { workouts: rows.results, total: countRow?.cnt ?? 0 };
  }

  async findById(id: number, userId: number): Promise<Workout | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM workouts WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL"
      )
      .bind(id, userId)
      .first<Workout>();
    return row ?? null;
  }

  async create(
    userId: number,
    name: string,
    description: string | null,
    workoutDate: string,
    notes: string | null
  ): Promise<Workout> {
    const row = await this.db
      .prepare(
        `INSERT INTO workouts (user_id, name, description, workout_date, notes)
         VALUES (?1, ?2, ?3, ?4, ?5)
         RETURNING *`
      )
      .bind(userId, name, description ?? null, workoutDate, notes ?? null)
      .first<Workout>();
    if (!row) throw new Error("Failed to create workout");
    return row;
  }

  async update(
    id: number,
    userId: number,
    fields: Partial<Pick<Workout, "name" | "description" | "workout_date" | "notes">>
  ): Promise<Workout | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (fields.name !== undefined) { sets.push(`name = ?${i++}`); values.push(fields.name); }
    if (fields.description !== undefined) { sets.push(`description = ?${i++}`); values.push(fields.description); }
    if (fields.workout_date !== undefined) { sets.push(`workout_date = ?${i++}`); values.push(fields.workout_date); }
    if (fields.notes !== undefined) { sets.push(`notes = ?${i++}`); values.push(fields.notes); }

    if (sets.length === 0) return this.findById(id, userId);

    values.push(id, userId);
    const row = await this.db
      .prepare(
        `UPDATE workouts SET ${sets.join(", ")}
         WHERE id = ?${i++} AND user_id = ?${i++} AND deleted_at IS NULL
         RETURNING *`
      )
      .bind(...values)
      .first<Workout>();
    return row ?? null;
  }

  async softDelete(id: number, userId: number): Promise<boolean> {
    const result = await this.db
      .prepare(
        `UPDATE workouts SET deleted_at = datetime('now')
         WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL`
      )
      .bind(id, userId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  // ─── Workout Exercises ──────────────────────────────────────────────────────

  async addExercise(
    workoutId: number,
    exerciseId: number | null,
    customExerciseId: number | null,
    orderIndex: number,
    targetMuscle: string | null,
    equipment: string | null
  ): Promise<WorkoutExercise> {
    const row = await this.db
      .prepare(
        `INSERT INTO workout_exercises
           (workout_id, exercise_id, custom_exercise_id, order_index, target_muscle, equipment)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         RETURNING *`
      )
      .bind(workoutId, exerciseId, customExerciseId, orderIndex, targetMuscle, equipment)
      .first<WorkoutExercise>();
    if (!row) throw new Error("Failed to add exercise");
    return row;
  }

  async copyWorkoutExercisesAndSets(
    sourceWorkoutId: number,
    targetWorkoutId: number,
    userId: number
  ): Promise<void> {
    const sourceExercises = await this.db
      .prepare(
        `SELECT we.*
         FROM workout_exercises we
         JOIN workouts w ON w.id = we.workout_id
         WHERE we.workout_id = ?1 AND w.user_id = ?2 AND w.deleted_at IS NULL
         ORDER BY we.order_index ASC`
      )
      .bind(sourceWorkoutId, userId)
      .all<WorkoutExercise>();

    for (const sourceExercise of sourceExercises.results) {
      const insertedExercise = await this.addExercise(
        targetWorkoutId,
        sourceExercise.exercise_id,
        sourceExercise.custom_exercise_id,
        sourceExercise.order_index,
        sourceExercise.target_muscle,
        sourceExercise.equipment
      );

      const sourceSets = await this.getSets(sourceExercise.id);
      for (const sourceSet of sourceSets) {
        await this.addSet(
          insertedExercise.id,
          sourceSet.set_number,
          sourceSet.weight,
          sourceSet.reps,
          sourceSet.rest_seconds,
          sourceSet.rir,
          false
        );
      }
    }
  }

  async getExercises(workoutId: number, userId: number): Promise<WorkoutExercise[]> {
    const rows = await this.db
      .prepare(
        `SELECT
           we.*,
           COALESCE(ec.name_ru, ec.name_en)  AS exercise_name,
           ec.gif_url                         AS exercise_gif_url,
           ec.image_url                       AS exercise_image_url,
           ec.instructions_en                 AS exercise_instructions_en,
           ec.instructions_ru                 AS exercise_instructions_ru,
           ec.target                          AS exercise_target,
           ec.equipment                       AS exercise_equipment,
           NULL                               AS exercise_photo_key,
           0                                  AS is_custom,
           cx.name                            AS custom_name,
           cx.photo_r2_key                    AS custom_photo_key,
           cx.description                     AS custom_description,
           cx.target                          AS custom_target,
           cx.equipment                       AS custom_equipment,
           (
             SELECT s2.weight
             FROM sets s2
             JOIN workout_exercises we2 ON we2.id = s2.workout_exercise_id
             JOIN workouts w2 ON w2.id = we2.workout_id
             WHERE w2.user_id = ?2
               AND w2.deleted_at IS NULL
               AND w2.id != we.workout_id
               AND s2.completed = 1
               AND (
                 (we.exercise_id IS NOT NULL AND we2.exercise_id = we.exercise_id)
                 OR (we.custom_exercise_id IS NOT NULL AND we2.custom_exercise_id = we.custom_exercise_id)
               )
             ORDER BY w2.workout_date DESC, w2.created_at DESC, s2.id DESC
             LIMIT 1
           )                                  AS last_weight,
           (
             SELECT s2.reps
             FROM sets s2
             JOIN workout_exercises we2 ON we2.id = s2.workout_exercise_id
             JOIN workouts w2 ON w2.id = we2.workout_id
             WHERE w2.user_id = ?2
               AND w2.deleted_at IS NULL
               AND w2.id != we.workout_id
               AND s2.completed = 1
               AND (
                 (we.exercise_id IS NOT NULL AND we2.exercise_id = we.exercise_id)
                 OR (we.custom_exercise_id IS NOT NULL AND we2.custom_exercise_id = we.custom_exercise_id)
               )
             ORDER BY w2.workout_date DESC, w2.created_at DESC, s2.id DESC
             LIMIT 1
           )                                  AS last_reps
         FROM workout_exercises we
         LEFT JOIN exercise_catalog ec ON ec.id = we.exercise_id
         LEFT JOIN custom_exercises cx ON cx.id = we.custom_exercise_id
         WHERE we.workout_id = ?1
         ORDER BY we.order_index ASC`
      )
      .bind(workoutId, userId)
      .all<WorkoutExercise>();
    return rows.results;
  }

  async getWorkoutExercise(
    id: number,
    userId: number
  ): Promise<WorkoutExercise | null> {
    const row = await this.db
      .prepare(
        `SELECT we.* FROM workout_exercises we
         JOIN workouts w ON w.id = we.workout_id
         WHERE we.id = ?1 AND w.user_id = ?2 AND w.deleted_at IS NULL`
      )
      .bind(id, userId)
      .first<WorkoutExercise>();
    return row ?? null;
  }

  async getSetContext(
    setId: number,
    userId: number
  ): Promise<{ set_id: number; workout_exercise_id: number; exercise_id: number | null; workout_date: string } | null> {
    const row = await this.db
      .prepare(
        `SELECT
           s.id                 AS set_id,
           s.workout_exercise_id,
           we.exercise_id,
           w.workout_date
         FROM sets s
         JOIN workout_exercises we ON we.id = s.workout_exercise_id
         JOIN workouts w ON w.id = we.workout_id
         WHERE s.id = ?1
           AND w.user_id = ?2
           AND w.deleted_at IS NULL`
      )
      .bind(setId, userId)
      .first<{ set_id: number; workout_exercise_id: number; exercise_id: number | null; workout_date: string }>();
    return row ?? null;
  }

  // ─── Sets ───────────────────────────────────────────────────────────────────

  async addSet(
    workoutExerciseId: number,
    setNumber: number,
    weight: number | null,
    reps: number | null,
    restSeconds: number | null,
    rir: number | null,
    completed: boolean
  ): Promise<Set> {
    try {
      const row = await this.db
        .prepare(
          `INSERT INTO sets
             (workout_exercise_id, set_number, weight, reps, rest_seconds, rir, completed)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           RETURNING *`
        )
        .bind(
          workoutExerciseId,
          setNumber,
          weight,
          reps,
          restSeconds,
          rir,
          completed ? 1 : 0
        )
        .first<Set>();
      if (!row) throw new Error("Failed to add set");
      return row;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw conflict(
          "Такой номер подхода уже существует для этого упражнения в тренировке",
          ErrorCodes.SetDuplicate
        );
      }
      throw error;
    }
  }

  async getSets(workoutExerciseId: number): Promise<Set[]> {
    const rows = await this.db
      .prepare("SELECT * FROM sets WHERE workout_exercise_id = ?1 ORDER BY set_number ASC")
      .bind(workoutExerciseId)
      .all<Set>();
    return rows.results;
  }

  async updateSet(
    id: number,
    userId: number,
    fields: Partial<Pick<Set, "weight" | "reps" | "rest_seconds" | "rir" | "completed">>
  ): Promise<Set | null> {
    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (fields.weight !== undefined) { sets.push(`weight = ?${i++}`); values.push(fields.weight); }
    if (fields.reps !== undefined) { sets.push(`reps = ?${i++}`); values.push(fields.reps); }
    if (fields.rest_seconds !== undefined) { sets.push(`rest_seconds = ?${i++}`); values.push(fields.rest_seconds); }
    if (fields.rir !== undefined) { sets.push(`rir = ?${i++}`); values.push(fields.rir); }
    if (fields.completed !== undefined) { sets.push(`completed = ?${i++}`); values.push(fields.completed ? 1 : 0); }

    if (sets.length === 0) {
      return this.db
        .prepare(
          `SELECT s.* FROM sets s
           JOIN workout_exercises we ON we.id = s.workout_exercise_id
           JOIN workouts w ON w.id = we.workout_id
           WHERE s.id = ?1 AND w.user_id = ?2`
        )
        .bind(id, userId)
        .first<Set>() ?? null;
    }

    values.push(id, userId);
    const row = await this.db
      .prepare(
        `UPDATE sets SET ${sets.join(", ")}
         WHERE id = ?${i++}
           AND workout_exercise_id IN (
             SELECT we.id FROM workout_exercises we
             JOIN workouts w ON w.id = we.workout_id
             WHERE w.user_id = ?${i++} AND w.deleted_at IS NULL
           )
         RETURNING *`
      )
      .bind(...values)
      .first<Set>();
    return row ?? null;
  }

  async deleteSet(id: number, userId: number): Promise<boolean> {
    const result = await this.db
      .prepare(
        `DELETE FROM sets WHERE id = ?1
           AND workout_exercise_id IN (
             SELECT we.id FROM workout_exercises we
             JOIN workouts w ON w.id = we.workout_id
             WHERE w.user_id = ?2 AND w.deleted_at IS NULL
           )`
      )
      .bind(id, userId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  async deleteWorkoutExercise(id: number, userId: number): Promise<boolean> {
    const result = await this.db
      .prepare(
        `DELETE FROM workout_exercises WHERE id = ?1
           AND workout_id IN (
             SELECT id FROM workouts WHERE user_id = ?2 AND deleted_at IS NULL
           )`
      )
      .bind(id, userId)
      .run();
    return (result.meta.changes ?? 0) > 0;
  }

  async getExercisesWithSets(workoutId: number, userId: number): Promise<(WorkoutExercise & { sets: Set[] })[]> {
    const exercises = await this.getExercises(workoutId, userId);
    if (exercises.length === 0) return [];

    const ids = exercises.map((e) => e.id);
    const placeholders = ids.map((_, i) => `?${i + 1}`).join(", ");
    const rows = await this.db
      .prepare(`SELECT * FROM sets WHERE workout_exercise_id IN (${placeholders}) ORDER BY workout_exercise_id ASC, set_number ASC`)
      .bind(...ids)
      .all<Set>();

    const setsMap = new Map<number, Set[]>();
    for (const s of rows.results) {
      const arr = setsMap.get(s.workout_exercise_id) ?? [];
      arr.push(s);
      setsMap.set(s.workout_exercise_id, arr);
    }

    return exercises.map((e) => ({ ...e, sets: setsMap.get(e.id) ?? [] }));
  }
}
