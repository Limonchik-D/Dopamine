import { prisma } from "../db/prisma.js";
import type { Workout, WorkoutExercise, Set } from "../types/index.js";
import { conflict } from "../utils/appError.js";
import { ErrorCodes } from "../utils/errorCodes.js";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function d(date: Date | null | undefined): string | null {
  return date ? date.toISOString() : null;
}

function mapWorkout(row: {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  workout_date: string;
  notes: string | null;
  created_at: Date;
  deleted_at: Date | null;
  completed_at: Date | null;
  duration_minutes: number | null;
}): Workout {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    workout_date: row.workout_date,
    notes: row.notes,
    created_at: d(row.created_at)!,
    deleted_at: d(row.deleted_at),
    completed_at: d(row.completed_at),
    duration_minutes: row.duration_minutes,
  };
}

function mapSet(row: {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rest_seconds: number | null;
  rir: number | null;
  completed: boolean;
}): Set {
  return {
    id: row.id,
    workout_exercise_id: row.workout_exercise_id,
    set_number: row.set_number,
    weight: row.weight,
    reps: row.reps,
    rest_seconds: row.rest_seconds,
    rir: row.rir,
    completed: row.completed,
  };
}

const WORKOUT_SELECT = {
  id: true,
  user_id: true,
  name: true,
  description: true,
  workout_date: true,
  notes: true,
  created_at: true,
  deleted_at: true,
  completed_at: true,
  duration_minutes: true,
} as const;

export class WorkoutRepository {
  async findByUser(
    userId: number,
    limit: number,
    offset: number
  ): Promise<{ workouts: Workout[]; total: number }> {
    const where = { user_id: userId, deleted_at: null };
    const [rows, total] = await Promise.all([
      prisma.workout.findMany({
        where,
        select: WORKOUT_SELECT,
        orderBy: [{ workout_date: "desc" }, { created_at: "desc" }],
        take: limit,
        skip: offset,
      }),
      prisma.workout.count({ where }),
    ]);
    return { workouts: rows.map(mapWorkout), total };
  }

  async findById(id: number, userId: number): Promise<Workout | null> {
    const row = await prisma.workout.findFirst({
      where: { id, user_id: userId, deleted_at: null },
      select: WORKOUT_SELECT,
    });
    return row ? mapWorkout(row) : null;
  }

  async create(
    userId: number,
    name: string,
    description: string | null,
    workoutDate: string,
    notes: string | null
  ): Promise<Workout> {
    const row = await prisma.workout.create({
      data: { user_id: userId, name, description, workout_date: workoutDate, notes },
      select: WORKOUT_SELECT,
    });
    return mapWorkout(row);
  }

  async update(
    id: number,
    userId: number,
    fields: Partial<Pick<Workout, "name" | "description" | "workout_date" | "notes">>
  ): Promise<Workout | null> {
    if (Object.keys(fields).length === 0) return this.findById(id, userId);
    try {
      const row = await prisma.workout.updateMany({
        where: { id, user_id: userId, deleted_at: null },
        data: {
          ...(fields.name !== undefined && { name: fields.name }),
          ...(fields.description !== undefined && { description: fields.description }),
          ...(fields.workout_date !== undefined && { workout_date: fields.workout_date }),
          ...(fields.notes !== undefined && { notes: fields.notes }),
        },
      });
      if (row.count === 0) return null;
      return this.findById(id, userId);
    } catch {
      return null;
    }
  }

