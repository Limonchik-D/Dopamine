import { Hono } from "hono";
import type { Env, HonoVariables } from "../types/index.js";
import { authenticate } from "../middlewares/authenticate.js";
import { getAppConfig } from "../config/env.js";
import { prisma } from "../db/prisma.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const uploadRoutes = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

uploadRoutes.use("*", authenticate());

// POST /uploads/photo
// Accepts multipart/form-data with field "file" and optional "exercise_id" or "custom_exercise_id"
uploadRoutes.post("/photo", async (c) => {
  const config = getAppConfig(c.env);
  const userId = c.get("userId") as number;
  const formData = await c.req.formData();
  const file = formData.get("file");

  if (!file || typeof (file as unknown) === "string") {
    return c.json({ success: false, error: "Файл не найден в запросе" }, 400);
  }

  const uploadedFile = file as unknown as File;

  // Validate MIME type
  if (!ALLOWED_MIME_TYPES.has(uploadedFile.type)) {
    return c.json(
      { success: false, error: "Допустимые форматы: JPEG, PNG, WebP, GIF" },
      400
    );
  }

  // Validate file size
  const maxBytes = config.uploads.maxSizeMb * 1024 * 1024;
  if (uploadedFile.size > maxBytes) {
    return c.json(
      { success: false, error: `Максимальный размер файла — ${config.uploads.maxSizeMb} МБ` },
      400
    );
  }

  const ext = uploadedFile.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const r2Key = `users/${userId}/exercises/${crypto.randomUUID()}.${ext}`;

  await c.env.R2_BUCKET.put(r2Key, await uploadedFile.arrayBuffer(), {
    httpMetadata: { contentType: uploadedFile.type },
    customMetadata: { uploadedBy: String(userId) },
  });

  // Optionally link to custom exercise
  const customExerciseId = formData.get("custom_exercise_id");
  if (customExerciseId) {
    const ceId = parseInt(String(customExerciseId), 10);
    // Verify ownership and update
    const ce = await prisma.customExercise.findFirst({
      where: { id: ceId, user_id: userId, deleted_at: null },
    });
    if (ce) {
      await prisma.customExercise.update({ where: { id: ceId }, data: { photo_r2_key: r2Key } });
      await prisma.exerciseMedia.create({
        data: { custom_exercise_id: ceId, r2_key: r2Key, media_type: "image" },
      });
    }
  }

  // Return the public URL (via Workers R2 public bucket or presigned)
  const publicUrl = `/api/uploads/media/${r2Key}`;
  return c.json({ success: true, data: { r2_key: r2Key, url: publicUrl } }, 201);
});

// GET /uploads/media/:key* — serve R2 object
uploadRoutes.get("/media/:key{.+}", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.R2_BUCKET.get(key);

  if (!object) {
    return c.json({ success: false, error: "Медиафайл не найден" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});
