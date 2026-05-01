import type { ExerciseDBItem } from "../../types/index.js";

export class ExerciseDBIntegration {
  constructor(
    private baseUrl: string,
    private apiKey: string
  ) {}

  async fetchAll(limit = 1300): Promise<ExerciseDBItem[]> {
    const url = `${this.baseUrl}/exercises?limit=${limit}&offset=0`;
    const response = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": this.apiKey,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status}`);
    }

    return response.json<ExerciseDBItem[]>();
  }

  async fetchById(id: string): Promise<ExerciseDBItem> {
    const response = await fetch(`${this.baseUrl}/exercises/exercise/${id}`, {
      headers: {
        "X-RapidAPI-Key": this.apiKey,
        "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
      },
    });

    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status}`);
    }

    return response.json<ExerciseDBItem>();
  }

  async fetchByName(name: string): Promise<ExerciseDBItem[]> {
    const response = await fetch(
      `${this.baseUrl}/exercises/name/${encodeURIComponent(name.toLowerCase())}?limit=10`,
      {
        headers: {
          "X-RapidAPI-Key": this.apiKey,
          "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
        },
      }
    );
    if (!response.ok) throw new Error(`ExerciseDB API error: ${response.status}`);
    return response.json<ExerciseDBItem[]>();
  }

  async fetchByTarget(target: string): Promise<ExerciseDBItem[]> {
    const response = await fetch(
      `${this.baseUrl}/exercises/target/${encodeURIComponent(target)}?limit=50`,
      {
        headers: {
          "X-RapidAPI-Key": this.apiKey,
          "X-RapidAPI-Host": "exercisedb.p.rapidapi.com",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`ExerciseDB API error: ${response.status}`);
    }

    return response.json<ExerciseDBItem[]>();
  }
}
