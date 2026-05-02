import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";

export type AdminOverview = {
  users: number;
  workouts: number;
  customExercises: number;
};

export type AdminUser = {
  id: number;
  email: string;
  username: string;
  role: "user" | "admin";
  created_at: string;
};

export type AdminDiagnostics = {
  ready: boolean;
  dependencies: {
    db: boolean;
    kv: boolean;
  };
  counters: {
    users: number;
    workouts: number;
    checkins: number;
  };
  latestMigration: {
    name: string;
    applied_at: string;
  } | null;
  ts: string;
};

export function useAdminOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => apiClient.get<AdminOverview>("/admin/overview"),
    enabled,
  });
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-users"],
    queryFn: () => apiClient.get<{ users: AdminUser[]; total: number }>("/admin/users"),
    enabled,
  });
}

export function useAdminDiagnostics(enabled: boolean) {
  return useQuery({
    queryKey: ["admin-diagnostics"],
    queryFn: () => apiClient.get<AdminDiagnostics>("/admin/diagnostics"),
    enabled,
    refetchInterval: enabled ? 60_000 : false,
    staleTime: 30_000,
  });
}

export function useSyncCatalog() {
  return useMutation({
    mutationFn: (force: boolean) =>
      apiClient.post<{ synced: number; source: string }>("/exercises/sync", { force }),
  });
}

export function useTranslateCatalog() {
  return useMutation({
    mutationFn: (batchSize: number) =>
      apiClient.post<{ translated: number; remaining: number }>("/exercises/translate", { batchSize }),
  });
}
