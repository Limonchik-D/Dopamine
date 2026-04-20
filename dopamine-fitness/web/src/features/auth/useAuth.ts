import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../../services/apiClient";
import { clearAuthToken, setAuthToken } from "../../services/auth";

type LoginPayload = { email: string; password: string };
type RegisterPayload = { email: string; username: string; password: string };

export type MeResponse = {
  id: number;
  email: string;
  username: string;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiClient.get<MeResponse>("/me"),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) =>
      apiClient.post<{ user: MeResponse; token: string }>("/auth/login", payload),
    onSuccess: (data) => setAuthToken(data.token),
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) =>
      apiClient.post<{ user: MeResponse; token: string }>("/auth/register", payload),
    onSuccess: (data) => setAuthToken(data.token),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => apiClient.post<{ message: string }>("/auth/logout"),
    onSuccess: () => clearAuthToken(),
  });
}
