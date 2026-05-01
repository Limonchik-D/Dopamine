import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { clearAuthToken, getAuthToken, setAuthToken } from "../../services/auth";
import { useUiSettings } from "../settings/useUiSettings";

type LoginPayload = { email: string; password: string };
type RegisterPayload = { email: string; username: string; password: string };

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
