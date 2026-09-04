import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

/*
TANSTACK REACT QUERY HOOKS FOR TEAMS & NOTIFICATIONS
Manages team roster queries, joining/leaving pods, social nudges, and live unread notifications.
*/

const API_BASE = '/api/v1';

export type User = {
  id: string;
  name: string;
  avatarUrl: string;
  currentStreak: number;
  activeHabits: { id: string; title: string; deadlineTime: string | null }[];
};

export type TeamEvent = {
  id: string;
  eventType: string;
  message: string;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    avatarUrl: string;
  };
};

export type TeamData = {
  team: { id: string; name: string; createdBy: string } | null;
  members: User[];
  events: TeamEvent[];
  currentUserId: string | null;
};

// Fetch current user's team, members, pending tasks, and live activity feed
export function useMyTeam() {
  return useQuery<TeamData>({
    queryKey: ["team", "me"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/teams/me`);
      if (!res.ok) throw new Error("Failed to fetch team");
      return res.json();
    },
  });
}

// Create a new accountability team
export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch(`${API_BASE}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", "me"] }),
  });
}

// Join an existing team by its invite ID
export function useJoinTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (teamId: string) => {
      const res = await fetch(`${API_BASE}/teams/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", "me"] }),
  });
}

// Leave the current team
export function useLeaveTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/teams/leave`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to leave team");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", "me"] }),
  });
}

// Remove a member (Team Leader only)
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetId: string) => {
      const res = await fetch(`${API_BASE}/teams/remove-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", "me"] }),
  });
}

// Nudge a teammate about a specific pending habit
export function useNudgeTeammate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, taskTitle }: { targetId: string; taskTitle: string }) => {
      const res = await fetch(`${API_BASE}/teams/nudge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, taskTitle }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team", "me"] }),
  });
}

export type Notification = {
  id: string;
  message: string;
  createdAt: string;
};

/*
Fetch unread notifications. Realtime WebSockets in NotificationsListener
handle instant push notifications without needing background HTTP polling.
*/
export function useNotifications() {
  return useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/notifications`);
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    staleTime: 60000,
  });
}

// Mark a notification as dismissed/read
export function useReadNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to read notification");
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}
