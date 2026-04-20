import type { Workout, WorkoutExercise, Set } from "../types/index.js";
import type {
  WorkoutInput,
  WorkoutPatchInput,
  WorkoutExerciseInput,
  SetInput,
} from "../validators/schemas.js";
import { WorkoutRepository } from "../repositories/workoutRepository.js";
import { calcOneRM, calcVolume } from "../utils/helpers.js";
import { StatsRepository } from "../repositories/statsRepository.js";

export class WorkoutService {
  private repo: WorkoutRepository;
  private statsRepo: StatsRepository;

  constructor(db: D1Database) {
    this.repo = new WorkoutRepository(db);
    this.statsRepo = new StatsRepository(db);
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

  async getExercises(workoutId: number, userId: number): Promise<WorkoutExercise[]> {
    await this.get(workoutId, userId);
    return this.repo.getExercises(workoutId);
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

    // Auto-update progress snapshot
    if (input.completed && input.weight && input.reps && we.exercise_id) {
      const workout = await this.repo.findById(we.workout_id, userId);
      if (workout) {
        await this.statsRepo.upsertSnapshot({
          user_id: userId,
          exercise_id: we.exercise_id,
          custom_exercise_id: null,
          date: workout.workout_date,
          weight: input.weight,
          reps: input.reps,
          volume: calcVolume(input.weight, input.reps),
          one_rm_estimate: calcOneRM(input.weight, input.reps),
        });
      }
    }

    return set;
  }
}
