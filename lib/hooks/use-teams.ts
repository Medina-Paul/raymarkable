import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/api/query-keys";
import {
  fetchMyTeams,
  fetchTeamDetails,
  fetchMyTeam,
  createTeam,
  joinTeam,
  leaveTeam,
  removeTeamMember,
  nudgeTeammate,
  fetchNotifications,
  readNotification,
} from "@/lib/api/teams";
import type { TeamData, TeamMember, TeamEvent, TeamSummary, User } from "@/lib/types/team";
import type { Notification } from "@/lib/types/notification";

// Re-export types for consumers
export type { TeamData, TeamMember, TeamEvent, TeamSummary, User, Notification };

/*
TANSTACK REACT QUERY HOOKS FOR TEAMS & NOTIFICATIONS
Manages multi-team roster queries, joining/leaving pods, social nudges, and live unread notifications.
*/

// Fetch all pods the current user belongs to (for overview grid)
export function useMyTeams() {
  return useQuery<TeamSummary[]>({
    queryKey: QUERY_KEYS.teams.all,
    queryFn: fetchMyTeams,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// Fetch single team details, roster, pending tasks, and live feed
export function useTeamDetails(teamId: string) {
  return useQuery<TeamData>({
    queryKey: QUERY_KEYS.teams.detail(teamId),
    queryFn: () => fetchTeamDetails(teamId),
    enabled: !!teamId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// Backwards compatibility hook
export function useMyTeam() {
  return useQuery<TeamData>({
    queryKey: QUERY_KEYS.teams.me,
    queryFn: fetchMyTeam,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

// Create a new accountability team
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createTeam(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.all });
    },
  });
}

// Join an existing team by its invite ID
export function useJoinTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => joinTeam(teamId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.all });
    },
  });
}

// Leave a specific team
export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (teamId: string) => leaveTeam(teamId),
    onSuccess: (_data, teamId) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.all });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.detail(teamId) });
    },
  });
}

// Remove a member (Team Leader only)
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, targetId }: { teamId: string; targetId: string }) =>
      removeTeamMember(teamId, targetId),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.all });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.detail(teamId) });
    },
  });
}

// Nudge a teammate about a specific pending habit
export function useNudgeTeammate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamId,
      targetId,
      taskTitle,
    }: {
      teamId: string;
      targetId: string;
      taskTitle: string;
    }) => nudgeTeammate(teamId, targetId, taskTitle),
    onSuccess: (_data, { teamId }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.teams.detail(teamId) });
    },
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
    staleTime: 60 * 1000,
    refetchInterval: false,
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

