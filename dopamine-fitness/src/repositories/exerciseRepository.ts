import { prisma } from "../db/prisma.js";
import type { ExerciseCatalog } from "../types/index.js";
import type { ExerciseFilterInput } from "../validators/schemas.js";

// ─── Search alias expansion (unchanged) ─────────────────────────────────────

type SearchAlias = { needle: string; expansions: string[] };

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
  лежа: ["bench"], стоя: ["standing"],
  тяга: ["row", "pull", "deadlift"],
  присед: ["squat", "front squat", "back squat"],
  выпады: ["lunge", "walking lunge"],
  бицепс: ["biceps", "curl"], трицепс: ["triceps", "extension", "pushdown"],
  трицепса: ["triceps", "extension", "pushdown"],
  плечи: ["shoulder", "deltoid"], плечо: ["shoulder", "deltoid"],
  дельты: ["deltoid", "shoulder", "lateral raise"],
  грудь: ["chest", "pec"], грудные: ["chest", "pec"],
  спина: ["back", "lat"], широчайшие: ["lats", "lat"],
  пресс: ["abs", "core", "abdominal", "crunch", "plank"],
  ноги: ["legs", "quads", "hamstrings", "calves"],
  ягодицы: ["glute", "glutes", "hip thrust"],
  ягодиц: ["glute", "glutes", "hip thrust"],
  икры: ["calf", "calves"],
  подтягивания: ["pull up", "chin up"],
  отжимания: ["push up", "dips"],
  брусья: ["dip", "dips"], планка: ["plank"],
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
        const cap = withCapitalizedFirst(expansion);
        if (cap !== expansion) terms.add(cap);
      }
    }
  }
  for (const token of normalized.split(" ")) {
    const expansions = TOKEN_ALIASES[token];
    if (!expansions) continue;
    for (const expansion of expansions) {
      terms.add(expansion);
      const cap = withCapitalizedFirst(expansion);
      if (cap !== expansion) terms.add(cap);
    }
  }
  return Array.from(terms).filter((t) => t.length >= 2).slice(0, 24);
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ExerciseRepository {
  async findMany(filters: ExerciseFilterInput): Promise<{ exercises: ExerciseCatalog[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    let primarySearchParam: string | null = null;

    if (filters.search) {
      const searchTerms = expandSearchTerms(filters.search);
      const searchClauses: string[] = [];

      for (const term of searchTerms) {
        values.push(`%${term}%`);
        const p = `$${i++}`;
        if (primarySearchParam === null) primarySearchParam = p;
        searchClauses.push(
          `(lower(name_en) LIKE ${p}
            OR lower(replace(coalesce(name_ru, ''), 'ё', 'е')) LIKE ${p}
            OR lower(replace(coalesce(target, ''), 'ё', 'е')) LIKE ${p}
            OR lower(replace(coalesce(equipment, ''), 'ё', 'е')) LIKE ${p}
            OR lower(replace(coalesce(body_part, ''), 'ё', 'е')) LIKE ${p})`
        );
      }
      if (searchClauses.length > 0) conditions.push(`(${searchClauses.join(" OR ")})`);
    }
    if (filters.target) { conditions.push(`target = $${i++}`); values.push(filters.target); }
    if (filters.equipment) { conditions.push(`equipment = $${i++}`); values.push(filters.equipment); }
    if (filters.body_part) { conditions.push(`body_part = $${i++}`); values.push(filters.body_part); }
    if (filters.source) { conditions.push(`source = $${i++}`); values.push(filters.source); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const orderBy = primarySearchParam
      ? `CASE
           WHEN lower(replace(coalesce(name_ru, ''), 'ё', 'е')) LIKE ${primarySearchParam} THEN 0
           WHEN lower(name_en) LIKE ${primarySearchParam} THEN 1
           WHEN lower(replace(coalesce(target, ''), 'ё', 'е')) LIKE ${primarySearchParam} THEN 2
           WHEN lower(replace(coalesce(equipment, ''), 'ё', 'е')) LIKE ${primarySearchParam} THEN 3
           ELSE 9
         END, name_en`
      : "name_en";

    const limit = filters.limit;
    const offset = (filters.page - 1) * limit;
    values.push(limit); const limitParam = `$${i++}`;
    values.push(offset); const offsetParam = `$${i++}`;

    const dataSQL = `SELECT * FROM exercise_catalog ${where} ORDER BY ${orderBy} LIMIT ${limitParam} OFFSET ${offsetParam}`;
    const countSQL = `SELECT COUNT(*) AS cnt FROM exercise_catalog ${where}`;

    const [rows, countRow] = await Promise.all([
      prisma.$queryRawUnsafe<ExerciseCatalog[]>(dataSQL, ...values),
      prisma.$queryRawUnsafe<[{ cnt: bigint }]>(countSQL, ...values.slice(0, -2)),
    ]);

    return { exercises: rows, total: Number(countRow[0]?.cnt ?? 0) };
  }

  async findById(id: number): Promise<ExerciseCatalog | null> {
    const row = await prisma.exerciseCatalog.findUnique({ where: { id } });
    return row as unknown as ExerciseCatalog ?? null;
  }

  async upsertFromExternal(exercise: Omit<ExerciseCatalog, "id">): Promise<number> {
    const result = await prisma.$queryRaw<[{ id: number }]>`
      INSERT INTO exercise_catalog
        (source, source_exercise_id, name_en, name_ru, target, equipment,
         body_part, gif_url, image_url, instructions_en, instructions_ru)
      VALUES (
        ${exercise.source}, ${exercise.source_exercise_id},
        ${exercise.name_en}, ${exercise.name_ru},
        ${exercise.target}, ${exercise.equipment}, ${exercise.body_part},
        ${exercise.gif_url}, ${exercise.image_url},
        ${exercise.instructions_en}, ${exercise.instructions_ru}
      )
      ON CONFLICT(source, source_exercise_id) DO UPDATE SET
        name_en = EXCLUDED.name_en,
        target = EXCLUDED.target,
        equipment = EXCLUDED.equipment,
        body_part = EXCLUDED.body_part,
        gif_url = EXCLUDED.gif_url,
        image_url = EXCLUDED.image_url,
        instructions_en = EXCLUDED.instructions_en
      RETURNING id
    `;
    if (!result[0]) throw new Error("Failed to upsert exercise");
    return result[0].id;
  }

  async getDistinctTargets(): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ target: string }[]>`
      SELECT DISTINCT target FROM exercise_catalog WHERE target IS NOT NULL ORDER BY target
    `;
    return rows.map((r) => r.target);
  }

  async getDistinctEquipment(): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ equipment: string }[]>`
      SELECT DISTINCT equipment FROM exercise_catalog WHERE equipment IS NOT NULL ORDER BY equipment
    `;
    return rows.map((r) => r.equipment);
  }

  async getDistinctBodyParts(): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ body_part: string }[]>`
      SELECT DISTINCT body_part FROM exercise_catalog WHERE body_part IS NOT NULL ORDER BY body_part
    `;
    return rows.map((r) => r.body_part);
  }

  async findUntranslated(
    limit: number
  ): Promise<Array<{ id: number; name_en: string; instructions_en: string | null }>> {
    const rows = await prisma.exerciseCatalog.findMany({
      where: { OR: [{ name_ru: null }, { name_ru: "" }] },
      select: { id: true, name_en: true, instructions_en: true },
      orderBy: { id: "asc" },
      take: limit,
    });
    return rows;
  }

  async updateTranslation(
    id: number,
    name_ru: string | null,
    instructions_ru: string | null
  ): Promise<void> {
    const data: { name_ru?: string; instructions_ru?: string } = {};
    if (name_ru != null) data.name_ru = name_ru;
    if (instructions_ru != null) data.instructions_ru = instructions_ru;
    if (Object.keys(data).length > 0) {
      await prisma.exerciseCatalog.update({ where: { id }, data });
    }
  }

  async countUntranslated(): Promise<number> {
    const count = await prisma.exerciseCatalog.count({
      where: { OR: [{ name_ru: null }, { name_ru: "" }] },
    });
    return count;
  }
}
