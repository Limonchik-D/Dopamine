import type { ExerciseCatalog } from "../types/index.js";
import type { ExerciseFilterInput } from "../validators/schemas.js";

type SearchAlias = {
  needle: string;
  expansions: string[];
};

const PHRASE_ALIASES: SearchAlias[] = [
  { needle: "жим лежа", expansions: ["bench press", "chest press", "barbell bench press", "dumbbell bench press"] },
  { needle: "жим стоя", expansions: ["overhead press", "shoulder press"] },
  { needle: "становая тяга", expansions: ["deadlift", "romanian deadlift"] },
  { needle: "румынская тяга", expansions: ["romanian deadlift", "rdl"] },
  { needle: "тяга горизонтального блока", expansions: ["seated cable row", "cable row"] },
  { needle: "тяга верхнего блока", expansions: ["lat pulldown"] },
  { needle: "тяга штанги", expansions: ["barbell row", "bent over row"] },
  { needle: "жим ногами", expansions: ["leg press"] },
  { needle: "сгибание ног", expansions: ["leg curl", "hamstring curl"] },
  { needle: "разгибание ног", expansions: ["leg extension"] },
  { needle: "ягодичный мост", expansions: ["hip thrust", "glute bridge"] },
  { needle: "тяга к лицу", expansions: ["face pull"] },
  { needle: "жим гантелей", expansions: ["dumbbell press", "incline dumbbell press"] },
  { needle: "разведение гантелей", expansions: ["lateral raise", "dumbbell fly"] },
  { needle: "скручивания", expansions: ["crunch", "ab crunch"] },
  { needle: "планка", expansions: ["plank"] },
  { needle: "выпады", expansions: ["lunge", "walking lunge"] },
  { needle: "отжимания на брусьях", expansions: ["dips", "parallel bar dips"] },
  { needle: "подтягивания", expansions: ["pull up", "chin up"] },
  { needle: "отжимания", expansions: ["push up"] },
];

const TOKEN_ALIASES: Record<string, string[]> = {
  жим: ["press", "bench", "chest press", "shoulder press"],
  лежа: ["bench"],
  стоя: ["standing"],
  тяга: ["row", "pull", "deadlift"],
  присед: ["squat", "front squat", "back squat"],
  выпады: ["lunge", "walking lunge"],
  бицепс: ["biceps", "curl"],
  трицепс: ["triceps", "extension", "pushdown"],
  трицепса: ["triceps", "extension", "pushdown"],
  плечи: ["shoulder", "deltoid"],
  плечо: ["shoulder", "deltoid"],
  дельты: ["deltoid", "shoulder", "lateral raise"],
  грудь: ["chest", "pec"],
  грудные: ["chest", "pec"],
  спина: ["back", "lat"],
  широчайшие: ["lats", "lat"],
  пресс: ["abs", "core", "abdominal", "crunch", "plank"],
  ноги: ["legs", "quads", "hamstrings", "calves"],
  ягодицы: ["glute", "glutes", "hip thrust"],
  ягодиц: ["glute", "glutes", "hip thrust"],
  икры: ["calf", "calves"],
  подтягивания: ["pull up", "chin up"],
  отжимания: ["push up", "dips"],
  брусья: ["dip", "dips"],
  планка: ["plank"],
};

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ").trim();
}

function withCapitalizedFirst(term: string): string {
  if (!term) return term;
  return term.charAt(0).toUpperCase() + term.slice(1);
}

function expandSearchTerms(rawSearch: string): string[] {
  const normalized = normalizeSearch(rawSearch);
  if (!normalized) return [];

  const terms = new Set<string>();
  terms.add(normalized);
  const capitalizedNormalized = withCapitalizedFirst(normalized);
  if (capitalizedNormalized !== normalized) terms.add(capitalizedNormalized);

  for (const alias of PHRASE_ALIASES) {
    if (normalized.includes(alias.needle)) {
      for (const expansion of alias.expansions) {
        terms.add(expansion);
        const capitalized = withCapitalizedFirst(expansion);
        if (capitalized !== expansion) terms.add(capitalized);
      }
    }
  }

  for (const token of normalized.split(" ")) {
    const expansions = TOKEN_ALIASES[token];
    if (!expansions) continue;
    for (const expansion of expansions) {
      terms.add(expansion);
      const capitalized = withCapitalizedFirst(expansion);
      if (capitalized !== expansion) terms.add(capitalized);
    }
  }

  return Array.from(terms).filter((term) => term.length >= 2).slice(0, 24);
}

export class ExerciseRepository {
  constructor(private db: D1Database) {}

