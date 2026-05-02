import type { WgerExercise } from "../../types/index.js";

interface WgerListResponse {
  count: number;
  next: string | null;
  results: WgerExercise[];
}

interface WgerImageItem {
  id: number;
  image: string;
  is_main: boolean;
}

interface WgerImageListResponse {
  count: number;
  next: string | null;
  results: WgerImageItem[];
}

export class WgerIntegration {
  constructor(private baseUrl: string) {}

  // Returns the English name of an exercise from its translations
  static getName(ex: WgerExercise): string {
    const en = ex.translations.find((t) => t.language === 2);
    return en?.name ?? ex.translations[0]?.name ?? `exercise_${ex.id}`;
  }

  static getDescription(ex: WgerExercise): string {
    const preferred = ex.translations.find((t) => t.language === 2 && t.description?.trim());
    const fallback = ex.translations.find((t) => t.description?.trim());
    return (preferred?.description ?? fallback?.description ?? "").replace(/<[^>]*>/g, "").trim();
  }

  async fetchByName(name: string, limit = 30): Promise<WgerExercise[]> {
    const trimmed = name.trim();
    if (!trimmed) return [];

    const exactUrl = `${this.baseUrl}/exerciseinfo/?format=json&language__code=en&limit=${Math.min(limit, 10)}&name__exact=${encodeURIComponent(trimmed)}`;
    const searchUrl = `${this.baseUrl}/exerciseinfo/?format=json&language__code=en&limit=${limit}&name__search=${encodeURIComponent(trimmed)}`;

    const exactResponse = await fetch(exactUrl);
    if (!exactResponse.ok) throw new Error(`wger API error: ${exactResponse.status}`);
    const exactData = await exactResponse.json<WgerListResponse>();

    const searchResponse = await fetch(searchUrl);
    if (!searchResponse.ok) throw new Error(`wger API error: ${searchResponse.status}`);
    const searchData = await searchResponse.json<WgerListResponse>();

    const combined = [...exactData.results, ...searchData.results].filter(
      (ex) => ex.translations && ex.translations.length > 0
    );

    const seen = new Set<number>();
    return combined.filter((ex) => {
      if (seen.has(ex.id)) return false;
      seen.add(ex.id);
      return true;
    });
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

  async fetchExerciseImages(exerciseId: number, limit = 10): Promise<WgerImageItem[]> {
    const response = await fetch(
      `${this.baseUrl}/exerciseimage/?format=json&limit=${limit}&exercise=${exerciseId}`
    );
    if (!response.ok) throw new Error(`wger API error: ${response.status}`);
    const data = await response.json<WgerImageListResponse>();
    return data.results;
  }
}
