import type { ProgressSnapshot, StatsPoint } from "../types/index.js";
import type { StatsSummary } from "../services/statsService.js";

export class StatsRepository {
  constructor(private db: D1Database) {}

  async recalculateExerciseSnapshot(userId: number, exerciseId: number, date: string): Promise<void> {
    const aggregate = await this.db
      .prepare(
        `SELECT
           COUNT(s.id)                                                        AS completed_sets,
           MAX(CASE WHEN s.weight IS NOT NULL THEN s.weight END)              AS max_weight,
           MAX(CASE WHEN s.reps IS NOT NULL THEN s.reps END)                  AS max_reps,
           COALESCE(SUM(CASE
             WHEN s.weight IS NOT NULL AND s.reps IS NOT NULL
             THEN s.weight * s.reps
             ELSE 0
           END), 0)                                                           AS total_volume,
           MAX(CASE
             WHEN s.weight IS NOT NULL AND s.reps IS NOT NULL AND s.reps > 0
             THEN ROUND(s.weight * (1 + s.reps / 30.0))
             ELSE NULL
           END)                                                               AS one_rm_estimate
         FROM sets s
         JOIN workout_exercises we ON we.id = s.workout_exercise_id
         JOIN workouts w ON w.id = we.workout_id
         WHERE w.user_id = ?1
           AND w.deleted_at IS NULL
           AND w.workout_date = ?2
           AND we.exercise_id = ?3
           AND s.completed = 1`
      )
      .bind(userId, date, exerciseId)
      .first<{
        completed_sets: number | null;
        max_weight: number | null;
        max_reps: number | null;
        total_volume: number | null;
        one_rm_estimate: number | null;
      }>();

    const completedSets = aggregate?.completed_sets ?? 0;
    if (completedSets <= 0) {
      await this.db
        .prepare(
          `DELETE FROM progress_snapshots
           WHERE user_id = ?1 AND exercise_id = ?2 AND date = ?3`
        )
        .bind(userId, exerciseId, date)
        .run();
      return;
    }

    await this.upsertSnapshot({
      user_id: userId,
      exercise_id: exerciseId,
      custom_exercise_id: null,
      date,
      weight: aggregate?.max_weight ?? null,
      reps: aggregate?.max_reps ?? null,
      volume: aggregate?.total_volume ?? null,
      one_rm_estimate: aggregate?.one_rm_estimate ?? null,
    });
  }

  async getStats(
    userId: number,
    from: string,
    to: string
  ): Promise<StatsPoint[]> {
    const rows = await this.db
      .prepare(
        `SELECT
           w.workout_date as date,
           COUNT(DISTINCT w.id) as workout_count,
           COALESCE(SUM(s.weight * s.reps), 0) as volume,
           COALESCE(MAX(s.weight), 0) as max_weight,
           COALESCE(SUM(s.reps), 0) as total_reps
         FROM workouts w
         LEFT JOIN workout_exercises we ON we.workout_id = w.id
         LEFT JOIN sets s ON s.workout_exercise_id = we.id AND s.completed = 1
         WHERE w.user_id = ?1
           AND w.deleted_at IS NULL
           AND w.workout_date >= ?2
           AND w.workout_date <= ?3
         GROUP BY w.workout_date
         ORDER BY w.workout_date ASC`
      )
      .bind(userId, from, to)
      .all<StatsPoint>();
    return rows.results;
  }

  async getExerciseProgress(
    userId: number,
    exerciseId: number,
    from: string,
    to: string
  ): Promise<ProgressSnapshot[]> {
    const rows = await this.db
      .prepare(
        `SELECT * FROM progress_snapshots
         WHERE user_id = ?1 AND exercise_id = ?2
           AND date >= ?3 AND date <= ?4
         ORDER BY date ASC`
      )
      .bind(userId, exerciseId, from, to)
      .all<ProgressSnapshot>();
    return rows.results;
  }

  async upsertSnapshot(snap: Omit<ProgressSnapshot, "id">): Promise<void> {
    const values = [
      snap.user_id,
      snap.exercise_id,
      snap.custom_exercise_id,
      snap.date,
      snap.weight,
      snap.reps,
      snap.volume,
      snap.one_rm_estimate,
    ];

    if (snap.exercise_id != null) {
      await this.db
        .prepare(
          `INSERT INTO progress_snapshots
             (user_id, exercise_id, custom_exercise_id, date, weight, reps, volume, one_rm_estimate)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
           ON CONFLICT(user_id, exercise_id, date)
           WHERE exercise_id IS NOT NULL
           DO UPDATE SET
             weight = excluded.weight,
             reps = excluded.reps,
             volume = excluded.volume,
             one_rm_estimate = excluded.one_rm_estimate`
        )
        .bind(...values)
        .run();
      return;
    }

    await this.db
      .prepare(
        `INSERT INTO progress_snapshots
           (user_id, exercise_id, custom_exercise_id, date, weight, reps, volume, one_rm_estimate)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(user_id, custom_exercise_id, date)
         WHERE custom_exercise_id IS NOT NULL
         DO UPDATE SET
           weight = excluded.weight,
           reps = excluded.reps,
           volume = excluded.volume,
           one_rm_estimate = excluded.one_rm_estimate`
      )
      .bind(...values)
      .run();
  }

  async getSummary(userId: number): Promise<StatsSummary> {
    const row = await this.db
      .prepare(
        `SELECT
           COUNT(DISTINCT w.id) as total_workouts,
           COALESCE(SUM(s.weight * s.reps), 0) as total_volume,
           COUNT(s.id) as total_sets,
           COALESCE(MAX(s.weight), 0) as max_weight,
           COUNT(DISTINCT w.workout_date) as active_days
         FROM workouts w
         LEFT JOIN workout_exercises we ON we.workout_id = w.id
         LEFT JOIN sets s ON s.workout_exercise_id = we.id AND s.completed = 1
         WHERE w.user_id = ?1 AND w.deleted_at IS NULL`
      )
      .bind(userId)
      .first<StatsSummary>();
    return row ?? { total_workouts: 0, total_volume: 0, total_sets: 0, max_weight: 0, active_days: 0 };
  }
}
