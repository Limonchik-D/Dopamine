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

export function useProgress(period: StatsPeriod) {
  return useQuery({
    queryKey: ["progress", period],
    queryFn: () => apiClient.get<{ points: StatsPoint[] }>(`/stats/${period}`),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
