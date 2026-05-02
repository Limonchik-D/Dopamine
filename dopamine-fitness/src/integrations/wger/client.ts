import type { WgerExercise } from "../../types/index.js";

interface WgerListResponse {
  count: number;
  next: string | null;
  results: WgerExercise[];
}

export class WgerIntegration {
  constructor(private baseUrl: string) {}

  // Returns the English name of an exercise from its translations
  static getName(ex: WgerExercise): string {
    const en = ex.translations.find((t) => t.language === 2);
    return en?.name ?? ex.translations[0]?.name ?? `exercise_${ex.id}`;
  }

  static getDescription(ex: WgerExercise): string {
    const en = ex.translations.find((t) => t.language === 2);
    return en?.description?.replace(/<[^>]*>/g, "").trim() ?? "";
  }

  async fetchAll(): Promise<WgerExercise[]> {
    const results: WgerExercise[] = [];
    let url: string | null = `${this.baseUrl}/exerciseinfo/?format=json&language=2&limit=100`;

    while (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`wger API error: ${response.status}`);
      const data = await response.json<WgerListResponse>();
      // Only include exercises that have at least one translation with a name
      const valid = data.results.filter((ex) => ex.translations && ex.translations.length > 0);
      results.push(...valid);
      url = data.next;
    }

    return results;
  }

  async fetchById(id: number): Promise<WgerExercise> {
    const response = await fetch(`${this.baseUrl}/exerciseinfo/${id}/?format=json`);
    if (!response.ok) throw new Error(`wger API error: ${response.status}`);
    return response.json<WgerExercise>();
  }
}
