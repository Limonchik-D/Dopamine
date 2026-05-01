import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

export type CustomExercise = {
  id: number;
  name: string;
  description: string | null;
  target: string | null;
  equipment: string | null;
  photo_r2_key: string | null;
  created_at: string;
};

export type CreateCustomExerciseInput = {
  name: string;
  description?: string;
  target?: string;
  equipment?: string;
};

export type UpdateCustomExerciseInput = Partial<CreateCustomExerciseInput>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useCustomExercises() {
  return useQuery({
    queryKey: ["custom-exercises"],
    queryFn: () => apiClient.get<CustomExercise[]>("/custom-exercises"),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateCustomExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCustomExerciseInput) =>
      apiClient.post<CustomExercise>("/custom-exercises", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-exercises"] }),
  });
}

export function useUpdateCustomExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateCustomExerciseInput }) =>
      apiClient.patch<CustomExercise>(`/custom-exercises/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-exercises"] }),
  });
}

export function useDeleteCustomExercise() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete<unknown>(`/custom-exercises/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-exercises"] }),
  });
}

// ─── Photo upload ─────────────────────────────────────────────────────────────

export type UploadResult = { r2_key: string; url: string };

/** Upload photo to R2 via multipart/form-data.
 *  Optionally links to a custom_exercise_id. */
export async function uploadExercisePhoto(
  file: File,
  customExerciseId?: number
): Promise<UploadResult> {
  const token = localStorage.getItem("df_token");
  const form = new FormData();
  form.append("file", file);
  if (customExerciseId != null) {
    form.append("custom_exercise_id", String(customExerciseId));
  }

  const res = await fetch("/api/uploads/photo", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const body = (await res.json()) as { success: boolean; data?: UploadResult; error?: string };
  if (!res.ok || !body.success) {
    throw new Error(body.error ?? "Ошибка загрузки фото");
  }
  return body.data!;
}

export function useUploadExercisePhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file, customExerciseId }: { file: File; customExerciseId?: number }) =>
      uploadExercisePhoto(file, customExerciseId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["custom-exercises"] }),
  });
}
