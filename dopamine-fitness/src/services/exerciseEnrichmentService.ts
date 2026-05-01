/**
 * ExerciseEnrichmentService
 *
 * Orchestrates on-demand enrichment of an exercise with:
 *  - GIF URL from ExerciseDB (RapidAPI)
 *  - Difficulty + instructions from API-Ninjas
 *
 * Caching strategy:
 *  - KV key: `enrich:v1:<exercise_id>` → JSON blob, TTL 7 days
 *  - After first successful enrichment the result is also persisted back to D1
 *    so future cold starts skip both KV and external APIs.
 */

import type { Env } from "../types/index.js";
import { getAppConfig } from "../config/env.js";
import { ExerciseDBIntegration } from "../integrations/exercisedb/client.js";
import { NinjasClient } from "../integrations/ninjas/client.js";
import { bestMatch, normalizeName } from "../utils/nameMatch.js";

const KV_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const kvKey = (id: number) => `enrich:v1:${id}`;

export interface EnrichedExercise {
  id: number;
  name_en: string;
  name_ru: string | null;
  target: string | null;
  equipment: string | null;
  body_part: string | null;
  gif_url: string | null;
  image_url: string | null;
  instructions_en: string | null;
  instructions_ru: string | null;
  difficulty: string | null;
  secondary_muscles: string[] | null;
  source: string;
  /** Which external sources contributed to this result */
  enriched_from: string[];
}

export class ExerciseEnrichmentService {
  private readonly config;

  constructor(private readonly env: Env) {
    this.config = getAppConfig(env);
  }

  // ── Public ────────────────────────────────────────────────────────────────

