import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core";

/*
USERS TABLE
Represents user profiles linked directly to Supabase Auth UUIDs.
Stores individual streak records, custom goal thresholds (e.g. 75%), and team linkage.
*/
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey(), // Matches Supabase Auth user.id
    name: varchar("name", { length: 25 }).notNull(),
    avatarUrl: text("avatar_url"),
    email: text("email").notNull().unique(),
    currentStreak: integer("current_streak").default(0).notNull(),
    bestStreak: integer("best_streak").default(0).notNull(),
    successThreshold: integer("success_threshold").default(75).notNull(), // % needed for a "Green" day
    teamId: uuid("team_id"), // Nullable: only filled when a user is in an active team
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("users_team_id_idx").on(t.teamId)]
);

/*
CATEGORIES TABLE
Organizes habits (e.g. "Deep Work", "Fitness", "Reading").
Unique constraint ensures a single user cannot create duplicate categories with the same name.
*/
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 25 }).notNull(),
    isActive: boolean("is_active").default(true).notNull(), // Controls visibility in the habit creation preset list
  },
  (t) => [
    unique().on(t.name, t.userId),
    index("categories_user_id_idx").on(t.userId),
  ]
);

/*
HABITS TABLE
The core habit entity. Supports both boolean ("Done/Not Done") and numeric targets (e.g. "Read 20 pages").
*/
export const habits = pgTable(
  "habits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 60 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    date: date("date").defaultNow().notNull(), // Assigned target date (YYYY-MM-DD)
    deadlineTime: text("deadline_time"), // e.g. "22:00"
    habitType: varchar("habit_type", { length: 15 }).default("boolean").notNull(), // 'boolean' | 'numeric'
    targetValue: integer("target_value"), // For numeric habits (e.g. 2000 ml water)
    currentValue: integer("current_value").default(0).notNull(), // Tracks incremental progress
    unit: varchar("unit", { length: 20 }), // e.g. "pages", "km", "glasses"
    scheduledDays: text("scheduled_days"), // JSON string array e.g. '["MON","WED","FRI"]'
    isActive: boolean("is_active").default(true).notNull(), // true = pending, false = completed
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("habits_user_id_idx").on(t.userId),
    index("habits_category_id_idx").on(t.categoryId),
    index("habits_date_idx").on(t.date),
  ]
);

/*
HABIT LOGS TABLE (Historical Ledger)
Every time a habit is completed, a permanent completion log is recorded here.
This is what powers streak calculations and the 12-week GitHub-style heatmap.
*/
export const habitLogs = pgTable(
  "habit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    habitId: uuid("habit_id")
      .notNull()
      .references(() => habits.id, { onDelete: "cascade" }),
    completedDate: date("completed_date").notNull(),
    loggedValue: integer("logged_value"),
    status: boolean("status").default(true).notNull(),
  },
  (t) => [
    index("habit_logs_habit_id_idx").on(t.habitId),
    index("habit_logs_completed_date_idx").on(t.completedDate),
  ]
);

/*
TEAMS TABLE
Small accountability pods (max 5 members).
*/
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 25 }).notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    discordWebhookUrl: text("discord_webhook_url"),
    abandonedAt: timestamp("abandoned_at"), // Timestamped when empty; cleaned up after 3 days by cron
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("teams_created_by_idx").on(t.createdBy)]
);

/*
NOTIFICATIONS TABLE
In-app nudges and alerts sent from teammates.
*/
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: uuid("sender_id").references(() => users.id, {
      onDelete: "set null",
    }),
    receiverId: uuid("receiver_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("notifications_receiver_id_idx").on(t.receiverId),
    index("notifications_is_read_idx").on(t.isRead),
  ]
);

/*
TEAM EVENTS TABLE
Live social feed for the team (completions, nudges, members joining/leaving).
*/
export const teamEvents = pgTable(
  "team_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(), // 'COMPLETION', 'NUDGE', 'JOIN', 'LEAVE', 'KICK'
    actorId: uuid("actor_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetId: uuid("target_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("team_events_team_id_idx").on(t.teamId),
    index("team_events_created_at_idx").on(t.createdAt),
  ]
);
