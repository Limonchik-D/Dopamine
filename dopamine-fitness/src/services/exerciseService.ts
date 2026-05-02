import type { ExerciseCatalog, Env } from "../types/index.js";
import type { ExerciseFilterInput } from "../validators/schemas.js";
import { ExerciseRepository } from "../repositories/exerciseRepository.js";
import { ExerciseDBIntegration } from "../integrations/exercisedb/client.js";
import { WgerIntegration } from "../integrations/wger/client.js";
import { getAppConfig } from "../config/env.js";

const CATALOG_CACHE_KEY = "exercise_catalog_synced";

export class ExerciseService {
  private repo: ExerciseRepository;

  constructor(private env: Env) {
    this.repo = new ExerciseRepository(env.DB);
  }

  async list(filters: ExerciseFilterInput): Promise<{
    exercises: ExerciseCatalog[];
    total: number;
    hasNext: boolean;
  }> {
    const { exercises, total } = await this.repo.findMany(filters);
    const offset = (filters.page - 1) * filters.limit;
    return { exercises, total, hasNext: offset + exercises.length < total };
  }

  async getById(id: number): Promise<ExerciseCatalog> {
    const exercise = await this.repo.findById(id);
    if (!exercise) throw new Error("Not found");
    return exercise;
  }

  async getFilters(): Promise<{
    targets: string[];
    equipment: string[];
    bodyParts: string[];
  }> {
    const cacheKey = "exercise_filters";
    const cached = await this.env.KV.get<{
      targets: string[];
      equipment: string[];
      bodyParts: string[];
    }>(cacheKey, "json");

    if (cached) return cached;

    const [targets, equipment, bodyParts] = await Promise.all([
      this.repo.getDistinctTargets(),
      this.repo.getDistinctEquipment(),
      this.repo.getDistinctBodyParts(),
    ]);

    const config = getAppConfig(this.env);
    const result = { targets, equipment, bodyParts };
    await this.env.KV.put(cacheKey, JSON.stringify(result), {
      expirationTtl: config.exercise.cacheTtlSeconds,
    });
    return result;
  }

  async isCatalogEmpty(): Promise<boolean> {
    const { total } = await this.repo.findMany({ page: 1, limit: 1 });
    return total === 0;
  }

  // ─── Sync from ExerciseDB (called manually or via cron) ──────────────────

  async syncFromExternalAPIs(force = false): Promise<{ synced: number; source: string }> {
    const config = getAppConfig(this.env);

    if (!force) {
      const alreadySynced = await this.env.KV.get(CATALOG_CACHE_KEY);
      if (alreadySynced) return { synced: 0, source: "cache_hit" };
    }

    // ── Primary: wger (free, no key needed) ──────────────────────────────────
    try {
      const wger = new WgerIntegration(config.exercise.wgerBaseUrl);
      const exercises = await wger.fetchAll();
      let synced = 0;
      for (const ex of exercises) {
        await this.repo.upsertFromExternal({
          source: "wger",
          source_exercise_id: String(ex.id),
          name_en: ex.name,
          name_ru: null,
          target: ex.muscles[0]?.name_en ?? null,
          equipment: ex.equipment[0]?.name ?? null,
          body_part: ex.category?.name ?? null,
          gif_url: null,
          image_url: null,
          instructions_en: ex.description,
          instructions_ru: null,
        });
        synced++;
      }
      await this.env.KV.put(CATALOG_CACHE_KEY, "1", { expirationTtl: config.exercise.cacheTtlSeconds });
      return { synced, source: "wger" };
    } catch { /* fall through to ExerciseDB */ }

    // ── Fallback: ExerciseDB (requires paid API key) ──────────────────────────
    if (config.exercise.exerciseDbApiKey) {
      try {
        const client = new ExerciseDBIntegration(config.exercise.exerciseDbBaseUrl, config.exercise.exerciseDbApiKey);
        const exercises = await client.fetchAll();
        let synced = 0;
        for (const ex of exercises) {
          await this.repo.upsertFromExternal({
            source: "exercisedb",
            source_exercise_id: ex.id,
            name_en: ex.name,
            name_ru: null,
            target: ex.target,
            equipment: ex.equipment,
            body_part: ex.bodyPart,
            gif_url: ex.gifUrl,
            image_url: null,
            instructions_en: ex.instructions.join(" "),
            instructions_ru: null,
          });
          synced++;
        }
        await this.env.KV.put(CATALOG_CACHE_KEY, "1", { expirationTtl: config.exercise.cacheTtlSeconds });
        return { synced, source: "exercisedb" };
      } catch { /* fall through */ }
    }

    return { synced: 0, source: "failed" };
  }
}
