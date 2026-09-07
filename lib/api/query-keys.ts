/**
 * TANSTACK QUERY KEY CONSTANTS
 * Central registry of query keys for consistent caching and cache invalidation.
 */

export const QUERY_KEYS = {
  habits: {
    all: ["habits"] as const,
    categories: ["categories"] as const,
  },
  teams: {
    me: ["team", "me"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
  },
  profile: {
    me: ["profile", "me"] as const,
    user: (id: string) => ["profile", id] as const,
  },
} as const;