  async softDelete(id: number, userId: number): Promise<boolean> {
    const result = await prisma.workout.updateMany({
      where: { id, user_id: userId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    return result.count > 0;
  }

  async complete(id: number, userId: number, durationMinutes: number | null): Promise<boolean> {
    const result = await prisma.workout.updateMany({
      where: { id, user_id: userId, deleted_at: null },
      data: { completed_at: new Date(), duration_minutes: durationMinutes },
    });
    return result.count > 0;
  }

  // ─── Workout Exercises ──────────────────────────────────────────────────────

  async addExercise(
    workoutId: number,
    exerciseId: number | null,
    customExerciseId: number | null,
    orderIndex: number,
    targetMuscle: string | null,
    equipment: string | null
  ): Promise<WorkoutExercise> {
    const row = await prisma.workoutExercise.create({
      data: {
        workout_id: workoutId,
        exercise_id: exerciseId,
        custom_exercise_id: customExerciseId,
        order_index: orderIndex,
        target_muscle: targetMuscle,
        equipment,
      },
    });
    return {
      id: row.id,
      workout_id: row.workout_id,
      exercise_id: row.exercise_id,
      custom_exercise_id: row.custom_exercise_id,
      order_index: row.order_index,
      target_muscle: row.target_muscle,
      equipment: row.equipment,
      created_at: d(row.created_at)!,
    };
  }

  async copyWorkoutExercisesAndSets(
    sourceWorkoutId: number,
    targetWorkoutId: number,
    userId: number
  ): Promise<void> {
    const sourceExercises = await prisma.workoutExercise.findMany({
      where: {
        workout_id: sourceWorkoutId,
        workout: { user_id: userId, deleted_at: null },
      },
      include: { sets: { orderBy: { set_number: "asc" } } },
      orderBy: { order_index: "asc" },
    });

    for (const we of sourceExercises) {
      const inserted = await this.addExercise(
        targetWorkoutId,
        we.exercise_id,
        we.custom_exercise_id,
        we.order_index,
        we.target_muscle,
        we.equipment
      );
      for (const s of we.sets) {
        await this.addSet(
          inserted.id,
          s.set_number,
          s.weight,
          s.reps,
          s.rest_seconds,
          s.rir,
          false
        );
      }
    }
  }

  async getExercises(workoutId: number, userId: number): Promise<WorkoutExercise[]> {
    const rows = await prisma.$queryRaw<WorkoutExercise[]>`
      SELECT
        we.id, we.workout_id, we.exercise_id, we.custom_exercise_id,
        we.order_index, we.target_muscle, we.equipment,
        we.created_at,
        COALESCE(ec.name_ru, ec.name_en)      AS exercise_name,
        ec.gif_url                             AS exercise_gif_url,
        ec.image_url                           AS exercise_image_url,
        ec.instructions_en                     AS exercise_instructions_en,
        ec.instructions_ru                     AS exercise_instructions_ru,
        ec.target                              AS exercise_target,
        ec.equipment                           AS exercise_equipment,
        cx.name                                AS custom_name,
        cx.photo_r2_key                        AS custom_photo_key,
        cx.description                         AS custom_description,
        cx.target                              AS custom_target,
        cx.equipment                           AS custom_equipment,
        (
          SELECT s2.weight
          FROM sets s2
          JOIN workout_exercises we2 ON we2.id = s2.workout_exercise_id
          JOIN workouts w2 ON w2.id = we2.workout_id
          WHERE w2.user_id = ${userId}
            AND w2.deleted_at IS NULL
            AND w2.id != we.workout_id
            AND s2.completed = TRUE
            AND (
              (we.exercise_id IS NOT NULL AND we2.exercise_id = we.exercise_id)
              OR (we.custom_exercise_id IS NOT NULL AND we2.custom_exercise_id = we.custom_exercise_id)
            )
          ORDER BY w2.workout_date DESC, w2.created_at DESC, s2.id DESC
          LIMIT 1
        ) AS last_weight,
        (
          SELECT s2.reps
          FROM sets s2
          JOIN workout_exercises we2 ON we2.id = s2.workout_exercise_id
          JOIN workouts w2 ON w2.id = we2.workout_id
          WHERE w2.user_id = ${userId}
            AND w2.deleted_at IS NULL
            AND w2.id != we.workout_id
            AND s2.completed = TRUE
            AND (
              (we.exercise_id IS NOT NULL AND we2.exercise_id = we.exercise_id)
              OR (we.custom_exercise_id IS NOT NULL AND we2.custom_exercise_id = we.custom_exercise_id)
            )
          ORDER BY w2.workout_date DESC, w2.created_at DESC, s2.id DESC
          LIMIT 1
        ) AS last_reps
      FROM workout_exercises we
      LEFT JOIN exercise_catalog ec ON ec.id = we.exercise_id
      LEFT JOIN custom_exercises cx ON cx.id = we.custom_exercise_id
      WHERE we.workout_id = ${workoutId}
      ORDER BY we.order_index ASC
    `;
    return rows.map((r) => ({
      ...r,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      created_at: (r.created_at as any) instanceof Date ? ((r.created_at as unknown) as Date).toISOString() : (r.created_at as string),
    }));
  }

  async getWorkoutExercise(id: number, userId: number): Promise<WorkoutExercise | null> {
    const row = await prisma.workoutExercise.findFirst({
      where: {
        id,
        workout: { user_id: userId, deleted_at: null },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      workout_id: row.workout_id,
      exercise_id: row.exercise_id,
      custom_exercise_id: row.custom_exercise_id,
      order_index: row.order_index,
      target_muscle: row.target_muscle,
      equipment: row.equipment,
      created_at: d(row.created_at)!,
    };
  }

  async getSetContext(
    setId: number,
    userId: number
  ): Promise<{ set_id: number; workout_exercise_id: number; exercise_id: number | null; workout_date: string } | null> {
    const row = await prisma.set.findFirst({
      where: {
        id: setId,
        workout_exercise: {
          workout: { user_id: userId, deleted_at: null },
        },
      },
      include: {
        workout_exercise: {
          include: { workout: true },
        },
      },
    });
    if (!row) return null;
    return {
      set_id: row.id,
      workout_exercise_id: row.workout_exercise_id,
      exercise_id: row.workout_exercise.exercise_id,
      workout_date: row.workout_exercise.workout.workout_date,
    };
  }

  // ─── Sets ───────────────────────────────────────────────────────────────────

  async addSet(
    workoutExerciseId: number,
    setNumber: number,
    weight: number | null,
    reps: number | null,
    restSeconds: number | null,
    rir: number | null,
    completed: boolean
  ): Promise<Set> {
    try {
      const row = await prisma.set.create({
        data: {
          workout_exercise_id: workoutExerciseId,
          set_number: setNumber,
          weight,
          reps,
          rest_seconds: restSeconds,
          rir,
          completed,
        },
      });
      return mapSet(row);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
        throw conflict(
          "Такой номер подхода уже существует для этого упражнения в тренировке",
          ErrorCodes.SetDuplicate
        );
      }
      throw error;
    }
  }

  async getSets(workoutExerciseId: number): Promise<Set[]> {
    const rows = await prisma.set.findMany({
      where: { workout_exercise_id: workoutExerciseId },
      orderBy: { set_number: "asc" },
    });
    return rows.map(mapSet);
  }

  async updateSet(
    id: number,
    userId: number,
    fields: Partial<Pick<Set, "weight" | "reps" | "rest_seconds" | "rir" | "completed">>
  ): Promise<Set | null> {
    // Verify ownership first
    const owned = await prisma.set.findFirst({
      where: {
        id,
        workout_exercise: {
          workout: { user_id: userId, deleted_at: null },
        },
      },
    });
    if (!owned) return null;

    if (Object.keys(fields).length === 0) return mapSet(owned);

    const data: {
      weight?: number | null;
      reps?: number | null;
      rest_seconds?: number | null;
      rir?: number | null;
      completed?: boolean;
    } = {};
    if (fields.weight !== undefined) data.weight = fields.weight;
    if (fields.reps !== undefined) data.reps = fields.reps;
    if (fields.rest_seconds !== undefined) data.rest_seconds = fields.rest_seconds;
    if (fields.rir !== undefined) data.rir = fields.rir;
    if (fields.completed !== undefined) data.completed = fields.completed;

    const updated = await prisma.set.update({ where: { id }, data });
    return mapSet(updated);
  }

  async deleteSet(id: number, userId: number): Promise<boolean> {
    const row = await prisma.set.findFirst({
      where: {
        id,
        workout_exercise: {
          workout: { user_id: userId, deleted_at: null },
        },
      },
    });
    if (!row) return false;
    await prisma.set.delete({ where: { id } });
    return true;
  }

  async deleteWorkoutExercise(id: number, userId: number): Promise<boolean> {
    const row = await prisma.workoutExercise.findFirst({
      where: {
        id,
        workout: { user_id: userId, deleted_at: null },
      },
    });
    if (!row) return false;
    await prisma.workoutExercise.delete({ where: { id } });
    return true;
  }

  async getExercisesWithSets(workoutId: number, userId: number): Promise<(WorkoutExercise & { sets: Set[] })[]> {
    const exercises = await this.getExercises(workoutId, userId);
    if (exercises.length === 0) return [];

    const ids = exercises.map((e) => e.id);
    const sets = await prisma.set.findMany({
      where: { workout_exercise_id: { in: ids } },
      orderBy: [{ workout_exercise_id: "asc" }, { set_number: "asc" }],
    });

    const setsMap = new Map<number, Set[]>();
    for (const s of sets) {
      const arr = setsMap.get(s.workout_exercise_id) ?? [];
      arr.push(mapSet(s));
      setsMap.set(s.workout_exercise_id, arr);
    }

    return exercises.map((e) => ({ ...e, sets: setsMap.get(e.id) ?? [] }));
  }
}