  async findMany(filters: ExerciseFilterInput): Promise<{ exercises: ExerciseCatalog[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    const primarySearchPlaceholders: string[] = [];

    if (filters.search) {
      const searchTerms = expandSearchTerms(filters.search);
      const searchClauses: string[] = [];

      for (const term of searchTerms) {
        const placeholder = `?${i++}`;
        if (primarySearchPlaceholders.length < 2) primarySearchPlaceholders.push(placeholder);
        values.push(`%${term}%`);
        searchClauses.push(
          `(LOWER(name_en) LIKE ${placeholder}
            OR LOWER(REPLACE(COALESCE(name_ru, ''), 'ё', 'е')) LIKE ${placeholder}
            OR LOWER(REPLACE(COALESCE(target, ''), 'ё', 'е')) LIKE ${placeholder}
            OR LOWER(REPLACE(COALESCE(equipment, ''), 'ё', 'е')) LIKE ${placeholder}
            OR LOWER(REPLACE(COALESCE(body_part, ''), 'ё', 'е')) LIKE ${placeholder})`
        );
      }

      if (searchClauses.length > 0) {
        conditions.push(`(${searchClauses.join(" OR ")})`);
      }
    }
    if (filters.target) {
      conditions.push(`target = ?${i++}`);
      values.push(filters.target);
    }
    if (filters.equipment) {
      conditions.push(`equipment = ?${i++}`);
      values.push(filters.equipment);
    }
    if (filters.body_part) {
      conditions.push(`body_part = ?${i++}`);
      values.push(filters.body_part);
    }
    if (filters.source) {
      conditions.push(`source = ?${i++}`);
      values.push(filters.source);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const primaryCondition = primarySearchPlaceholders.length > 0
      ? primarySearchPlaceholders
          .map((placeholder) => `LOWER(REPLACE(COALESCE(name_ru, ''), 'ё', 'е')) LIKE ${placeholder}`)
          .join(" OR ")
      : null;

    const orderBy = primaryCondition
      ? `CASE
           WHEN (${primaryCondition}) THEN 0
           WHEN LOWER(name_en) LIKE ${primarySearchPlaceholders[0]} THEN 1
           WHEN LOWER(REPLACE(COALESCE(target, ''), 'ё', 'е')) LIKE ${primarySearchPlaceholders[0]} THEN 2
           WHEN LOWER(REPLACE(COALESCE(equipment, ''), 'ё', 'е')) LIKE ${primarySearchPlaceholders[0]} THEN 3
           ELSE 9
         END, name_en`
      : "name_en";
    const limit = filters.limit;
    const offset = (filters.page - 1) * limit;

    const [rows, countRow] = await Promise.all([
      this.db
        .prepare(`SELECT * FROM exercise_catalog ${where} ORDER BY ${orderBy} LIMIT ?${i} OFFSET ?${i + 1}`)
        .bind(...values, limit, offset)
        .all<ExerciseCatalog>(),
      this.db
        .prepare(`SELECT COUNT(*) as cnt FROM exercise_catalog ${where}`)
        .bind(...values)
        .first<{ cnt: number }>(),
    ]);

    return { exercises: rows.results, total: countRow?.cnt ?? 0 };
  }

  async findById(id: number): Promise<ExerciseCatalog | null> {
    const row = await this.db
      .prepare("SELECT * FROM exercise_catalog WHERE id = ?1")
      .bind(id)
      .first<ExerciseCatalog>();
    return row ?? null;
  }

  async upsertFromExternal(exercise: Omit<ExerciseCatalog, "id">): Promise<number> {
    const result = await this.db
      .prepare(
        `INSERT INTO exercise_catalog
           (source, source_exercise_id, name_en, name_ru, target, equipment,
            body_part, gif_url, image_url, instructions_en, instructions_ru)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT(source, source_exercise_id) DO UPDATE SET
           name_en = excluded.name_en,
           target = excluded.target,
           equipment = excluded.equipment,
           body_part = excluded.body_part,
           gif_url = excluded.gif_url,
           image_url = excluded.image_url,
           instructions_en = excluded.instructions_en
         RETURNING id`
      )
      .bind(
        exercise.source,
        exercise.source_exercise_id,
        exercise.name_en,
        exercise.name_ru,
        exercise.target,
        exercise.equipment,
        exercise.body_part,
        exercise.gif_url,
        exercise.image_url,
        exercise.instructions_en,
        exercise.instructions_ru
      )
      .first<{ id: number }>();
    if (!result) throw new Error("Failed to upsert exercise");
    return result.id;
  }

  async getDistinctTargets(): Promise<string[]> {
    const rows = await this.db
      .prepare("SELECT DISTINCT target FROM exercise_catalog WHERE target IS NOT NULL ORDER BY target")
      .all<{ target: string }>();
    return rows.results.map((r) => r.target);
  }

  async getDistinctEquipment(): Promise<string[]> {
    const rows = await this.db
      .prepare("SELECT DISTINCT equipment FROM exercise_catalog WHERE equipment IS NOT NULL ORDER BY equipment")
      .all<{ equipment: string }>();
    return rows.results.map((r) => r.equipment);
  }

  async getDistinctBodyParts(): Promise<string[]> {
    const rows = await this.db
      .prepare("SELECT DISTINCT body_part FROM exercise_catalog WHERE body_part IS NOT NULL ORDER BY body_part")
      .all<{ body_part: string }>();
    return rows.results.map((r) => r.body_part);
  }

  /** Упражнения без русского перевода названия */
  async findUntranslated(limit: number): Promise<Array<{ id: number; name_en: string; instructions_en: string | null }>> {
    const rows = await this.db
      .prepare(
        `SELECT id, name_en, instructions_en
         FROM exercise_catalog
         WHERE name_ru IS NULL OR name_ru = ''
         ORDER BY id
         LIMIT ?1`
      )
      .bind(limit)
      .all<{ id: number; name_en: string; instructions_en: string | null }>();
    return rows.results;
  }

  /** Сохранить русские переводы названия и описания */
  async updateTranslation(id: number, name_ru: string | null, instructions_ru: string | null): Promise<void> {
    await this.db
      .prepare(
        `UPDATE exercise_catalog
         SET
           name_ru = COALESCE(?1, name_ru),
           instructions_ru = COALESCE(?2, instructions_ru)
         WHERE id = ?3`
      )
      .bind(name_ru, instructions_ru, id)
      .run();
  }

  /** Количество непереведённых упражнений */
  async countUntranslated(): Promise<number> {
    const row = await this.db
      .prepare("SELECT COUNT(*) as cnt FROM exercise_catalog WHERE name_ru IS NULL OR name_ru = ''")
      .first<{ cnt: number }>();
    return row?.cnt ?? 0;
  }
}
