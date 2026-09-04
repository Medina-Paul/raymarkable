import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api/habits";
import type { CreateHabitInput, Habit } from "@/lib/types/habit";

/*
TANSTACK REACT QUERY HOOKS FOR HABITS & PROFILES

Why React Query?
1. Caches habits in browser memory so page transitions are instant.
2. Automatically invalidates and refetches stale data when mutations succeed.
3. Supports "Optimistic Updates" so button clicks feel instantaneous (0ms UI lag).
*/

const HABITS_KEY = ["habits"] as const;
const CATEGORIES_KEY = ["categories"] as const;
const PROFILE_KEY = ["profile"] as const;

// Fetch all user habits
export function useHabits() {
  return useQuery({
    queryKey: HABITS_KEY,
    queryFn: api.fetchHabits,
  });
}

// Create a new habit and refresh the cached list
export function useCreateHabit(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHabitInput) => api.createHabit(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HABITS_KEY });
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
      onSuccess?.();
    },
  });
}

// Edit habit details
export function useUpdateHabit(onSuccess?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (habit: Habit) => api.updateHabit(habit),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HABITS_KEY });
      onSuccess?.();
    },
  });
}

/*
Update numeric habit progress (e.g. +1 page, +250ml water) with OPTIMISTIC UI:
1. onMutate: Immediately update the local React Query cache so the counter increments instantly on screen.
2. onError: If the server network fails, rollback cache to previous snapshot.
3. onSettled: Sync with server and refresh streaks and live team feeds.
*/
export function useUpdateHabitProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, delta, value }: { id: string; delta?: number; value?: number }) =>
      api.updateHabitProgress(id, { delta, value }),
    onMutate: async ({ id, delta, value }) => {
      await qc.cancelQueries({ queryKey: HABITS_KEY });
      const previousHabits = qc.getQueryData<Habit[]>(HABITS_KEY);
      
      if (previousHabits) {
        qc.setQueryData<Habit[]>(
          HABITS_KEY,
          previousHabits.map((h) => {
            if (h.id !== id) return h;
            let nextVal = h.currentValue;
            if (typeof delta === 'number') nextVal = Math.max(0, h.currentValue + delta);
            else if (typeof value === 'number') nextVal = Math.max(0, value);
            const isComp = h.targetValue ? nextVal >= h.targetValue : false;
            return { ...h, currentValue: nextVal, completed: isComp };
          })
        );
      }
      return { previousHabits };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousHabits) {
        qc.setQueryData(HABITS_KEY, context.previousHabits);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: HABITS_KEY });
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: ["team", "me"] });
    },
  });
}

// Toggle completion on a boolean habit
export function useToggleHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.toggleHabit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: HABITS_KEY });
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: ["team", "me"] });
    },
  });
}

// Permanently delete a habit
export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteHabit(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: HABITS_KEY }),
  });
}

// Fetch user categories
export function useCategories() {
  return useQuery({
    queryKey: CATEGORIES_KEY,
    queryFn: api.fetchCategories,
  });
}

// Delete a category
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CATEGORIES_KEY });
    },
  });
}

// Fetch current user profile & live dynamic streak
export function useProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: api.fetchProfile,
  });
}

// Update profile settings (name, avatar, goal threshold)
export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name?: string; avatarUrl?: string; successThreshold?: number }) => api.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: ["team", "me"] });
    },
  });
}

// Permanently delete user account and wipe all database records
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteAccount,
    onSuccess: () => {
      qc.clear();
    },
  });
}
