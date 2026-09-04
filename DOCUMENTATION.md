# Raymarkable — Engineering & Architecture Documentation

> **"Build better habits. Produce remarkable results."**  
> Raymarkable is a full-stack, mobile-responsive, offline-ready habit tracking Progressive Web Application (PWA) built on modern web standards. Inspired by James Clear's *Atomic Habits*, it pairs individual habit mastery with accountability pods, real-time social feeds, dynamic streak calculation, and granular visual progress metrics.

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
   - [PWA & Offline Support](#pwa--offline-support)
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
├── team_id: uuid (FK -> teams.id, nullable)
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
├── category_id: uuid (FK -> categories.id)
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
└── status: boolean (default true)

teams (Max 5 Pods)
├── id: uuid (PK)
├── name: varchar(25)
├── created_by: uuid (FK -> users.id)
├── discord_webhook_url: text (nullable)
├── abandoned_at: timestamp (set when 0 members remain)
└── created_at: timestamp

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
```

---

## Core Features & Domain Logic

### Habit Tracking Modes

Habits support two distinct operational modes:
1. **Simple Boolean Checkmark**: 1-click completion toggle (`is_active = false`).
2. **Target Counter (Numeric)**: Incremental stepper (`+` / `-`) for quantitative goals (e.g., *Read 25 pages*, *Drink 2500 ml*).
   - Updates UI instantly via **Optimistic Updates** with debounce synchronization (350ms).
   - When `current_value >= target_value`, the habit automatically marks as completed and writes to `habit_logs`.
   - Supports overachievement indicators (`+N OVER`).

### Anti-Cheat & 48-Hour Grace Period

To ensure data integrity and discourage retroactively falsifying streaks:
- Users can create and complete habits for **Today**, **Tomorrow**, or **Yesterday** (a 48-hour grace window).
- Any attempt to create or log a habit older than `Yesterday` is rejected with `HTTP 400 Bad Request`.
- On the UI, habits past their deadline but within the 48-hour window receive an amber `Grace (Xh left)` badge. Once the grace window elapses, incomplete habits turn red with a strike-through `Missed` status.

### Dynamic Streak Engine

Streaks are **never statically incremented**; they are dynamically computed from verified completion records in `habit_logs`:
1. Historical dates from `habit_logs` are deduplicated and sorted chronologically: `[YYYY-MM-DD, ...]`.
2. A sliding difference loop calculates consecutive day chains. Any gap $> 1\text{ day}$ resets the chain.
3. **48-Hour Liveness Grace**: If the most recent completion was **Today** or **Yesterday**, the streak is considered alive. If no tasks were completed yesterday or today, the dynamic streak drops to `0`.
4. `bestStreak` is maintained as the maximum between all historical streaks and the current streak.

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
4. **Weekly Progress Line Chart**: Recharts-powered 7-day spline chart with responsive tooltips containing miniature donut completion graphs.
5. **Interactive Monthly Calendar**: Day-by-day cell navigation with habit volume, category completion rates, and best/lowest day statistics.

### Audio Engine (Synthesized Chime)

Teammate nudges trigger an acoustic cue without requiring external MP3/WAV assets. The app implements a custom two-tone synthesizer using the Web Audio API:
- Note 1: E5 ($659.25\text{ Hz}$) with exponential decay over $0.35\text{s}$.
- Note 2: A5 ($880.00\text{ Hz}$) triggered at $+100\text{ms}$ with exponential decay over $0.55\text{s}$.
- Can be muted or unmuted in **Settings** (persisted in `localStorage`).

### PWA & Offline Support

- **Web App Manifest**: Configured in `app/manifest.ts` with standalone display mode, maskable high-res icons, and deep-link app shortcuts (`Habits`, `Teams`, `Progress`).
- **Service Worker (`public/sw.js`)**:
  - Pre-caches core app shell, fonts, and icons on installation.
  - **Cache-First** strategy for static Next.js assets (`/_next/static`, images, icons).
  - **Network-First** with offline cache fallback for page navigation (`/dashboard`).
  - Always passes `/api/*`, `/auth/*`, and Supabase endpoints straight to the network.
  - Development guard automatically unregisters workers on `localhost` to avoid hydration collisions.

---

## API Reference (Elysia REST Endpoints)

All endpoints are mounted under prefix `/api/v1` via Next.js catch-all route handler `app/api/[[...slug]]/route.ts`. Requests inherit the Supabase session via cookie validation.

### User Endpoints
- `GET /api/v1/me`: Returns user profile, dynamic streak, total habits, completed count, and latest activity.
- `PATCH /api/v1/me`: Updates profile fields (`name`, `avatarUrl`, `successThreshold`).
- `DELETE /api/v1/me`: Permanently deletes user account, cascades deletion across all tables, and handles pod succession/cleanup.

### Habit Endpoints
- `GET /api/v1/habits`: Fetches all user habits with category names and active status.
- `POST /api/v1/habits`: Creates a new habit (validates 48h grace window, auto-creates/reactivates category).
- `PUT /api/v1/habits/:id`: Updates habit title, date, deadline, scheduled days, or targets.
- `PATCH /api/v1/habits/:id/progress`: Increments/decrements numeric habit progress, updates `habit_logs`, and broadcasts social celebration if completed.
- `PATCH /api/v1/habits/:id/toggle`: 1-click toggle for boolean habits.
- `DELETE /api/v1/habits/:id`: Permanently deletes a habit and cascades historical logs.

### Category Endpoints
- `GET /api/v1/categories`: Lists active category presets for the user.
- `DELETE /api/v1/categories/:id`: Soft-hides a category preset from dropdown suggestions (`isActive = false`) while preserving historical records.

### Team & Accountability Endpoints
- `GET /api/v1/teams/me`: Returns current pod details, 5-member roster with today's pending tasks & live streaks, and the 50 most recent activity feed events.
- `POST /api/v1/teams`: Creates a new pod and designates caller as leader.
- `POST /api/v1/teams/join`: Joins a pod via UUID invite code (enforces 5-member limit).
- `POST /api/v1/teams/leave`: Leaves current pod, handles leader transfer or abandonment timestamp.
- `POST /api/v1/teams/remove-member`: Leader-only kick action.
- `POST /api/v1/teams/nudge`: Sends accountability nudge (rate-limited to 5/min, broadcasts to `team_events` and `notifications`).

### Notification Endpoints
- `GET /api/v1/notifications`: Lists unread notifications for current user.
- `POST /api/v1/notifications/:id/read`: Marks a notification as dismissed/read.

### Maintenance & Cron
- `GET /api/cron/cleanup-teams`: Protected by `Authorization: Bearer <CRON_SECRET>`. Permanently purges teams abandoned for $\ge 3$ days.

---

## Frontend State & Query Management

TanStack Query (`@tanstack/react-query`) handles asynchronous server state with the following configuration:
- **Global Stale Time**: $60\text{ seconds}$ (`refetchOnWindowFocus: false`) to avoid redundant API polling.
- **Optimistic Mutations**: Stepping numeric habits immediately updates query cache key `["habits"]`. If network request errors, cache rolls back to previous snapshot.
- **Real-Time Invalidation**: Supabase Realtime listens to `postgres_changes` on `notifications` and `team_events`, automatically triggering `qc.invalidateQueries({ queryKey: ["team", "me"] })` and `qc.invalidateQueries({ queryKey: ["notifications"] })`.

---

## Authentication & Security Flow

1. **OAuth Initiation**: Client calls `supabase.auth.signInWithOAuth({ provider: 'google' })`.
2. **Exchange Callback**: Redirects to `/auth/callback?code=...`. Server exchanges code for session cookies and executes an idempotent upsert into the public `users` table.
3. **Session Middleware (`middleware.ts`)**: Runs on edge before route execution.
   - Redirects unauthenticated users trying to access `/dashboard/*` to `/`.
   - Redirects authenticated users visiting `/` straight to `/dashboard`.
   - Refreshes auth cookies on every request.
4. **Scoped Elysia Auth Plugin (`lib/api/auth.ts`)**: Derives `{ user }` in Elysia endpoints via `createClient()` from `@/lib/supabase/server`.

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
│   │   └── routes/                   # Elysia sub-routers (user, habits, teams, etc.)
│   ├── db/
│   │   ├── index.ts                  # Drizzle ORM instance with postgres.js
│   │   └── schema.ts                 # Relational PostgreSQL table schemas
│   ├── hooks/
│   │   ├── use-grouped-habits.ts     # Date grouping, grace logic, and tab filtering
│   │   ├── use-habits.ts             # React Query hooks for habits & profile
│   │   └── use-teams.ts              # React Query hooks for pods & notifications
│   ├── supabase/
│   │   ├── client.ts                 # Browser client (createBrowserClient)
│   │   ├── middleware.ts             # Edge session refresh & route guard logic
│   │   └── server.ts                 # Server client with async cookies()
│   └── types/
│       └── habit.ts                  # Shared TypeScript interfaces
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
# Supabase Transaction Pooler URL
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase Public API Keys
NEXT_PUBLIC_SUPABASE_URL="https://[REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"

# Optional: Protected secret for Cron Endpoint
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
