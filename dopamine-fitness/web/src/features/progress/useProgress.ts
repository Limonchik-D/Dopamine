import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

export type StatsPeriod = "week" | "month" | "3months" | "year";

export type StatsPoint = {
  date: string;
  volume: number;
  max_weight: number;
  total_reps: number;
  workout_count: number;
};

export type ExerciseProgressPoint = {
  date: string;
  weight: number | null;
  reps: number | null;
  volume: number | null;
  one_rm_estimate: number | null;
};

export type StatsSummary = {
  total_workouts: number;
  total_volume: number;
  total_sets: number;
  max_weight: number;
  active_days: number;
};

export function useProgress(period: StatsPeriod) {
  return useQuery({
    queryKey: ["progress", period],
    queryFn: () => apiClient.get<{ points: StatsPoint[] }>(`/stats/${period}`),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useExerciseProgress(exerciseId: number | null, period: StatsPeriod) {
  return useQuery({
    queryKey: ["progress", "exercise", exerciseId, period],
    queryFn: () =>
      apiClient.get<{ points: ExerciseProgressPoint[] }>(
        `/stats/exercise/${exerciseId}?period=${period}`
      ),
    enabled: exerciseId !== null,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useStatsSummary() {
  return useQuery({
    queryKey: ["stats", "summary"],
    queryFn: () => apiClient.get<StatsSummary>("/stats/summary"),
    staleTime: 5 * 60_000,
  });
}
