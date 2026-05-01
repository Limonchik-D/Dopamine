import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email("Некорректный email"),
  username: z
    .string()
    .min(3, "Минимум 3 символа")
    .max(32, "Максимум 32 символа")
    .regex(/^[a-zA-Z0-9_-]+$/, "Только латиница, цифры, _ и -"),
  password: z
    .string()
    .min(8, "Минимум 8 символов")
    .max(128, "Слишком длинный пароль"),
});

export const loginSchema = z.object({
  email: z.string().email("Некорректный email"),
  password: z.string().min(1, "Введите пароль"),
});

export const workoutSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  description: z.string().max(500).optional(),
  workout_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Формат: YYYY-MM-DD"),
  notes: z.string().max(1000).optional(),
});

export const workoutPatchSchema = workoutSchema.partial();

export const workoutExerciseSchema = z.object({
  exercise_id: z.number().int().positive().optional(),
  custom_exercise_id: z.number().int().positive().optional(),
  order_index: z.number().int().min(0).default(0),
  target_muscle: z.string().max(64).optional(),
  equipment: z.string().max(64).optional(),
}).refine(
  (d) => d.exercise_id != null || d.custom_exercise_id != null,
  "Нужно указать exercise_id или custom_exercise_id"
);

export const setSchema = z.object({
  set_number: z.number().int().min(1),
  weight: z.number().min(0).max(9999).optional(),
  reps: z.number().int().min(0).max(9999).optional(),
  rest_seconds: z.number().int().min(0).max(3600).optional(),
  rir: z.number().int().min(0).max(10).optional(),
  completed: z.boolean().default(false),
});

export const customExerciseSchema = z.object({
  name: z.string().min(1, "Название обязательно").max(100),
  description: z.string().max(500).optional(),
  target: z.string().max(64).optional(),
  equipment: z.string().max(64).optional(),
});

export const settingsSchema = z.object({
  theme: z.enum(["calm", "sport", "minimal", "dark"]).optional(),
  locale: z.enum(["ru", "en"]).optional(),
  units: z.enum(["metric", "imperial"]).optional(),
  notifications_enabled: z.boolean().optional(),
});

export const checkinSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Формат: YYYY-MM-DD").optional(),
});

export const exerciseFilterSchema = z.object({
  search: z.string().max(100).optional(),
  target: z.string().max(64).optional(),
  equipment: z.string().max(64).optional(),
  body_part: z.string().max(64).optional(),
  source: z.enum(["exercisedb", "wger", "seed", "custom"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type WorkoutInput = z.infer<typeof workoutSchema>;
export type WorkoutPatchInput = z.infer<typeof workoutPatchSchema>;
export type WorkoutExerciseInput = z.output<typeof workoutExerciseSchema>;
export type SetInput = z.output<typeof setSchema>;
export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type CheckinInput = z.infer<typeof checkinSchema>;
export type ExerciseFilterInput = z.output<typeof exerciseFilterSchema>;
