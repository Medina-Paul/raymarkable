# Raymarkable — Engineering & Architecture Documentation

> **"Build better habits. Produce remarkable results."**  
> Raymarkable is a full-stack, mobile-responsive, habit tracking Progressive Web Application (PWA) built on modern web standards. It pairs individual habit mastery with accountability pods, real-time social feeds, dynamic streak calculation, and granular visual progress metrics.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Tech Stack Overview](#tech-stack-overview)
3. [Database Schema & Data Model](#database-schema--data-model)
4. [Core Features & Domain Logic](#core-features--domain-logic)
   - [Habit Tracking Modes](#habit-tracking-modes)
   - [Anti-Cheat & 48-Hour Grace Period](#anti-cheat--48-hour-grace-period)
   - [Dynamic Streak Engine](#dynamic-streak-engine)
   - [Accountability Pods & Teammate Nudges](#accountability-pods--teammate-nudges)
   - [Analytics & Visualizations](#analytics--visualizations)
   - [Audio Engine (Synthesized Chime)](#audio-engine-synthesized-chime)
   - [PWA & Web Push Notifications](#pwa--web-push-notifications)
5. [API Reference (Elysia REST Endpoints)](#api-reference-elysia-rest-endpoints)
6. [Frontend State & Query Management](#frontend-state--query-management)
7. [Authentication & Security Flow](#authentication--security-flow)
8. [Project Structure](#project-structure)
9. [Environment Variables & Setup Guide](#environment-variables--setup-guide)
10. [Automated Cron & Maintenance](#automated-cron--maintenance)

---

## System Architecture

The application combines Next.js 16 App Router on the frontend and ElysiaJS mounted via a catch-all route handler for low-latency backend execution. Supabase provides PostgreSQL storage, Google OAuth authentication, object storage, and Realtime WebSocket events.

```mermaid
flowchart TB
    subgraph Client["Client Browser / Installed PWA"]
        UI["React 19 Components (Tailwind v4)"]
        RQ["TanStack React Query Cache"]
        SW["Service Worker (sw.js) Cache"]
        Audio["Web Audio API Synthesizer"]
    end

    subgraph NextServer["Next.js 16 Server (Edge & Node.js)"]
        MW["Middleware (Session Guard & Cookie Refresh)"]
        RSC["Server Components (Profile & SSR)"]
        Cron["Cron Handler (/api/cron/cleanup-teams)"]
        subgraph ElysiaBackend["ElysiaJS Backend (/api/v1/*)"]
            AuthPlugin["Auth Plugin (Scoped Cookie Session Extraction)"]
            UserRouter["User Routes (/me)"]
            HabitRouter["Habit Routes (/habits)"]
            CategoryRouter["Category Routes (/categories)"]
            TeamRouter["Team Routes (/teams)"]
            NotificationRouter["Notification Routes (/notifications)"]
        end
    end

    subgraph SupabaseDB["Supabase Infrastructure"]
        Postgres[(PostgreSQL + Drizzle ORM)]
        SupabaseAuth["Supabase Auth (Google OAuth)"]
        Storage["Supabase Storage (avatars bucket)"]
        Realtime["Supabase Realtime (WebSocket Engine)"]
    end

    UI -->|Mutations / Optimistic UI| RQ
    RQ -->|HTTP / JSON| ElysiaBackend
    Client -->|Page Navigation| MW
    MW -->|Authorized| RSC
    RSC -->|Drizzle ORM Query| Postgres

    ElysiaBackend -->|Session Verification| SupabaseAuth
    ElysiaBackend -->|Drizzle ORM Queries| Postgres

    Postgres -->|postgres_changes broadcast| Realtime
    Realtime -->|WebSocket Events| UI
    UI -->|Trigger Bell Chime| Audio
    Cron -->|Daily Scheduled Purge| Postgres
```

---

## Tech Stack Overview

| Category | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Framework** | [Next.js](https://nextjs.org/) | `16.3.2` | App Router, Server Components, SSR, API routing |
| **UI Library** | [React](https://react.dev/) | `19.2.8` | Component rendering & modern hooks |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) | `4.x` | Modern utility-first styling with `@tailwindcss/postcss` |
| **API Framework** | [ElysiaJS](https://elysiajs.com/) | `1.4.29` | High-performance TypeBox-powered API mounted inside Next.js |
| **Database & ORM** | [Drizzle ORM](https://orm.drizzle.team/) & `postgres.js` | `0.45.2` | Type-safe SQL migrations and relational schema |
| **Backend / Auth** | [Supabase](https://supabase.com/) | `@supabase/ssr ^0.12.5` | Managed PostgreSQL, Google OAuth, Realtime WebSockets, Avatars storage |
| **Client State** | [TanStack React Query](https://tanstack.com/query) | `^5.102.3` | In-memory caching, optimistic updates, query invalidation |
| **Visualizations** | [Recharts](https://recharts.org/) | `^3.10.1` | Interactive weekly line charts and radial completion metrics |
| **Icons & Media** | [Lucide React](https://lucide.react) & `react-easy-crop` | `^1.34.0` | UI icon set and profile photo crop engine |
| **Push Engine** | [web-push](https://github.com/web-push-libs/web-push) | `^3.6.7` | VAPID (RFC 8292) native device push delivery |
| **Toasts** | [Sonner](https://sonner.emilkowal.ski/) | `^2.0.8` | Non-blocking in-app notifications and action prompts |
| **Theming** | [next-themes](https://github.com/pacocoursey/next-themes) | `^0.4.6` | Flawless Dark / Light / System theme switching |

---

## Database Schema & Data Model

The PostgreSQL schema is defined using Drizzle ORM in `lib/db/schema.ts`:

```
users (id matches Supabase Auth UUID)
├── id: uuid (PK)
├── name: varchar(25)
├── avatar_url: text (nullable)
├── email: text (unique)
├── current_streak: integer (default 0)
├── best_streak: integer (default 0)
├── success_threshold: integer (default 75)
├── team_id: uuid (FK -> teams.id, ON DELETE SET NULL, nullable)
└── created_at: timestamp

categories
├── id: uuid (PK)
├── user_id: uuid (FK -> users.id, ON DELETE CASCADE)
├── name: varchar(25)
├── is_active: boolean (default true - soft toggle for presets)
└── UNIQUE(name, user_id)

habits
├── id: uuid (PK)
├── user_id: uuid (FK -> users.id, ON DELETE CASCADE)
├── category_id: uuid (FK -> categories.id, ON DELETE SET NULL, nullable)
├── title: varchar(60)
├── date: date (target date YYYY-MM-DD)
├── deadline_time: text (e.g. "22:00", nullable)
├── habit_type: varchar(15) ('boolean' | 'numeric')
├── target_value: integer (nullable)
├── current_value: integer (default 0)
├── unit: varchar(20) (e.g. "pages", "reps", "ml")
├── scheduled_days: text (JSON array e.g. '["MON","WED","FRI"]')
├── is_active: boolean (default true = pending, false = completed)
└── created_at: timestamp

habit_logs (Historical Ledger)
├── id: uuid (PK)
├── habit_id: uuid (FK -> habits.id, ON DELETE CASCADE)
├── completed_date: date
├── logged_value: integer (nullable)
├── status: boolean (default true)
└── UNIQUE(habit_id, completed_date)

teams (Accountability Pods)
├── id: uuid (PK)
├── name: varchar(25)
├── created_by: uuid (FK -> users.id, ON DELETE CASCADE)
├── abandoned_at: timestamp (set when 0 members remain)
└── created_at: timestamp

team_members (Junction Table - Up to 10 Pods per User)
├── id: uuid (PK)
├── team_id: uuid (FK -> teams.id, ON DELETE CASCADE)
├── user_id: uuid (FK -> users.id, ON DELETE CASCADE)
├── role: varchar(20) ('leader' | 'member')
├── joined_at: timestamp
└── UNIQUE(team_id, user_id)

notifications (Teammate Nudges)
├── id: uuid (PK)
├── sender_id: uuid (FK -> users.id, ON DELETE SET NULL)
├── receiver_id: uuid (FK -> users.id, ON DELETE CASCADE)
├── message: text
├── is_read: boolean (default false)
└── created_at: timestamp

team_events (Live Social Feed)
├── id: uuid (PK)
├── team_id: uuid (FK -> teams.id, ON DELETE CASCADE)
├── event_type: text ('COMPLETION' | 'NUDGE' | 'JOIN' | 'LEAVE' | 'KICK')
├── actor_id: uuid (FK -> users.id, ON DELETE CASCADE)
├── target_id: uuid (FK -> users.id, ON DELETE CASCADE, nullable)
├── message: text
└── created_at: timestamp

push_subscriptions (W3C Web Push Endpoints)
├── id: uuid (PK)
├── user_id: uuid (FK -> users.id, ON DELETE CASCADE)
├── endpoint: text
├── p256dh: text (client public key)
├── auth: text (client auth secret)
├── created_at: timestamp
└── UNIQUE(user_id, endpoint)
```

### Database Performance Indexes
To ensure sub-millisecond query execution under concurrent loads, Drizzle defines the following composite and single-column indexes:
- **`habits`**: `habits_user_date_idx (userId, date)`, `habits_user_active_idx (userId, isActive)`, `habits_user_id_idx (userId)`
- **`habit_logs`**: `habit_logs_habit_date_idx (habitId, completedDate)`
- **`teams`**: `teams_created_by_idx (createdBy)`
- **`team_members`**: `team_members_team_id_idx (teamId)`, `team_members_user_id_idx (userId)`, `team_members_team_user_uq (teamId, userId)`
- **`notifications`**: `notifications_receiver_read_idx (receiverId, isRead)`, `notifications_receiver_idx (receiverId)`
- **`team_events`**: `team_events_team_created_idx (teamId, createdAt)`, `team_events_team_id_idx (teamId)`, `team_events_created_at_idx (createdAt)`
- **`push_subscriptions`**: `push_subscriptions_user_id_idx (userId)`


---

## Core Features & Domain Logic

### Habit Tracking Modes

Habits support two distinct operational modes:
1. **Simple Boolean Checkmark**: 1-click completion toggle (`is_active = false`).
2. **Target Counter (Numeric)**: Incremental stepper (`+` / `-`) for quantitative goals (e.g., *Read 25 pages*, *Drink 2500 ml*).
   - Updates UI instantly via **Optimistic Updates** with smooth debounce synchronization (300ms) sending exact target `{ value: N }` to prevent concurrent read-modify-write race conditions.
   - Directly synchronizes React Query cache on server response to avoid disruptive full-list refetches.
   - When `current_value >= target_value`, the habit automatically marks as completed and writes to `habit_logs`.
   - Supports overachievement indicators (`+N OVER`).

### Repeating / Recurring Habit Engine

- **Automated Blueprint Spawning**: Habits configured with `scheduled_days` (e.g., `["MON", "TUE", "WED", "THU", "FRI"]`) serve as recurring blueprints.
- When `GET /api/v1/habits` is called with the user's localized `x-client-date`, the system evaluates if today's day of the week matches the schedule.
- If scheduled and no instance exists for today, a fresh pending habit (`current_value = 0`, `is_active = true`) is automatically generated for today.
- **Stop Repeating Control**: Users can click **Stop Repeating** on any recurring habit item to set `scheduled_days = null` across that habit series (`PATCH /api/v1/habits/:id/stop-repeating`), stopping future generations while preserving all past completed history intact.

### Anti-Cheat & 48-Hour Grace Period

To ensure data integrity and discourage retroactively falsifying streaks:
- Users can create and complete habits for **Today**, **Tomorrow**, or **Yesterday** (a 48-hour grace window).
- Any attempt to create or log a habit older than `Yesterday` is rejected with `HTTP 400 Bad Request`.
- On the UI, habits past their deadline but within the 48-hour window receive an amber `Grace (Xh left)` badge. Once the grace window elapses, incomplete habits turn red with a strike-through `Missed` status.

### Dynamic Streak Engine

Streaks are **never statically incremented**; they are dynamically computed from verified completion records in `habit_logs`, strictly anchored to the user's localized device date (`clientDate`):
1. Historical dates from `habit_logs` are deduplicated and sorted chronologically: `[YYYY-MM-DD, ...]`.
2. Safe date normalization guarantees PostgreSQL UTC midnight date stamps deserialize without 1-day shifts across negative timezones.
3. Consecutive day intervals are calculated using DST-immune `Date.UTC` timestamps.
4. **48-Hour Liveness Grace**: If the most recent completion is **`clientToday`**, the active streak increments. If the last log is **`clientYesterday`**, the streak remains alive until midnight. If no tasks were completed yesterday or today, the dynamic streak drops to `0`.
5. **Historical Benchmark Preservation**: `bestStreak` retains historical personal records (e.g. 13) and automatically upgrades in the database whenever `currentStreak` surpasses the record.

### Accountability Pods & Teammate Nudges

- **Pod Limit**: Strict cap of **5 members per pod** to foster tight-knit accountability.
- **Invite Code Security**: Pod invite codes (UUID) feature click-to-reveal obfuscation and 1-click clipboard copying.
- **Teammate Nudges**: Members can inspect pending tasks for today across teammates and send a nudge.
  - **Rate Limiting Guard**: In-memory sliding window restricts nudges to **5 nudges per 60 seconds** per user (`HTTP 429 Too Many Requests`).
  - **Team Scoping Verification**: Server confirms sender and receiver share the same `team_id`.
  - **Realtime Broadcast**: Automatically writes an event to `team_events` and inserts an unread alert into `notifications`.
- **Leadership Hierarchy**: Pod creators hold leader privileges (ability to remove/kick members). If the leader leaves, leadership automatically transfers to the next longest-standing member. If all members leave, the team is stamped with `abandoned_at` for automated cleanup.

### Analytics & Visualizations

1. **Daily Progress Ring**: SVG circular stroke dash offset showing percentage completion for today's habits.
2. **Next Up Widget**: Computes the upcoming pending habit based on the client's current time and habit deadline.
3. **12-Week Activity Heatmap**: GitHub-style green density grid (84 days), dynamically colored according to the user's custom `success_threshold` (default: 75%).
4. **Weekly Progress Line Chart**: Recharts-powered 7-day spline chart with padded X-axis ticks (preventing label cutoff), tap focus suppression, and responsive tooltips containing miniature donut completion graphs.
5. **Interactive Monthly Calendar**: Day-by-day cell navigation with daily completion metrics, best/lowest day statistics, and standardized **Category Progress** rates (`completed/total (percent%)`) that prevent unit mixing errors.

### Audio Engine (Synthesized Chime)

Teammate nudges trigger an acoustic cue without requiring external MP3/WAV assets. The app implements a custom two-tone synthesizer using the Web Audio API:
- Note 1: E5 ($659.25\text{ Hz}$) with exponential decay over $0.35\text{s}$.
- Note 2: A5 ($880.00\text{ Hz}$) triggered at $+100\text{ms}$ with exponential decay over $0.55\text{s}$.
- Can be muted or unmuted in **Settings** (persisted in `localStorage`).

### PWA & Web Push Notifications

- **Online-First Architecture**: Because habit logs, streaks, and accountability feeds depend on real-time database validation and strict anti-cheat verification, Raymarkable is designed strictly as an **online-first** system. It does not provide offline habit syncing.
- **Web App Manifest**: Configured in `app/manifest.ts` with standalone display mode, maskable high-res icons, and deep-link app shortcuts (`Habits`, `Teams`, `Progress`).
- **Service Worker (`public/sw.js`)**:
  - Pre-caches core app shell, fonts, and icons on installation for instant asset loading.
  - **Cache-First** strategy for static Next.js assets (`/_next/static`, images, icons).
  - **Network-Only** for all dynamic page navigation (`/dashboard/*`), API endpoints (`/api/*`), and authentication routes (`/auth/*`), ensuring real-time data accuracy.
  - Development guard automatically bypasses caching on `localhost` to avoid hydration collisions.
- **Native Web Push Notifications**:
  - Implements standard W3C Web Push using VAPID (RFC 8292).
  - Devices register endpoints via the `useDeviceNotifications` client hook.
  - Server automatically dispatches pushes and prunes invalid/expired subscriptions (`HTTP 404 / 410`).

---

## API Reference (Elysia REST Endpoints)

All endpoints are mounted under prefix `/api/v1` via Next.js catch-all route handler `app/api/[[...slug]]/route.ts`. Requests inherit the Supabase session via cookie validation and accept optional `x-client-date` headers.

### User Endpoints
- `GET /api/v1/me`: Returns user profile, dynamic streak, today-scoped habit counts (`activeHabits`, `completedHabits`, `totalHabits`), and latest activity.
- `PATCH /api/v1/me`: Updates profile fields (`name`, `avatarUrl`, `successThreshold`).
- `DELETE /api/v1/me`: Permanently deletes user account, cascades deletion across all tables, and handles pod succession/cleanup.

### Habit Endpoints
- `GET /api/v1/habits`: Fetches all user habits with category names and active status. Automatically auto-spawns scheduled recurring habits if today matches their repeat schedule.
- `POST /api/v1/habits`: Creates a new habit (validates 48h grace window, auto-creates/reactivates category).
- `PUT /api/v1/habits/:id`: Updates habit title, date, deadline, scheduled days, or targets.
- `PATCH /api/v1/habits/:id/progress`: Increments/decrements numeric habit progress or sets exact value, updates `habit_logs`, and broadcasts social celebration if completed.
- `PATCH /api/v1/habits/:id/toggle`: 1-click toggle for boolean habits.
- `PATCH /api/v1/habits/:id/stop-repeating`: Removes recurrence (`scheduledDays = null`) from this habit and all instances of the same series.
- `DELETE /api/v1/habits/:id`: Permanently deletes a habit and cascades historical logs.

### Category Endpoints
- `GET /api/v1/categories`: Lists active category presets for the user.
- `DELETE /api/v1/categories/:id`: Soft-hides a category preset from dropdown suggestions (`isActive = false`) while preserving historical records.

### Team & Accountability Endpoints (Multi-Team Architecture)
- `GET /api/v1/teams`: Returns list of all accountability pods the caller belongs to (with IDs, names, member counts, member avatar snippets, and leader flags).
- `GET /api/v1/teams/:teamId`: Returns pod details, 5-member roster with today's pending tasks & live streaks, and the 50 most recent activity feed events for a specific pod.
- `POST /api/v1/teams`: Creates a new pod and designates caller as leader (enforces max 10 pods per user).
- `POST /api/v1/teams/join`: Joins a pod via UUID invite code (enforces max 10 pods per user and max 5 members per pod).
- `POST /api/v1/teams/:teamId/leave`: Leaves specific pod, handles leader transfer or abandonment timestamp.
- `POST /api/v1/teams/:teamId/remove-member`: Leader-only kick action for a specific pod.
- `POST /api/v1/teams/:teamId/nudge`: Sends accountability nudge to a teammate in a specific pod (rate-limited to 5/min, broadcasts to `team_events` and `notifications`).

### Push Notification Endpoints
- `POST /api/v1/push/subscribe`: Registers or updates a browser's Web Push subscription with public key and auth secret.
- `POST /api/v1/push/unsubscribe`: Removes a push subscription by its endpoint.
- `POST /api/v1/push/test`: Sends a test push notification to all active devices registered to the calling user.

### Notification Endpoints
- `GET /api/v1/notifications`: Lists unread notifications for current user.
- `POST /api/v1/notifications/:id/read`: Marks a notification as dismissed/read.

### Maintenance & Cron
- `GET /api/cron/cleanup-teams`: Strictly protected by `Authorization: Bearer <CRON_SECRET>`. Permanently purges teams abandoned for $\ge 3$ days. (Fails immediately with 401 if secret is unset or mismatched).

---

## Frontend State & Query Management

TanStack Query (`@tanstack/react-query`) handles asynchronous server state with the following configuration:
- **Global Stale Time**: $60\text{ seconds}$ (`refetchOnWindowFocus: false`) to avoid redundant API polling.
- **Centralized Query Keys**: Managed via `lib/api/query-keys.ts` (`HABITS_QUERY_KEY`, `USER_QUERY_KEY`, `TEAM_QUERY_KEY`, `NOTIFICATIONS_QUERY_KEY`).
- **Optimistic Mutations**: Stepping numeric habits immediately updates query cache key `["habits"]`. If network request errors, cache rolls back to previous snapshot.
- **Real-Time Invalidation**: Supabase Realtime listens to `postgres_changes` on `notifications` and `team_events`, automatically triggering `qc.invalidateQueries({ queryKey: ["team", "me"] })` and `qc.invalidateQueries({ queryKey: ["notifications"] })`.

---

## Authentication & Security Flow

1. **OAuth Initiation**: Client calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
2. **Exchange Callback (`app/auth/callback/route.ts`)**: 
   - Server exchanges code for session cookies.
   - **Open Redirect Guard**: Validates `next` parameter (`startsWith('/') && !startsWith('//')`).
   - **Sanitization**: Caps `user_metadata.full_name` to 25 characters to prevent database overflow.
   - Executes an idempotent upsert into the public `users` table.
3. **Session Middleware (`middleware.ts`)**: 
   - **CSRF Origin Check**: Validates `Origin` matches `Host` on mutating API requests (`POST`, `PUT`, `PATCH`, `DELETE`).
   - **Route Protection**: Redirects unauthenticated users trying to access `/dashboard/*` to `/`, and authenticated users visiting `/` to `/dashboard`.
   - Refreshes auth cookies on every request.
4. **HTTP Security Headers (`next.config.ts`)**:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY`
   - `Referrer-Policy: strict-origin-when-cross-origin`
5. **Scoped Elysia Auth Plugin (`lib/api/auth.ts`)**: Derives `{ user }` in Elysia endpoints via `createClient()` from `@/lib/supabase/server`.

---

## Project Structure

```
raymarkable/
├── app/
│   ├── api/
│   │   ├── [[...slug]]/route.ts      # Catch-all mounting Elysia API to Next.js
│   │   └── cron/cleanup-teams/       # Abandoned teams purge endpoint
│   ├── auth/callback/route.ts        # Supabase OAuth token exchange & user sync
│   ├── dashboard/
│   │   ├── habits/page.tsx           # Habit list, filtering tabs, creation FAB
│   │   ├── profile/
│   │   │   ├── [id]/page.tsx         # Teammate public profile view
│   │   │   └── page.tsx              # Authenticated user personal profile
│   │   ├── settings/page.tsx         # Account preferences, threshold, PWA install
│   │   ├── teams/page.tsx            # Pod hub, onboarding view, roster, live feed
│   │   ├── layout.tsx                # Dashboard shell with Sidebar & NotificationsListener
│   │   └── page.tsx                  # Main overview: Profile Card, Next Up, Ring, Inbox
│   ├── globals.css                   # Tailwind CSS v4 directives
│   ├── layout.tsx                    # Root HTML, Raleway font, PWA metadata & viewport
│   ├── manifest.ts                   # Web App Manifest generator
│   ├── page.tsx                      # Landing page with Google OAuth & quote banner
│   └── providers.tsx                 # ThemeProvider, QueryClientProvider, PwaProvider
├── components/
│   ├── habits/
│   │   ├── habit-item.tsx            # Stepper / toggle item with 48h grace badge
│   │   └── habit-modal.tsx           # Create / Edit modal with time/day picker
│   ├── profile/
│   │   ├── edit-profile-modal.tsx    # Crop avatar with react-easy-crop & upload
│   │   ├── heatmap.tsx               # 12-week GitHub-style activity grid
│   │   ├── monthly-section.tsx       # Interactive monthly calendar & statistics
│   │   ├── profile-card.tsx          # Dashboard overview card with streak flame
│   │   ├── profile-header.tsx        # Profile banner & user info
│   │   ├── stat-card.tsx             # Metric card
│   │   └── weekly-chart.tsx          # Recharts 7-day progress spline with custom donut
│   ├── pwa/
│   │   └── pwa-provider.tsx          # Standalone mode detection & install prompt hook
│   ├── settings/
│   │   └── settings-form.tsx         # Threshold slider, theme switch, chime mute, account wipe
│   ├── teams/
│   │   ├── no-team-view.tsx          # Pod onboarding (create or join via code)
│   │   ├── team-activity-feed.tsx    # Real-time event log with auto-scroll
│   │   ├── team-code-widget.tsx      # Obfuscated invite code with copy action
│   │   └── team-roster.tsx           # Member list with streaks, today's tasks & nudges
│   ├── ui/
│   │   └── confirm-modal.tsx         # Reusable confirmation dialog (danger/primary)
│   ├── notifications-listener.tsx    # Realtime listener & Web Audio chime trigger
│   └── sidebar.tsx                   # Collapsible desktop/mobile navigation
├── lib/
│   ├── api/
│   │   ├── auth.ts                   # Scoped Elysia plugin for Supabase Auth
│   │   ├── habits.ts                 # Frontend HTTP client for habit & profile endpoints
│   │   ├── push.ts                   # Frontend HTTP client for Web Push endpoints
│   │   ├── query-keys.ts             # Centralized TanStack Query key factories
│   │   ├── teams.ts                  # Frontend HTTP client for pod & nudge endpoints
│   │   └── routes/                   # Elysia sub-routers (user, habits, teams, push, etc.)
│   ├── db/
│   │   ├── index.ts                  # Drizzle ORM instance with postgres.js
│   │   └── schema.ts                 # Relational PostgreSQL table schemas & indexes
│   ├── hooks/
│   │   ├── use-click-outside.ts      # Click outside dismiss hook for modals & popovers
│   │   ├── use-device-notifications.ts # W3C Web Push registration & device sync hook
│   │   ├── use-grouped-habits.ts     # Date grouping, grace logic, and tab filtering
│   │   ├── use-habits.ts             # React Query hooks for habits & profile
│   │   └── use-teams.ts              # React Query hooks for pods & notifications
│   ├── services/
│   │   └── streak.ts                 # Dynamic streak calculation engine
│   ├── supabase/
│   │   ├── client.ts                 # Browser client (createBrowserClient)
│   │   ├── middleware.ts             # Edge session refresh & route guard logic
│   │   └── server.ts                 # Server client with async cookies()
│   ├── types/
│   │   ├── habit.ts                  # Habit domain interfaces
│   │   ├── notification.ts           # In-app notification interfaces
│   │   └── team.ts                   # Pod & member roster interfaces
│   ├── utils/
│   │   └── formatters.ts             # Time & date normalization utilities
│   ├── constants.ts                  # System constants (grace period, pod limits, storage keys)
│   └── push.ts                       # Server-side Web Push dispatcher (web-push)
├── public/
│   ├── icons/                        # PWA icons (180x180, 192x192, 512x512, maskable)
│   ├── icon.svg                      # Scalable vector logo
│   └── sw.js                         # Custom Service Worker cache implementation
├── drizzle.config.ts                 # Drizzle Kit migration & connection config
├── vercel.json                       # Daily cron schedule configuration
└── package.json                      # Project dependencies and run scripts
```

---

## Environment Variables & Setup Guide

### 1. Prerequisites
- Node.js 20+ installed
- PostgreSQL instance (or Supabase project)

### 2. Environment Configuration
Create a `.env` file in the root directory:

```env
# Supabase Connection Pooler (Transaction Mode, port 6543 for serverless/Vercel)
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres"

# Supabase Public API Keys
NEXT_PUBLIC_SUPABASE_URL="https://[REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"

# Native Web Push Notifications (VAPID Keys)
NEXT_PUBLIC_VAPID_PUBLIC_KEY="[YOUR_VAPID_PUBLIC_KEY]"
VAPID_PRIVATE_KEY="[YOUR_VAPID_PRIVATE_KEY]"
VAPID_SUBJECT="mailto:paulmedina645@gmail.com"

# Strictly Required: Secret Token for Maintenance Cron (/api/cron/cleanup-teams)
CRON_SECRET="your-secure-cron-token"
```

### 3. Supabase Setup
1. **Google OAuth**: Under *Authentication > Providers*, enable Google and configure Client ID and Secret. Set Redirect URI to `https://<YOUR_DOMAIN>/auth/callback`.
2. **Storage**: Under *Storage*, create a public bucket named `avatars` with public read access.
3. **Realtime**: Ensure Realtime is enabled for tables `notifications` and `team_events`.

### 4. Database Migrations
Push the Drizzle schema directly to your database:

```bash
npx drizzle-kit push
```

### 5. Running the Application

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

---

## Automated Cron & Maintenance

The repository includes a maintenance cron configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup-teams",
      "schedule": "0 0 * * *"
    }
  ]
}
```

- **Execution**: Runs daily at midnight UTC (`0 0 * * *`).
- **Functionality**: Checks the `teams` table for any pods where `abandoned_at <= NOW() - INTERVAL '3 days'` and permanently removes them, keeping the database free of orphaned team records.
