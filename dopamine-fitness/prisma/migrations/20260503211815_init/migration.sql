-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "ExerciseSource" AS ENUM ('exercisedb', 'wger', 'seed', 'custom');

-- CreateEnum
CREATE TYPE "ExternalSource" AS ENUM ('exercisedb', 'wger', 'ninjas');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'gif', 'video');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "google_sub" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "user_id" INTEGER NOT NULL,
    "avatar_url" TEXT,
    "bio" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "theme" TEXT NOT NULL DEFAULT 'calm',
    "units" TEXT NOT NULL DEFAULT 'metric',
    "height_cm" DOUBLE PRECISION,
    "weight_kg" DOUBLE PRECISION,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" INTEGER NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'calm',
    "locale" TEXT NOT NULL DEFAULT 'ru',
    "units" TEXT NOT NULL DEFAULT 'metric',
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "exercise_catalog" (
    "id" SERIAL NOT NULL,
    "source" "ExerciseSource" NOT NULL,
    "source_exercise_id" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_ru" TEXT,
    "target" TEXT,
    "equipment" TEXT,
    "body_part" TEXT,
    "gif_url" TEXT,
    "image_url" TEXT,
    "instructions_en" TEXT,
    "instructions_ru" TEXT,
    "difficulty" TEXT,
    "secondary_muscles" TEXT,
    "name_normalized" TEXT,

    CONSTRAINT "exercise_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_exercises" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "target" TEXT,
    "equipment" TEXT,
    "photo_r2_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "custom_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_media" (
    "id" SERIAL NOT NULL,
    "exercise_id" INTEGER,
    "custom_exercise_id" INTEGER,
    "r2_key" TEXT NOT NULL,
    "media_type" "MediaType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercise_name_map" (
    "id" SERIAL NOT NULL,
    "exercise_id" INTEGER NOT NULL,
    "external_source" "ExternalSource" NOT NULL,
    "external_id" TEXT NOT NULL,
    "external_name" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercise_name_map_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workout_date" TEXT NOT NULL,
    "notes" TEXT,
    "completed_at" TIMESTAMP(3),
    "duration_minutes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workout_exercises" (
    "id" SERIAL NOT NULL,
    "workout_id" INTEGER NOT NULL,
    "exercise_id" INTEGER,
    "custom_exercise_id" INTEGER,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "target_muscle" TEXT,
    "equipment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workout_exercises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sets" (
    "id" SERIAL NOT NULL,
    "workout_exercise_id" INTEGER NOT NULL,
    "set_number" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "rest_seconds" INTEGER,
    "rir" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exercise_id" INTEGER,
    "custom_exercise_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_snapshots" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "exercise_id" INTEGER,
    "custom_exercise_id" INTEGER,
    "date" TEXT NOT NULL,
    "weight" DOUBLE PRECISION,
    "reps" INTEGER,
    "volume" DOUBLE PRECISION,
    "one_rm_estimate" DOUBLE PRECISION,

    CONSTRAINT "progress_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_checkins" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "checkin_date" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "body_metrics" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "weight_kg" DOUBLE PRECISION,
    "height_cm" DOUBLE PRECISION,
    "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "body_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

-- CreateIndex
CREATE INDEX "exercise_catalog_name_en_idx" ON "exercise_catalog"("name_en");

-- CreateIndex
CREATE INDEX "exercise_catalog_name_normalized_idx" ON "exercise_catalog"("name_normalized");

-- CreateIndex
CREATE INDEX "exercise_catalog_target_idx" ON "exercise_catalog"("target");

-- CreateIndex
CREATE INDEX "exercise_catalog_equipment_idx" ON "exercise_catalog"("equipment");

-- CreateIndex
CREATE INDEX "exercise_catalog_body_part_idx" ON "exercise_catalog"("body_part");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_catalog_source_source_exercise_id_key" ON "exercise_catalog"("source", "source_exercise_id");

-- CreateIndex
CREATE INDEX "custom_exercises_user_id_idx" ON "custom_exercises"("user_id");

-- CreateIndex
CREATE INDEX "exercise_name_map_exercise_id_idx" ON "exercise_name_map"("exercise_id");

-- CreateIndex
CREATE INDEX "exercise_name_map_external_source_external_id_idx" ON "exercise_name_map"("external_source", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "exercise_name_map_exercise_id_external_source_key" ON "exercise_name_map"("exercise_id", "external_source");

-- CreateIndex
CREATE INDEX "workouts_user_id_idx" ON "workouts"("user_id");

-- CreateIndex
CREATE INDEX "workouts_workout_date_idx" ON "workouts"("workout_date");

-- CreateIndex
CREATE INDEX "workouts_created_at_idx" ON "workouts"("created_at");

-- CreateIndex
CREATE INDEX "workout_exercises_workout_id_idx" ON "workout_exercises"("workout_id");

-- CreateIndex
CREATE INDEX "workout_exercises_exercise_id_idx" ON "workout_exercises"("exercise_id");

-- CreateIndex
CREATE INDEX "sets_workout_exercise_id_idx" ON "sets"("workout_exercise_id");

-- CreateIndex
CREATE INDEX "favorites_user_id_idx" ON "favorites"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_exercise_id_key" ON "favorites"("user_id", "exercise_id");

-- CreateIndex
CREATE UNIQUE INDEX "favorites_user_id_custom_exercise_id_key" ON "favorites"("user_id", "custom_exercise_id");

-- CreateIndex
CREATE INDEX "progress_snapshots_user_id_idx" ON "progress_snapshots"("user_id");

-- CreateIndex
CREATE INDEX "progress_snapshots_exercise_id_idx" ON "progress_snapshots"("exercise_id");

-- CreateIndex
CREATE INDEX "progress_snapshots_date_idx" ON "progress_snapshots"("date");

-- CreateIndex
CREATE UNIQUE INDEX "progress_snapshots_user_id_exercise_id_date_key" ON "progress_snapshots"("user_id", "exercise_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "progress_snapshots_user_id_custom_exercise_id_date_key" ON "progress_snapshots"("user_id", "custom_exercise_id", "date");

-- CreateIndex
CREATE INDEX "daily_checkins_user_id_checkin_date_idx" ON "daily_checkins"("user_id", "checkin_date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_checkins_user_id_checkin_date_key" ON "daily_checkins"("user_id", "checkin_date");

-- CreateIndex
CREATE INDEX "body_metrics_user_id_measured_at_idx" ON "body_metrics"("user_id", "measured_at");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_exercises" ADD CONSTRAINT "custom_exercises_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_media" ADD CONSTRAINT "exercise_media_custom_exercise_id_fkey" FOREIGN KEY ("custom_exercise_id") REFERENCES "custom_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_name_map" ADD CONSTRAINT "exercise_name_map_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_custom_exercise_id_fkey" FOREIGN KEY ("custom_exercise_id") REFERENCES "custom_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sets" ADD CONSTRAINT "sets_workout_exercise_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_custom_exercise_id_fkey" FOREIGN KEY ("custom_exercise_id") REFERENCES "custom_exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_exercise_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercise_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progress_snapshots" ADD CONSTRAINT "progress_snapshots_custom_exercise_id_fkey" FOREIGN KEY ("custom_exercise_id") REFERENCES "custom_exercises"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_checkins" ADD CONSTRAINT "daily_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "body_metrics" ADD CONSTRAINT "body_metrics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
