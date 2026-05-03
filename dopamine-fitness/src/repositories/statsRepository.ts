import { prisma } from "../db/prisma.js";
import type { ProgressSnapshot, StatsPoint } from "../types/index.js";
import type { StatsSummary } from "../services/statsService.js";

export class StatsRepository {
  async recalculateExerciseSnapshot(userId: number, exerciseId: number, date: string): Promise<void> {
    type AggRow = {
      completed_sets: bigint | null;
      max_weight: number | null;
      max_reps: bigint | null;
      total_volume: number | null;
      one_rm_estimate: number | null;
    };

    const [agg] = await prisma.$queryRaw<AggRow[]>`
      SELECT
        COUNT(s.id)                                                        AS completed_sets,
        MAX(CASE WHEN s.weight IS NOT NULL THEN s.weight END)              AS max_weight,
        MAX(CASE WHEN s.reps IS NOT NULL THEN s.reps END)                  AS max_reps,
        COALESCE(SUM(CASE
          WHEN s.weight IS NOT NULL AND s.reps IS NOT NULL
          THEN s.weight * s.reps ELSE 0
        END), 0)                                                           AS total_volume,
        MAX(CASE
          WHEN s.weight IS NOT NULL AND s.reps IS NOT NULL AND s.reps > 0
          THEN ROUND(s.weight * (1 + s.reps / 30.0))
          ELSE NULL
        END)                                                               AS one_rm_estimate
      FROM sets s
      JOIN workout_exercises we ON we.id = s.workout_exercise_id
      JOIN workouts w ON w.id = we.workout_id
      WHERE w.user_id = ${userId}
        AND w.deleted_at IS NULL
        AND w.workout_date = ${date}
        AND we.exercise_id = ${exerciseId}
        AND s.completed = TRUE
    `;

    const completedSets = Number(agg?.completed_sets ?? 0);
    if (completedSets <= 0) {
      await prisma.progressSnapshot.deleteMany({
        where: { user_id: userId, exercise_id: exerciseId, date },
      });
      return;
    }

    await this.upsertSnapshot({
      user_id: userId,
      exercise_id: exerciseId,
      custom_exercise_id: null,
      date,
      weight: agg?.max_weight ?? null,
      reps: agg?.max_reps != null ? Number(agg.max_reps) : null,
      volume: agg?.total_volume ?? null,
      one_rm_estimate: agg?.one_rm_estimate ?? null,
    });
  }

  async getStats(userId: number, from: string, to: string): Promise<StatsPoint[]> {
    type StatsRow = {
      date: string;
      workout_count: bigint;
      volume: number;
      max_weight: number;
      total_reps: bigint;
    };

    const rows = await prisma.$queryRaw<StatsRow[]>`
      SELECT
        w.workout_date AS date,
        COUNT(DISTINCT w.id) AS workout_count,
        COALESCE(SUM(s.weight * s.reps), 0) AS volume,
        COALESCE(MAX(s.weight), 0) AS max_weight,
        COALESCE(SUM(s.reps), 0) AS total_reps
      FROM workouts w
      LEFT JOIN workout_exercises we ON we.workout_id = w.id
      LEFT JOIN sets s ON s.workout_exercise_id = we.id AND s.completed = TRUE
      WHERE w.user_id = ${userId}
        AND w.deleted_at IS NULL
        AND w.workout_date >= ${from}
        AND w.workout_date <= ${to}
      GROUP BY w.workout_date
      ORDER BY w.workout_date ASC
    `;

    return rows.map((r) => ({
      date: r.date,
      workout_count: Number(r.workout_count),
      volume: Number(r.volume),
      max_weight: Number(r.max_weight),
      total_reps: Number(r.total_reps),
    }));
  }

  async getExerciseProgress(
    userId: number,
    exerciseId: number,
    from: string,
    to: string
  ): Promise<ProgressSnapshot[]> {
    const rows = await prisma.progressSnapshot.findMany({
      where: {
        user_id: userId,
        exercise_id: exerciseId,
        date: { gte: from, lte: to },
      },
      orderBy: { date: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      exercise_id: r.exercise_id,
      custom_exercise_id: r.custom_exercise_id,
      date: r.date,
      weight: r.weight,
      reps: r.reps,
      volume: r.volume,
      one_rm_estimate: r.one_rm_estimate,
    }));
  }

  async upsertSnapshot(snap: Omit<ProgressSnapshot, "id">): Promise<void> {
    if (snap.exercise_id != null) {
      const existing = await prisma.progressSnapshot.findFirst({
        where: { user_id: snap.user_id, exercise_id: snap.exercise_id, date: snap.date },
      });
      if (existing) {
        await prisma.progressSnapshot.update({
          where: { id: existing.id },
          data: {
            weight: snap.weight,
            reps: snap.reps,
            volume: snap.volume,
            one_rm_estimate: snap.one_rm_estimate,
          },
        });
      } else {
        await prisma.progressSnapshot.create({
          data: {
            user_id: snap.user_id,
            exercise_id: snap.exercise_id,
            custom_exercise_id: null,
            date: snap.date,
            weight: snap.weight,
            reps: snap.reps,
            volume: snap.volume,
            one_rm_estimate: snap.one_rm_estimate,
          },
        });
      }
      return;
    }

    if (snap.custom_exercise_id != null) {
      const existing = await prisma.progressSnapshot.findFirst({
        where: { user_id: snap.user_id, custom_exercise_id: snap.custom_exercise_id, date: snap.date },
      });
      if (existing) {
        await prisma.progressSnapshot.update({
          where: { id: existing.id },
          data: {
            weight: snap.weight,
            reps: snap.reps,
            volume: snap.volume,
            one_rm_estimate: snap.one_rm_estimate,
          },
        });
      } else {
        await prisma.progressSnapshot.create({
          data: {
            user_id: snap.user_id,
            exercise_id: null,
            custom_exercise_id: snap.custom_exercise_id,
            date: snap.date,
            weight: snap.weight,
            reps: snap.reps,
            volume: snap.volume,
            one_rm_estimate: snap.one_rm_estimate,
          },
        });
      }
    }
  }

  async getSummary(userId: number): Promise<StatsSummary> {
    type SummaryRow = {
      total_workouts: bigint;
      total_volume: number;
      total_sets: bigint;
      max_weight: number;
      active_days: bigint;
    };

    const [row] = await prisma.$queryRaw<SummaryRow[]>`
      SELECT
        COUNT(DISTINCT w.id) AS total_workouts,
        COALESCE(SUM(s.weight * s.reps), 0) AS total_volume,
        COUNT(s.id) AS total_sets,
        COALESCE(MAX(s.weight), 0) AS max_weight,
        COUNT(DISTINCT w.workout_date) AS active_days
      FROM workouts w
      LEFT JOIN workout_exercises we ON we.workout_id = w.id
      LEFT JOIN sets s ON s.workout_exercise_id = we.id AND s.completed = TRUE
      WHERE w.user_id = ${userId} AND w.deleted_at IS NULL
    `;

    return {
      total_workouts: Number(row?.total_workouts ?? 0),
      total_volume: Number(row?.total_volume ?? 0),
      total_sets: Number(row?.total_sets ?? 0),
      max_weight: Number(row?.max_weight ?? 0),
      active_days: Number(row?.active_days ?? 0),
    };
  }
}
