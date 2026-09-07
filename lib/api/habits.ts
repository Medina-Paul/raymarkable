import type { Habit, CreateHabitInput, Category } from "@/lib/types/habit";
import { formatLocalDate } from "@/lib/utils/formatters";

// We now call the real Elysia API running locally in Next.js
const API_BASE = '/api/v1';

function getClientHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  return {
    'x-client-date': formatLocalDate(new Date()),
  };
}

async function parseError(res: Response, defaultMessage: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || defaultMessage;
  } catch {
    const text = await res.text().catch(() => '');
    return text || defaultMessage;
  }
}

export async function fetchHabits(): Promise<Habit[]> {
  const res = await fetch(`${API_BASE}/habits`, {
    headers: getClientHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to fetch habits'));
  return res.json();
}


export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const res = await fetch(`${API_BASE}/habits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to create habit'));
  return res.json();
}

export async function updateHabit(updated: Habit): Promise<Habit> {
  const res = await fetch(`${API_BASE}/habits/${updated.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: updated.title,
      category: updated.category,
      date: updated.date,
      deadlineTime: updated.deadlineTime,
      habitType: updated.habitType,
      targetValue: updated.targetValue,
      unit: updated.unit,
      scheduledDays: updated.scheduledDays,
    }),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update habit'));
  return res.json();
}

export async function updateHabitProgress(id: string, payload: { delta?: number; value?: number }): Promise<Habit> {
  const res = await fetch(`${API_BASE}/habits/${id}/progress`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update habit progress'));
  return res.json();
}

export async function toggleHabit(id: string): Promise<Habit> {
  const res = await fetch(`${API_BASE}/habits/${id}/toggle`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to toggle habit'));
  return res.json();
}

export async function stopRepeatingHabit(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/habits/${id}/stop-repeating`, {
    method: 'PATCH',
    headers: getClientHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to stop repeating habit'));
}

export async function deleteHabit(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/habits/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to delete habit'));
}

export type { Category };

export async function fetchCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories`);
  if (!res.ok) throw new Error(await parseError(res, 'Failed to fetch categories'));
  return res.json();
}

export async function deleteCategory(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/categories/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    throw new Error(await parseError(res, 'Failed to delete category'));
  }
}

export async function fetchProfile() {
  const res = await fetch(`${API_BASE}/me`, {
    headers: getClientHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to fetch profile'));
  return res.json();
}


export async function updateProfile(data: { name?: string; avatarUrl?: string; successThreshold?: number }) {
  const res = await fetch(`${API_BASE}/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to update profile'));
  return res.json();
}

export async function deleteAccount(): Promise<void> {
  const res = await fetch(`${API_BASE}/me`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(await parseError(res, 'Failed to delete account'));
}

