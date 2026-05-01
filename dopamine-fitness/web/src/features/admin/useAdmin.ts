import { useQuery } from "@tanstack/react-query";
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
