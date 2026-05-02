import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

function invalidateProgressAndSummary(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["progress"] });
  queryClient.invalidateQueries({ queryKey: ["stats"] });
}

export type Workout = {
  id: number;
  name: string;
  description: string | null;
  workout_date: string;
  notes: string | null;
  completed_at: string | null;
  duration_minutes: number | null;
};

export type WorkoutSet = {
  id: number;
  workout_exercise_id: number;
  set_number: number;
  weight: number | null;
  reps: number | null;
  rest_seconds: number | null;
  rir: number | null;
  completed: boolean;
};

export type WorkoutExerciseEntry = {
  id: number;
  workout_id: number;
  exercise_id: number | null;
  custom_exercise_id: number | null;
  order_index: number;
  target_muscle: string | null;
  equipment: string | null;
  // Joined fields from exercise_catalog
  exercise_name?: string | null;
  exercise_gif_url?: string | null;
  exercise_image_url?: string | null;
  exercise_instructions_en?: string | null;
  exercise_instructions_ru?: string | null;
  exercise_target?: string | null;
  exercise_equipment?: string | null;
  // Joined fields from custom_exercises
  custom_name?: string | null;
  custom_photo_key?: string | null;
  custom_description?: string | null;
  custom_target?: string | null;
  custom_equipment?: string | null;
  // Suggested values from previous completed workout
  last_weight?: number | null;
  last_reps?: number | null;
  sets: WorkoutSet[];
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
    queryFn: () =>
      apiClient.get<Workout & { exercises: WorkoutExerciseEntry[] }>(`/workouts/${id}`),
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
      invalidateProgressAndSummary(queryClient);
    },
  });
}

export function useDuplicateWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      workout_date,
      name,
    }: {
      id: number;
      workout_date?: string;
      name?: string;
    }) => apiClient.post<Workout>(`/workouts/${id}/duplicate`, { workout_date, name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      invalidateProgressAndSummary(queryClient);
    },
  });
}

export function useDeleteWorkout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete<unknown>(`/workouts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      invalidateProgressAndSummary(queryClient);
    },
  });
}

export function useAddExerciseToWorkout(workoutId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { exercise_id?: number; custom_exercise_id?: number; order_index?: number; target_muscle?: string; equipment?: string }) =>
      apiClient.post<WorkoutExerciseEntry>(`/workouts/${workoutId}/exercises`, { order_index: 0, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout", String(workoutId)] });
      invalidateProgressAndSummary(queryClient);
    },
  });
}

export function useRemoveExerciseFromWorkout(workoutId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (weId: number) => apiClient.delete<unknown>(`/workouts/exercises/${weId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout", String(workoutId)] });
      invalidateProgressAndSummary(queryClient);
    },
  });
}

export function useAddSet(workoutId: number, weId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { set_number: number; weight?: number; reps?: number; rest_seconds?: number; rir?: number; completed?: boolean }) =>
      apiClient.post<WorkoutSet>(`/workouts/exercises/${weId}/sets`, { completed: false, ...payload }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout", String(workoutId)] });
      invalidateProgressAndSummary(queryClient);
    },
  });
}

export function useUpdateSet(workoutId: number, weId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ setId, payload }: { setId: number; payload: Partial<{ weight: number; reps: number; rest_seconds: number; rir: number; completed: boolean }> }) =>
      apiClient.patch<WorkoutSet>(`/workouts/exercises/${weId}/sets/${setId}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout", String(workoutId)] });
      invalidateProgressAndSummary(queryClient);
    },
  });
}

export function useDeleteSet(workoutId: number, weId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (setId: number) => apiClient.delete<unknown>(`/workouts/exercises/${weId}/sets/${setId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout", String(workoutId)] });
      invalidateProgressAndSummary(queryClient);
    },
  });
}

export function useCompleteWorkout(workoutId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (duration_minutes?: number) =>
      apiClient.post<unknown>(`/workouts/${workoutId}/complete`, { duration_minutes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workout", String(workoutId)] });
      queryClient.invalidateQueries({ queryKey: ["workouts"] });
      invalidateProgressAndSummary(queryClient);
    },
  });
}
