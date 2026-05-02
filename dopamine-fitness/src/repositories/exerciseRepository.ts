import type { ExerciseCatalog } from "../types/index.js";
import type { ExerciseFilterInput } from "../validators/schemas.js";

export class ExerciseRepository {
  constructor(private db: D1Database) {}

  async findMany(filters: ExerciseFilterInput): Promise<{ exercises: ExerciseCatalog[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (filters.search) {
      conditions.push(`(name_en LIKE ?${i} OR name_ru LIKE ?${i})`);
      values.push(`%${filters.search}%`);
      i++;
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
    const limit = filters.limit;
    const offset = (filters.page - 1) * limit;

    const [rows, countRow] = await Promise.all([
      this.db
        .prepare(`SELECT * FROM exercise_catalog ${where} ORDER BY name_en LIMIT ?${i} OFFSET ?${i + 1}`)
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
         SET name_ru = ?1, instructions_ru = ?2
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
