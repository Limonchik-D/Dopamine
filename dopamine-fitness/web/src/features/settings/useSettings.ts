import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

export type Settings = {
  theme: "fitness" | "calm" | "sport" | "minimal" | "dark";
  locale: "ru" | "en";
  units: "metric" | "imperial";
  notifications_enabled: boolean;
};

export function useSettings(enabled = true) {
  return useQuery({
    queryKey: ["settings"],
    queryFn: () => apiClient.get<Settings>("/settings"),
    enabled,
  });
}

export function usePatchSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<Settings>) => apiClient.patch<Settings>("/settings", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}
