/**
 * ACCOUNTABILITY TEAM DOMAIN TYPES
 */

export type TeamMember = {
  id: string;
  name: string;
  avatarUrl: string;
  currentStreak: number;
  activeHabits: {
    id: string;
    title: string;
    deadlineTime: string | null;
    date?: string;
    isGrace?: boolean;
  }[];
};

// Backwards compatibility alias
export type User = TeamMember;

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
  members: TeamMember[];
  events: TeamEvent[];
  currentUserId: string | null;
};