  /**
   * Return enriched exercise data.
   * Order: KV cache → D1 persisted enrichment → live API calls
   */
  async enrich(exerciseId: number): Promise<EnrichedExercise> {
    // 1. KV cache
    const cached = await this.env.KV.get(kvKey(exerciseId), "json") as EnrichedExercise | null;
    if (cached) return cached;

    // 2. Load base row from D1
    const base = await this.env.DB
      .prepare("SELECT * FROM exercise_catalog WHERE id = ?1")
      .bind(exerciseId)
      .first<{
        id: number; name_en: string; name_ru: string | null; target: string | null;
        equipment: string | null; body_part: string | null; gif_url: string | null;
        image_url: string | null; instructions_en: string | null; instructions_ru: string | null;
        difficulty: string | null; secondary_muscles: string | null; source: string;
      }>();

    if (!base) throw new Error("Exercise not found");

    // 3. If already fully enriched (has gif + difficulty + instructions) → cache and return
    if (base.gif_url && base.difficulty && base.instructions_en) {
      const result = this.toEnriched(base, []);
      await this.cacheKV(result);
      return result;
    }

    // 4. Live enrichment
    const enrichedFrom: string[] = [];
    let gif_url = base.gif_url;
    let instructions_en = base.instructions_en;
    let difficulty: string | null = base.difficulty ?? null;
    let secondary_muscles: string[] | null = base.secondary_muscles
      ? (JSON.parse(base.secondary_muscles) as string[])
      : null;

    // ── ExerciseDB: fetch GIF if missing ───────────────────────────────────
    if (!gif_url && this.config.exercise.exerciseDbApiKey) {
      try {
        const edb = new ExerciseDBIntegration(
          this.config.exercise.exerciseDbBaseUrl,
          this.config.exercise.exerciseDbApiKey
        );
        // Search by name — try exact then fuzzy
        const candidates = await edb.fetchByName(base.name_en);
        if (candidates.length > 0) {
          const match = bestMatch(
            base.name_en,
            candidates.map((c) => ({ id: c.id, name: c.name }))
          );
          const item = match ? candidates.find((c) => c.id === match.id) ?? candidates[0] : candidates[0];
          if (item) {
            gif_url = item.gifUrl;
            if (!secondary_muscles && item.secondaryMuscles.length > 0) {
              secondary_muscles = item.secondaryMuscles;
            }
            if (!instructions_en && item.instructions.length > 0) {
              instructions_en = item.instructions.join(". ");
            }
            enrichedFrom.push("exercisedb");
            // Persist name mapping
            await this.persistNameMap(exerciseId, "exercisedb", item.id, item.name, match?.confidence ?? 0.85);
          }
        }
      } catch {
        // ExerciseDB unavailable — continue
      }
    }

    // ── API-Ninjas: fetch difficulty + instructions if missing ─────────────
    if ((!difficulty || !instructions_en) && this.hasNinjasKey()) {
      try {
        const ninjas = new NinjasClient(this.getNinjasKey());
        const results = await ninjas.fetchByName(base.name_en);
        if (results.length > 0) {
          const match = bestMatch(
            base.name_en,
            results.map((r, i) => ({ id: String(i), name: r.name }))
          );
          const item = match ? results[parseInt(match.id, 10)] : results[0];
          if (item) {
            difficulty = difficulty ?? item.difficulty;
            instructions_en = instructions_en ?? item.instructions;
            enrichedFrom.push("ninjas");
            await this.persistNameMap(exerciseId, "ninjas", normalizeName(item.name), item.name, match?.confidence ?? 0.85);
          }
        }
      } catch {
        // API-Ninjas unavailable — continue
      }
    }

    // ── Persist enrichment back to D1 ─────────────────────────────────────
    await this.env.DB
      .prepare(
        `UPDATE exercise_catalog SET
           gif_url = COALESCE(?1, gif_url),
           instructions_en = COALESCE(?2, instructions_en),
           difficulty = COALESCE(?3, difficulty),
           secondary_muscles = COALESCE(?4, secondary_muscles),
           name_normalized = ?5
         WHERE id = ?6`
      )
      .bind(
        gif_url,
        instructions_en,
        difficulty,
        secondary_muscles ? JSON.stringify(secondary_muscles) : null,
        normalizeName(base.name_en),
        exerciseId
      )
      .run();

    const result: EnrichedExercise = {
      id: base.id,
      name_en: base.name_en,
      name_ru: base.name_ru,
      target: base.target,
      equipment: base.equipment,
      body_part: base.body_part,
      gif_url,
      image_url: base.image_url,
      instructions_en,
      instructions_ru: base.instructions_ru,
      difficulty,
      secondary_muscles,
      source: base.source,
      enriched_from: enrichedFrom,
    };

    await this.cacheKV(result);
    return result;
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private toEnriched(
    row: {
      id: number; name_en: string; name_ru: string | null; target: string | null;
      equipment: string | null; body_part: string | null; gif_url: string | null;
      image_url: string | null; instructions_en: string | null; instructions_ru: string | null;
      difficulty: string | null; secondary_muscles: string | null; source: string;
    },
    enrichedFrom: string[]
  ): EnrichedExercise {
    return {
      ...row,
      secondary_muscles: row.secondary_muscles ? JSON.parse(row.secondary_muscles) as string[] : null,
      enriched_from: enrichedFrom,
    };
  }

  private async cacheKV(data: EnrichedExercise): Promise<void> {
    await this.env.KV.put(kvKey(data.id), JSON.stringify(data), {
      expirationTtl: KV_TTL_SECONDS,
    });
  }

  private async persistNameMap(
    exerciseId: number,
    source: string,
    externalId: string,
    externalName: string,
    confidence: number
  ): Promise<void> {
    try {
      await this.env.DB
        .prepare(
          `INSERT OR REPLACE INTO exercise_name_map
             (exercise_id, external_source, external_id, external_name, confidence)
           VALUES (?1, ?2, ?3, ?4, ?5)`
        )
        .bind(exerciseId, source, externalId, externalName, confidence)
        .run();
    } catch {
      // Non-critical — don't fail enrichment
    }
  }

  private hasNinjasKey(): boolean {
    return Boolean((this.env as unknown as Record<string, string>)["NINJAS_API_KEY"]);
  }

  private getNinjasKey(): string {
    return ((this.env as unknown as Record<string, string>)["NINJAS_API_KEY"]) ?? "";
  }
}
