/**
 * CLIENT SDK: TEAMS & NOTIFICATIONS
 */

import type { TeamData } from "@/lib/types/team";
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

export async function fetchMyTeam(): Promise<TeamData> {
  const res = await fetch(`${API_BASE}/teams/me`, {
    headers: getClientHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to fetch team"));
  return res.json();
}


export async function createTeam(name: string): Promise<{ success: boolean; team: unknown }> {
  const res = await fetch(`${API_BASE}/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to create team"));
  return res.json();
}

export async function joinTeam(teamId: string): Promise<{ success: boolean; team: unknown }> {
  const res = await fetch(`${API_BASE}/teams/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ teamId }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to join team"));
  return res.json();
}

export async function leaveTeam(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/teams/leave`, { method: "POST" });
  if (!res.ok) throw new Error(await parseError(res, "Failed to leave team"));
  return res.json();
}

export async function removeTeamMember(targetId: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE}/teams/remove-member`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetId }),
  });
  if (!res.ok) throw new Error(await parseError(res, "Failed to remove member"));
  return res.json();
}

export async function nudgeTeammate(targetId: string, taskTitle: string): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/teams/nudge`, {
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
