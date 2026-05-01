// ─── Cloudflare Bindings ─────────────────────────────────────────────────────

export interface Env {
  // Static assets binding
  ASSETS?: Fetcher;

  // D1 — structured relational data
  DB: D1Database;

  // KV — cache, sessions, settings, feature flags
  KV: KVNamespace;

  // R2 — media storage (photos, GIFs)
  R2_BUCKET: R2Bucket;

  // Environment variables
  ENVIRONMENT: "development" | "staging" | "production";
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  EXERCISE_CACHE_TTL: string;
  MAX_UPLOAD_SIZE_MB: string;
  EXERCISEDB_BASE_URL: string;
  EXERCISEDB_API_KEY: string;
  WGER_BASE_URL: string;
  NINJAS_API_KEY?: string;   // API-Ninjas exercises — optional enrichment source
  APP_NAME: string;
  APP_ALLOWED_ORIGINS: string;
  ADMIN_EMAILS?: string;
  STATS_CACHE_TTL?: string;
  CHECKINS_CACHE_TTL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_REDIRECT_URI?: string;
  GOOGLE_CLIENT_SECRET?: string;
}

// ─── Hono Context Variables ───────────────────────────────────────────────────

export interface HonoVariables {
  userId: number;
  userEmail: string;
  userRole: UserRole;
  requestId: string;
}

// ─── Application Context ─────────────────────────────────────────────────────

export interface AppContext {
  env: Env;
  userId?: number;
  requestId: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface JwtPayload {
  sub: number;       // user id
  email: string;
  role?: UserRole;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: number;
  email: string;
  username: string;
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}

// ─── API Response ─────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
  message?: string;
}

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  email: string;
  username: string;
  role: UserRole;
  google_sub?: string | null;
  created_at: string;
  updated_at: string;
}

export type UserRole = "user" | "admin";

export interface UserProfile {
  user_id: number;
  avatar_url: string | null;
  bio: string | null;
  locale: "ru" | "en";
  theme: "calm" | "sport" | "minimal" | "dark";
  units: "metric" | "imperial";
}

export interface UserSettings {
  user_id: number;
  theme: "calm" | "sport" | "minimal" | "dark";
  locale: "ru" | "en";
  units: "metric" | "imperial";
  notifications_enabled: boolean;
}

// ─── Workout ──────────────────────────────────────────────────────────────────

export interface Workout {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  workout_date: string;
  notes: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface WorkoutExercise {
  id: number;
  workout_id: number;
  exercise_id: number | null;
  custom_exercise_id: number | null;
  order_index: number;
  target_muscle: string | null;
  equipment: string | null;
  created_at: string;
}

export interface Set {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rest_seconds: number | null;
  rir: number | null;
  completed: boolean;
}

// ─── Exercise ─────────────────────────────────────────────────────────────────

export type ExerciseSource = "exercisedb" | "wger" | "seed" | "custom";

export interface ExerciseCatalog {
  id: number;
  source: ExerciseSource;
  source_exercise_id: string;
  name_en: string;
  name_ru: string | null;
  target: string | null;
  equipment: string | null;
  body_part: string | null;
  gif_url: string | null;
  image_url: string | null;
  instructions_en: string | null;
  instructions_ru: string | null;
}

export interface CustomExercise {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  target: string | null;
  equipment: string | null;
  photo_r2_key: string | null;
  created_at: string;
  deleted_at: string | null;
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export type StatsPeriod = "week" | "month" | "3months" | "year";

export interface ProgressSnapshot {
  id: number;
  user_id: number;
  exercise_id: number | null;
  custom_exercise_id: number | null;
  date: string;
  weight: number | null;
  reps: number | null;
  volume: number | null;
  one_rm_estimate: number | null;
}

export interface DailyCheckin {
  id: number;
  user_id: number;
  checkin_date: string;
  created_at: string;
}

export interface StatsPoint {
  date: string;
  volume: number;
  max_weight: number;
  total_reps: number;
  workout_count: number;
}

// ─── External API ─────────────────────────────────────────────────────────────

export interface ExerciseDBItem {
  id: string;
  name: string;
  target: string;
  equipment: string;
  bodyPart: string;
  gifUrl: string;
  instructions: string[];
  secondaryMuscles: string[];
}

export interface WgerExercise {
  id: number;
  uuid: string;
  name: string;
  description: string;
  muscles: { name_en: string }[];
  equipment: { name: string }[];
  category: { name: string };
}
