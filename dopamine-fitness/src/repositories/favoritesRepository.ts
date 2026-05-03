import { prisma } from "../db/prisma.js";
import { conflict, badRequest } from "../utils/appError.js";
import { ErrorCodes } from "../utils/errorCodes.js";

export interface FavoriteItem {
  id: number;
  user_id: number;
  exercise_id: number | null;
  custom_exercise_id: number | null;
  created_at: string;
  name_en?: string | null;
  name_ru?: string | null;
  target?: string | null;
  gif_url?: string | null;
}

export class FavoritesRepository {
  async list(userId: number): Promise<FavoriteItem[]> {
    const rows = await prisma.favorite.findMany({
      where: { user_id: userId },
      include: {
        exercise: {
          select: { name_en: true, name_ru: true, target: true, gif_url: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    return rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      exercise_id: r.exercise_id,
      custom_exercise_id: r.custom_exercise_id,
      created_at: r.created_at.toISOString(),
      name_en: r.exercise?.name_en ?? null,
      name_ru: r.exercise?.name_ru ?? null,
      target: r.exercise?.target ?? null,
      gif_url: r.exercise?.gif_url ?? null,
    }));
  }

  async add(
    userId: number,
    exerciseId: number | null,
    customExerciseId: number | null
  ): Promise<FavoriteItem> {
    // Validate reference exists
    if (exerciseId != null) {
      const exists = await prisma.exerciseCatalog.findUnique({ where: { id: exerciseId }, select: { id: true } });
      if (!exists) throw badRequest("Упражнение не найдено или недоступно", ErrorCodes.FavoriteInvalidReference);
    }
    if (customExerciseId != null) {
      const exists = await prisma.customExercise.findFirst({
        where: { id: customExerciseId, user_id: userId, deleted_at: null },
        select: { id: true },
      });
      if (!exists) throw badRequest("Упражнение не найдено или недоступно", ErrorCodes.FavoriteInvalidReference);
    }

    try {
      const row = await prisma.favorite.create({
        data: { user_id: userId, exercise_id: exerciseId, custom_exercise_id: customExerciseId },
        include: {
          exercise: { select: { name_en: true, name_ru: true, target: true, gif_url: true } },
        },
      });
      return {
        id: row.id,
        user_id: row.user_id,
        exercise_id: row.exercise_id,
        custom_exercise_id: row.custom_exercise_id,
        created_at: row.created_at.toISOString(),
        name_en: row.exercise?.name_en ?? null,
        name_ru: row.exercise?.name_ru ?? null,
        target: row.exercise?.target ?? null,
        gif_url: row.exercise?.gif_url ?? null,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Unique constraint") || msg.includes("unique constraint")) {
        throw conflict("Упражнение уже в избранном", ErrorCodes.FavoriteDuplicate);
      }
      throw error;
    }
  }

  async remove(
    userId: number,
    exerciseId: number | null,
    customExerciseId: number | null
  ): Promise<boolean> {
    const row = exerciseId != null
      ? await prisma.favorite.findFirst({ where: { user_id: userId, exercise_id: exerciseId } })
      : await prisma.favorite.findFirst({ where: { user_id: userId, custom_exercise_id: customExerciseId } });

    if (!row) return false;
    await prisma.favorite.delete({ where: { id: row.id } });
    return true;
  }

  async isFavorite(
    userId: number,
    exerciseId: number | null,
    customExerciseId: number | null
  ): Promise<boolean> {
    const row = exerciseId != null
      ? await prisma.favorite.findFirst({ where: { user_id: userId, exercise_id: exerciseId } })
      : await prisma.favorite.findFirst({ where: { user_id: userId, custom_exercise_id: customExerciseId } });
    return row != null;
  }
}
