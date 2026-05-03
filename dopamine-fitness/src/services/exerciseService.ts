import type { ExerciseCatalog, Env } from "../types/index.js";
import type { ExerciseFilterInput } from "../validators/schemas.js";
import { ExerciseRepository } from "../repositories/exerciseRepository.js";
import { ExerciseDBIntegration } from "../integrations/exercisedb/client.js";
import { WgerIntegration } from "../integrations/wger/client.js";
import { TranslationService } from "./translationService.js";
import { getAppConfig } from "../config/env.js";

const CATALOG_CACHE_KEY = "exercise_catalog_synced";

// Русские переводы категорий и оборудования из Wger
const CATEGORY_RU: Record<string, string> = {
  Abs: "Пресс",
  Arms: "Руки",
  Back: "Спина",
  Calves: "Икры",
  Chest: "Грудь",
  Legs: "Ноги",
  Shoulders: "Плечи",
};

const EQUIPMENT_RU: Record<string, string> = {
  Barbell: "Штанга",
  "Body weight": "Без оборудования",
  Dumbbell: "Гантели",
  Cables: "Блок/тросы",
  Kettlebell: "Гиря",
  "Resistance Band": "Эспандер",
  "Bench": "Скамья",
  "Pull-up Bar": "Турник",
  Machine: "Тренажёр",
  Plate: "Диск",
  "Ez-Bar": "EZ-гриф",
  "Medicine Ball": "Медбол",
  "Foam Roll": "Ролл",
  "Incline Bench": "Наклонная скамья",
  "Decline Bench": "Обратная скамья",
  "Swiss Ball": "Фитбол",
  "Pec deck": "Баттерфляй",
  "Rope": "Канат",
  "Sled": "Сани",
  none: "Без оборудования",
};

export class ExerciseService {
  private repo: ExerciseRepository;

  constructor(private env: Env) {
    this.repo = new ExerciseRepository();
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
    const cached = await this.env.KV.get(cacheKey, "json") as {
      targets: string[];
      equipment: string[];
      bodyParts: string[];
    } | null;

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
        const name = WgerIntegration.getName(ex);
        const description = WgerIntegration.getDescription(ex);
        const bodyPart = ex.category?.name ?? null;
        const equipment = ex.equipment[0]?.name ?? null;
        const target = ex.muscles[0]?.name_en ?? ex.muscles[0]?.name ?? null;
        await this.repo.upsertFromExternal({
          source: "wger",
          source_exercise_id: String(ex.id),
          name_en: name,
          name_ru: null,
          target: target,
          equipment: equipment ? (EQUIPMENT_RU[equipment] ?? equipment) : null,
          body_part: bodyPart ? (CATEGORY_RU[bodyPart] ?? bodyPart) : null,
          gif_url: null,
          image_url: null,
          instructions_en: description || null,
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
            equipment: ex.equipment ? (EQUIPMENT_RU[ex.equipment] ?? ex.equipment) : null,
            body_part: ex.bodyPart ? (CATEGORY_RU[ex.bodyPart] ?? ex.bodyPart) : null,
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

  /**
   * Переводит пачку непереведённых упражнений через MyMemory API.
   * @param batchSize — сколько упражнений переводить за один вызов (по умолчанию 50)
   * @returns { translated, remaining }
   */
  async translateCatalog(batchSize = 50): Promise<{ translated: number; remaining: number }> {
    const translator = new TranslationService(this.env.KV);
    const untranslated = await this.repo.findUntranslated(batchSize);

    if (untranslated.length === 0) {
      const remaining = await this.repo.countUntranslated();
      return { translated: 0, remaining };
    }

    const results = await translator.translateBatch(untranslated);

    for (const r of results) {
      if (r.name_ru) {
        await this.repo.updateTranslation(r.id, r.name_ru, r.instructions_ru);
      }
    }

    // Сбрасываем кеш фильтров после перевода
    await this.env.KV.delete("exercise_filters");

    const remaining = await this.repo.countUntranslated();
    return { translated: results.filter((r) => r.name_ru !== null).length, remaining };
  }

  /**
   * Background backfill for list endpoint:
   * translates a small chunk of currently visible exercises that still have no Russian name.
   */
  async backfillVisibleTranslations(exercises: ExerciseCatalog[], maxItems = 6): Promise<void> {
    const missing = exercises
      .filter((exercise) => !exercise.name_ru || exercise.name_ru.trim() === "")
      .slice(0, maxItems)
      .map((exercise) => ({
        id: exercise.id,
        name_en: exercise.name_en,
        instructions_en: exercise.instructions_en,
      }));

    if (missing.length === 0) return;

    const translator = new TranslationService(this.env.KV);
    const translated = await translator.translateBatch(missing);

    for (const item of translated) {
      if (!item.name_ru && !item.instructions_ru) continue;
      await this.repo.updateTranslation(item.id, item.name_ru, item.instructions_ru);
    }
  }
}
