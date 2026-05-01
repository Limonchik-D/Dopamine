import type { StatsPoint } from "../types/index.js";
import type { StatsPeriod } from "../types/index.js";
import { StatsRepository } from "../repositories/statsRepository.js";
import { dateRangeForPeriod } from "../utils/helpers.js";

export type ExerciseProgressPoint = {
  date: string;
  weight: number | null;
  reps: number | null;
  volume: number | null;
  one_rm_estimate: number | null;
};

export type StatsSummary = {
  total_workouts: number;
  total_volume: number;
  total_sets: number;
  max_weight: number;
  active_days: number;
};

export class StatsService {
  private repo: StatsRepository;

  constructor(db: D1Database) {
    this.repo = new StatsRepository(db);
  }

  async getStats(
    userId: number,
    period: StatsPeriod
  ): Promise<{ points: StatsPoint[]; period: StatsPeriod; from: string; to: string }> {
    const { from, to } = dateRangeForPeriod(period);
    const points = await this.repo.getStats(userId, from, to);
    return { points, period, from, to };
  }

  async getExerciseProgress(
    userId: number,
    exerciseId: number,
    period: StatsPeriod
  ): Promise<{ points: ExerciseProgressPoint[]; period: StatsPeriod; from: string; to: string }> {
    const { from, to } = dateRangeForPeriod(period);
    const snapshots = await this.repo.getExerciseProgress(userId, exerciseId, from, to);
    const points: ExerciseProgressPoint[] = snapshots.map((s) => ({
      date: s.date,
      weight: s.weight,
      reps: s.reps,
      volume: s.volume,
      one_rm_estimate: s.one_rm_estimate,
    }));
    return { points, period, from, to };
  }

  async getSummary(userId: number): Promise<StatsSummary> {
    return this.repo.getSummary(userId);
  }
}
