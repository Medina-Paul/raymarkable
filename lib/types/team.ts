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

export type TeamSummary = {
  id: string;
  name: string;
  createdBy: string;
  isLeader: boolean;
  memberCount: number;
  members: Array<{
    id: string;
    name: string;
    avatarUrl: string | null;
  }>;
  createdAt: string;
};

export type TeamData = {
  team: { id: string; name: string; createdBy: string; isLeader?: boolean } | null;
  members: TeamMember[];
  events: TeamEvent[];
  currentUserId: string | null;
};
