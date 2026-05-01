/**
 * API-Ninjas Exercises client
 * https://api-ninjas.com/api/exercises
 *
 * Provides: difficulty, type, instructions (muscle group + instructions text)
 */

export interface NinjasExercise {
  name: string;
  type: string;           // strength, cardio, stretching, plyometrics, powerlifting, olympic_weightlifting, strongman
  muscle: string;         // target muscle group
  equipment: string;
  difficulty: "beginner" | "intermediate" | "expert";
  instructions: string;
}

export class NinjasClient {
  private readonly baseUrl = "https://api.api-ninjas.com/v1/exercises";

  constructor(private readonly apiKey: string) {}

  /**
   * Search by muscle group (mapped from our target field).
   * Returns up to 10 results per request.
   */
  async fetchByMuscle(muscle: string): Promise<NinjasExercise[]> {
    const resp = await fetch(`${this.baseUrl}?muscle=${encodeURIComponent(muscle)}`, {
      headers: { "X-Api-Key": this.apiKey },
    });
    if (!resp.ok) throw new Error(`API-Ninjas error: ${resp.status}`);
    return resp.json<NinjasExercise[]>();
  }

  /**
   * Search by exact or partial name.
   */
  async fetchByName(name: string): Promise<NinjasExercise[]> {
    const resp = await fetch(`${this.baseUrl}?name=${encodeURIComponent(name)}`, {
      headers: { "X-Api-Key": this.apiKey },
    });
    if (!resp.ok) throw new Error(`API-Ninjas error: ${resp.status}`);
    return resp.json<NinjasExercise[]>();
  }
}
