import type { StatsPoint } from "../types/index.js";
import type { StatsPeriod } from "../types/index.js";
import { StatsRepository } from "../repositories/statsRepository.js";
import { dateRangeForPeriod } from "../utils/helpers.js";

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
}
