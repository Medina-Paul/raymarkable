import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/api/query-keys";
import {
  fetchMyTeam,
  createTeam,
  joinTeam,
  leaveTeam,
  removeTeamMember,
  nudgeTeammate,
  fetchNotifications,
  readNotification,
} from "@/lib/api/teams";
import type { TeamData, TeamMember, TeamEvent, User } from "@/lib/types/team";
import type { Notification } from "@/lib/types/notification";

// Re-export types for consumers
export type { TeamData, TeamMember, TeamEvent, User, Notification };

/*
TANSTACK REACT QUERY HOOKS FOR TEAMS & NOTIFICATIONS
Manages team roster queries, joining/leaving pods, social nudges, and live unread notifications.
*/

// Fetch current user's team, members, pending tasks, and live activity feed
export function useMyTeam() {
  return useQuery<TeamData>({
    queryKey: QUERY_KEYS.teams.me,
    queryFn: fetchMyTeam,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

// Create a new accountability team
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.me }),
  });
}

// Join an existing team by its invite ID
export function useJoinTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => joinTeam(teamId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.me }),
  });
}

// Leave the current team
export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: leaveTeam,
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.me }),
  });
}

// Remove a member (Team Leader only)
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => removeTeamMember(targetId),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.me }),
  });
}

// Nudge a teammate about a specific pending habit
export function useNudgeTeammate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ targetId, taskTitle }: { targetId: string; taskTitle: string }) =>
      nudgeTeammate(targetId, taskTitle),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.me }),
  });
}

/*
Fetch unread notifications. Realtime WebSockets in NotificationsListener
handle instant push notifications without needing background HTTP polling.
*/
export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: QUERY_KEYS.notifications.all,
    queryFn: fetchNotifications,
    staleTime: 60 * 1000, // 1 minute cache (Supabase Realtime handles instant invalidation)
    refetchInterval: false, // Turn off continuous background HTTP polling
  });
}

// Mark a notification as dismissed/read
export function useReadNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => readNotification(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all }),
  });
}
