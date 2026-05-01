import type { ProgressSnapshot, StatsPoint } from "../types/index.js";
import type { StatsSummary } from "../services/statsService.js";

export class StatsRepository {
  constructor(private db: D1Database) {}

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
    const conflictTarget = snap.exercise_id
      ? "(user_id, exercise_id, date)"
      : "(user_id, custom_exercise_id, date)";

    await this.db
      .prepare(
        `INSERT INTO progress_snapshots
           (user_id, exercise_id, custom_exercise_id, date, weight, reps, volume, one_rm_estimate)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT${conflictTarget} DO UPDATE SET
           weight = excluded.weight,
           reps = excluded.reps,
           volume = excluded.volume,
           one_rm_estimate = excluded.one_rm_estimate`
      )
      .bind(
        snap.user_id,
        snap.exercise_id,
        snap.custom_exercise_id,
        snap.date,
        snap.weight,
        snap.reps,
        snap.volume,
        snap.one_rm_estimate
      )
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
