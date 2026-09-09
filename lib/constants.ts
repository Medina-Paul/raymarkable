/**
 * SYSTEM CONSTANTS & CONFIGURATION
 */

export const STORAGE_KEYS = {
  SOUND_ENABLED: "raymarkable_sound_enabled",
  PUSH_DISABLED: "raymarkable_push_disabled",
} as const;

export const GRACE_PERIOD_HOURS = 48;
export const MAX_TEAM_MEMBERS = 5;
export const MAX_TEAMS_PER_USER = 10;
export const MAX_NUDGES_PER_MINUTE = 5;
export const NUDGE_WINDOW_MS = 60 * 1000;
