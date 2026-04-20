import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

export type Exercise = {
  id: number;
  name_en: string;
  name_ru: string | null;
  target: string | null;
  equipment: string | null;
  gif_url: string | null;
};

export function useExercises(search = "") {
  return useQuery({
    queryKey: ["exercises", search],
    queryFn: () => apiClient.get<{ exercises: Exercise[]; total: number }>(`/exercises?search=${encodeURIComponent(search)}`),
  });
}

export function useExercise(id: string | undefined) {
  return useQuery({
    queryKey: ["exercise", id],
    queryFn: () => apiClient.get<Exercise>(`/exercises/${id}`),
    enabled: Boolean(id),
  });
}
