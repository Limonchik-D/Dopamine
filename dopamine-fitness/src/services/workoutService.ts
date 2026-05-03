import type { Workout, WorkoutExercise, Set } from "../types/index.js";
import type {
  WorkoutInput,
  WorkoutPatchInput,
  WorkoutExerciseInput,
  SetInput,
} from "../validators/schemas.js";
import { WorkoutRepository } from "../repositories/workoutRepository.js";
import { StatsRepository } from "../repositories/statsRepository.js";

export class WorkoutService {
  private repo: WorkoutRepository;
  private statsRepo: StatsRepository;

  constructor() {
    this.repo = new WorkoutRepository();
    this.statsRepo = new StatsRepository();
  }

  async list(
    userId: number,
    page: number,
    limit: number
  ): Promise<{ workouts: Workout[]; total: number; hasNext: boolean }> {
    const offset = (page - 1) * limit;
    const { workouts, total } = await this.repo.findByUser(userId, limit, offset);
    return { workouts, total, hasNext: offset + workouts.length < total };
  }

  async get(id: number, userId: number): Promise<Workout> {
    const workout = await this.repo.findById(id, userId);
    if (!workout) throw new Error("Not found");
    return workout;
  }

  async create(userId: number, input: WorkoutInput): Promise<Workout> {
    return this.repo.create(
      userId,
      input.name,
      input.description ?? null,
      input.workout_date,
      input.notes ?? null
    );
  }

  async duplicateWorkout(
    sourceWorkoutId: number,
    userId: number,
    targetDate: string,
    targetName?: string
  ): Promise<Workout> {
    const source = await this.repo.findById(sourceWorkoutId, userId);
    if (!source) throw new Error("Not found");

    const created = await this.repo.create(
      userId,
      targetName?.trim() || `${source.name} (копия)`,
      source.description,
      targetDate,
      source.notes
    );

    await this.repo.copyWorkoutExercisesAndSets(sourceWorkoutId, created.id, userId);
    return created;
  }

  async update(
    id: number,
    userId: number,
    input: WorkoutPatchInput
  ): Promise<Workout> {
    const workout = await this.repo.update(id, userId, input);
    if (!workout) throw new Error("Not found");
    return workout;
  }

  async delete(id: number, userId: number): Promise<void> {
    const deleted = await this.repo.softDelete(id, userId);
    if (!deleted) throw new Error("Not found");
  }

  async complete(id: number, userId: number, durationMinutes: number | null): Promise<void> {
    const done = await this.repo.complete(id, userId, durationMinutes);
    if (!done) throw new Error("Not found");
  }

  // ─── Exercises ──────────────────────────────────────────────────────────────

  async addExercise(
    workoutId: number,
    userId: number,
    input: WorkoutExerciseInput
  ): Promise<WorkoutExercise> {
    const workout = await this.repo.findById(workoutId, userId);
    if (!workout) throw new Error("Not found");

    return this.repo.addExercise(
      workoutId,
      input.exercise_id ?? null,
      input.custom_exercise_id ?? null,
      input.order_index,
      input.target_muscle ?? null,
      input.equipment ?? null
    );
  }

  async getExercises(workoutId: number, userId: number): Promise<(WorkoutExercise & { sets: Set[] })[]> {
    await this.get(workoutId, userId);
    return this.repo.getExercisesWithSets(workoutId, userId);
  }

  async removeExercise(workoutExerciseId: number, userId: number): Promise<void> {
    const deleted = await this.repo.deleteWorkoutExercise(workoutExerciseId, userId);
    if (!deleted) throw new Error("Not found");
  }

  // ─── Sets ───────────────────────────────────────────────────────────────────

  async addSet(
    workoutExerciseId: number,
    userId: number,
    input: SetInput
  ): Promise<Set> {
    const we = await this.repo.getWorkoutExercise(workoutExerciseId, userId);
    if (!we) throw new Error("Not found");

    const set = await this.repo.addSet(
      workoutExerciseId,
      input.set_number,
      input.weight ?? null,
      input.reps ?? null,
      input.rest_seconds ?? null,
      input.rir ?? null,
      input.completed
    );

    // Keep snapshot in sync after any set mutation.
    if (we.exercise_id) {
      const workout = await this.repo.findById(we.workout_id, userId);
      if (workout) {
        await this.statsRepo.recalculateExerciseSnapshot(userId, we.exercise_id, workout.workout_date);
      }
    }

    return set;
  }

  async updateSet(setId: number, userId: number, input: Partial<SetInput>): Promise<Set> {
    const setContext = await this.repo.getSetContext(setId, userId);
    if (!setContext) throw new Error("Not found");

    const set = await this.repo.updateSet(setId, userId, {
      weight: input.weight,
      reps: input.reps,
      rest_seconds: input.rest_seconds,
      rir: input.rir,
      completed: input.completed,
    });
    if (!set) throw new Error("Not found");

    if (setContext.exercise_id) {
      await this.statsRepo.recalculateExerciseSnapshot(
        userId,
        setContext.exercise_id,
        setContext.workout_date
      );
    }

    return set;
  }

  async deleteSet(setId: number, userId: number): Promise<void> {
    const setContext = await this.repo.getSetContext(setId, userId);
    if (!setContext) throw new Error("Not found");

    const deleted = await this.repo.deleteSet(setId, userId);
    if (!deleted) throw new Error("Not found");

    if (setContext.exercise_id) {
      await this.statsRepo.recalculateExerciseSnapshot(
        userId,
        setContext.exercise_id,
        setContext.workout_date
      );
    }
  }
}
