import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { clearAuthToken, getAuthToken, setAuthToken } from "../../services/auth";
import { useUiSettings } from "../settings/useUiSettings";

type LoginPayload = { email: string; password: string };
type RegisterPayload = { email: string; username: string; password: string; weight_kg?: number; height_cm?: number };

export type MeResponse = {
  id: number;
  email: string;
  username: string;
  role: "user" | "admin";
  profile?: {
    avatar_url: string | null;
    bio: string | null;
  } | null;
};

export type PatchMePayload = {
  username?: string;
  bio?: string;
  avatar_url?: string;
};

export function usePatchMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PatchMePayload) => apiClient.patch<MeResponse>("/me", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["me"] }),
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiClient.get<MeResponse>("/me"),
    enabled: Boolean(getAuthToken()),
  });
}

export function useLogin() {
  const hydrateFromServer = useUiSettings((s) => s.hydrateFromServer);

  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiClient.post<{ user: MeResponse; token: string }>("/auth/login", payload),
    onSuccess: async (data) => {
      setAuthToken(data.token);
      try {
        const settings = await apiClient.get<{
          theme: "calm" | "sport" | "minimal" | "dark";
          locale: "ru" | "en";
          units: "metric" | "imperial";
          notifications_enabled: boolean;
        }>("/settings");
        hydrateFromServer({ theme: settings.theme, locale: settings.locale });
      } catch {
        // Ignore sync errors to avoid breaking auth flow.
      }
    },
  });
}

export function useRegister() {
  const hydrateFromServer = useUiSettings((s) => s.hydrateFromServer);

  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      apiClient.post<{ user: MeResponse; token: string }>("/auth/register", payload),
    onSuccess: async (data) => {
      setAuthToken(data.token);
      try {
        const settings = await apiClient.get<{
          theme: "calm" | "sport" | "minimal" | "dark";
          locale: "ru" | "en";
          units: "metric" | "imperial";
          notifications_enabled: boolean;
        }>("/settings");
        hydrateFromServer({ theme: settings.theme, locale: settings.locale });
      } catch {
        // Ignore sync errors to avoid breaking auth flow.
      }
    },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiClient.post<{ message: string }>("/auth/logout"),
    onSuccess: () => clearAuthToken(),
  });
}

// ─── Body Metrics ─────────────────────────────────────────────────────────────
export type BodyMetric = { id: number; weight_kg: number | null; height_cm: number | null; measured_at: string };

export function useBodyMetrics() {
  return useQuery({
    queryKey: ["body-metrics"],
    queryFn: () => apiClient.get<BodyMetric[]>("/me/body-metrics"),
    enabled: !!getAuthToken(),
  });
}

export function useAddBodyMetric() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { weight_kg?: number; height_cm?: number }) =>
      apiClient.post<BodyMetric>("/me/body-metrics", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["body-metrics"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}
