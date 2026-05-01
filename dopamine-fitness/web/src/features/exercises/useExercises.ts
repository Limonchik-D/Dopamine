import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

export type Exercise = {
  id: number;
  name_en: string;
  name_ru: string | null;
  target: string | null;
  equipment: string | null;
  body_part: string | null;
  gif_url: string | null;
  image_url: string | null;
  instructions_en: string | null;
  instructions_ru: string | null;
  source: string;
};

export type ExerciseFilters = {
  search?: string;
  target?: string;
  equipment?: string;
  body_part?: string;
  page?: number;
  limit?: number;
};

export type FavoriteItem = {
  id: number;
  exercise_id: number | null;
  custom_exercise_id: number | null;
  name_en?: string;
  name_ru?: string | null;
  target?: string | null;
  gif_url?: string | null;
};

export type ExerciseFilterOptions = {
  targets: string[];
  equipment: string[];
  bodyParts: string[];
};

function buildQuery(filters: ExerciseFilters): string {
  const p = new URLSearchParams();
  if (filters.search) p.set("search", filters.search);
  if (filters.target) p.set("target", filters.target);
  if (filters.equipment) p.set("equipment", filters.equipment);
  if (filters.body_part) p.set("body_part", filters.body_part);
  if (filters.page) p.set("page", String(filters.page));
  if (filters.limit) p.set("limit", String(filters.limit));
  const qs = p.toString();
  return qs ? `?${qs}` : "";
}

export function useExercises(filters: ExerciseFilters = {}) {
  return useQuery({
    queryKey: ["exercises", filters],
    queryFn: () =>
      apiClient.get<{ exercises: Exercise[]; total: number; hasNext: boolean }>(
        `/exercises${buildQuery(filters)}`
      ),
    placeholderData: (prev) => prev,
  });
}

export function useExercise(id: string | undefined) {
  return useQuery({
    queryKey: ["exercise", id],
    queryFn: () => apiClient.get<Exercise>(`/exercises/${id}`),
    enabled: Boolean(id),
  });
}

export function useExerciseFilterOptions() {
  return useQuery({
    queryKey: ["exercise-filters"],
    queryFn: () => apiClient.get<ExerciseFilterOptions>("/exercises/filters"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: ["favorites"],
    queryFn: () => apiClient.get<FavoriteItem[]>("/favorites"),
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const add = useMutation({
    mutationFn: (exerciseId: number) =>
      apiClient.post<FavoriteItem>("/favorites", { exercise_id: exerciseId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
  const remove = useMutation({
    mutationFn: (exerciseId: number) =>
      apiClient.delete<unknown>("/favorites", { exercise_id: exerciseId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["favorites"] }),
  });
  return { add, remove };
}

