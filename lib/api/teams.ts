/**
 * CLIENT SDK: TEAMS & NOTIFICATIONS
 */

import type { TeamData, TeamSummary } from "@/lib/types/team";
import type { Notification } from "@/lib/types/notification";
import { formatLocalDate } from "@/lib/utils/formatters";

const API_BASE = '/api/v1';

function getClientHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return {
    'x-client-date': formatLocalDate(new Date()),
  };
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    const text = await res.text().catch(() => '');
    return text || fallback;
  }
}

export async function fetchMyTeams(): Promise<TeamSummary[]> {
  const res = await fetch(`${API_BASE}/teams`, {
    headers: getClientHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to fetch teams"));
  return res.json();
}

export async function fetchTeamDetails(teamId: string): Promise<TeamData> {
  const res = await fetch(`${API_BASE}/teams/${teamId}`, {
    headers: getClientHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to fetch team details"));
  return res.json();
}

// Backwards compatibility alias
export async function fetchMyTeam(): Promise<TeamData> {
  const teams = await fetchMyTeams();
  if (teams.length === 0) {
    return { team: null, members: [], events: [], currentUserId: null };
  }
  return fetchTeamDetails(teams[0].id);
}

export async function createTeam(name: string): Promise<{ success: boolean; team: TeamSummary }> {
  const res = await fetch(`${API_BASE}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to create team"));
  return res.json();
}

export async function joinTeam(teamId: string): Promise<{ success: boolean; teamId?: string }> {
  const res = await fetch(`${API_BASE}/teams/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to join team"));
  return res.json();
}

export async function leaveTeam(teamId: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/leave`, { method: "POST" });
  if (!res.ok) throw new Error(await parseError(res, "Failed to leave team"));
  return res.json();
}

export async function removeTeamMember(teamId: string, targetId: string): Promise<{ success: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/remove-member`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to remove member"));
  return res.json();
}

export async function nudgeTeammate(teamId: string, targetId: string, taskTitle: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/teams/${teamId}/nudge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId, taskTitle }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to nudge teammate"));
  return res.json();
}

export async function fetchNotifications(): Promise<Notification[]> {
  const res = await fetch(`${API_BASE}/notifications`);
  if (!res.ok) {
    if (res.status === 401) {
      return [];
    }
    throw new Error(`Failed to fetch notifications: ${res.status}`);
  }
  return res.json();
}

export async function readNotification(id: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to read notification");
  return res.json();
}

