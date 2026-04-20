import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

export type Workout = {
  id: number;
  name: string;
  description: string | null;
  workout_date: string;
};

export function useWorkouts() {
  return useQuery({
    queryKey: ["workouts"],
    queryFn: () => apiClient.get<{ workouts: Workout[]; total: number }>("/workouts"),
  });
}

export function useWorkout(id: string | undefined) {
  return useQuery({
    queryKey: ["workout", id],
    queryFn: () => apiClient.get<Workout & { exercises: unknown[] }>(`/workouts/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; workout_date: string; description?: string; notes?: string }) =>
      apiClient.post<Workout>("/workouts", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
    },
  });
}
