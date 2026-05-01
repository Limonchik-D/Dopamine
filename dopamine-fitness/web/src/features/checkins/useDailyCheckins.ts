import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { apiClient } from "../../services/apiClient";

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentStreak(checkinsSet: Set<string>, today: Date) {
  let streak = 0;
  const cursor = new Date(today);

  while (checkinsSet.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

type CheckinEntity = {
  id: number;
  user_id: number;
  checkin_date: string;
  created_at: string;
};

type CheckinsResponse = {
  checkins: CheckinEntity[];
  total: number;
};

export function getRecentDays(days: number, today: Date) {
  const result: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    result.push(toDateKey(d));
  }
  return result;
}

export function useDailyCheckins() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["daily-checkins"],
    queryFn: () => apiClient.get<CheckinsResponse>("/checkins"),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });

  const checkinMutation = useMutation({
    mutationFn: (payload: { date?: string }) => apiClient.post<CheckinEntity>("/checkins", payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["daily-checkins"] }),
  });

  const checkins = useMemo(
    () => (data?.checkins ?? []).map((item) => item.checkin_date).sort(),
    [data]
  );

  const todayKey = toDateKey(new Date());
  const checkinsSet = useMemo(() => new Set(checkins), [checkins]);
  const checkedInToday = checkinsSet.has(todayKey);
  const streak = useMemo(() => getCurrentStreak(checkinsSet, new Date()), [checkinsSet]);

  const checkInToday = () => {
    if (checkedInToday) return;
    checkinMutation.mutate({ date: todayKey });
  };

  return {
    checkins,
    checkinsSet,
    todayKey,
    checkedInToday,
    streak,
    checkInToday,
    isLoading: checkinMutation.isPending,
  };
}
