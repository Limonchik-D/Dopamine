import type { WgerExercise } from "../../types/index.js";

interface WgerListResponse {
  count: number;
  next: string | null;
  results: WgerExercise[];
}

export class WgerIntegration {
  constructor(private baseUrl: string) {}

  async fetchAll(): Promise<WgerExercise[]> {
    const results: WgerExercise[] = [];
    let url: string | null = `${this.baseUrl}/exercise/?format=json&language=2&limit=100`;

    while (url) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`wger API error: ${response.status}`);

      const data = await response.json<WgerListResponse>();
      results.push(...data.results);
      url = data.next;
    }

    return results;
  }

  async fetchById(id: number): Promise<WgerExercise> {
    const response = await fetch(`${this.baseUrl}/exercise/${id}/?format=json`);
    if (!response.ok) throw new Error(`wger API error: ${response.status}`);
    return response.json<WgerExercise>();
  }
}
