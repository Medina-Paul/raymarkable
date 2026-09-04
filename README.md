# Raymarkable

> **"Build better habits. Produce remarkable results."**

Raymarkable is a full-stack, mobile-first, offline-ready habit tracking Progressive Web Application (PWA) inspired by James Clear's *Atomic Habits*. It pairs individual habit formation with tight-knit accountability pods (max 5 members), real-time social feeds, anti-cheat streak dynamics, and rich analytics.

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-blue?style=flat&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat&logo=tailwindcss)](https://tailwindcss.com/)
[![ElysiaJS](https://img.shields.io/badge/ElysiaJS-1.4-purple?style=flat)](https://elysiajs.com/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-0.45-green?style=flat)](https://orm.drizzle.team/)
[![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-emerald?style=flat&logo=supabase)](https://supabase.com/)

---

## 📖 Complete Documentation

For comprehensive engineering details, database ER diagrams, API specifications, and architectural deep-dives, see:

👉 **[DOCUMENTATION.md](./DOCUMENTATION.md)**

---

## ✨ Key Features

- **Dual Tracking Modes**:
  - **Simple Checkmark**: 1-click completion for boolean habits.
  - **Target Counter (Numeric)**: Step increment stepper (`+` / `-`) for quantitative habits (pages read, water drank, reps completed) with optimistic UI.
- **Anti-Cheat & 48-Hour Grace Window**: Strict anti-cheat logic prevents retroactively logging missed habits into the deep past while providing a 48-hour grace period for yesterday's habits.
- **Dynamic Streak Calculation**: Streaks are computed on-the-fly from immutable completion logs (`habit_logs`), ensuring zero streak drift or desync.
- **Accountability Pods (Max 5 Members)**:
  - Join or create small accountability teams via secret invite codes.
  - Inspect teammates' active habits for today.
  - Send non-blocking social **Nudges** with real-time WebSockets and synthesized Web Audio bell chimes.
  - Live team activity feed showing completions, nudges, joins, and leaves.
- **Visual Progress & Analytics**:
  - Daily completion ring.
  - 12-week GitHub-style activity heatmap colored by custom goal thresholds (e.g. 75%).
  - 7-day weekly progress spline line chart with circular percentage donut tooltips.
  - Interactive monthly calendar with daily metrics breakdown and category volumes.
- **PWA & Offline Readiness**:
  - Service Worker cache (`sw.js`) with Cache-First asset handling and Network-First navigation fallback.
  - Full-screen standalone app installation on iOS, Android, macOS, and Windows.
- **User Customization**:
  - Dark, Light, and System theme support with zero flash of unstyled content (FOUC).
  - Profile image cropping and upload powered by `react-easy-crop` and Supabase Storage.
  - Configurable daily success thresholds (10%–100%).
  - Audio chime mute/unmute toggle.
  - 1-click permanent account deletion with complete relational data cascading.

---

## 🛠️ Tech Stack

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide Icons](https://lucide.dev/), [Recharts](https://recharts.org/)
- **State & Data Fetching**: [TanStack React Query v5](https://tanstack.com/query) with optimistic mutations and [Sonner](https://sonner.emilkowal.ski/) toasts
- **API Engine**: [ElysiaJS](https://elysiajs.com/) mounted via Next.js catch-all route handler (`/api/v1/*`)
- **Database & ORM**: PostgreSQL via [Drizzle ORM](https://orm.drizzle.team/) and `postgres.js`
- **Auth & Realtime**: [Supabase](https://supabase.com/) (Google OAuth, PostgreSQL, Realtime WebSockets, Storage)
- **Audio**: Native Web Audio API two-tone synthesizer ($659.25\text{ Hz}$ / $880.00\text{ Hz}$)
- **Automation**: Vercel Cron for automated 3-day abandoned team cleanup

---

## 🚀 Getting Started

### 1. Clone the repository and install dependencies

```bash
git clone https://github.com/your-username/raymarkable.git
cd raymarkable
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```env
# Supabase Transaction Pooler URL
DATABASE_URL="postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres"

# Supabase Public Keys
NEXT_PUBLIC_SUPABASE_URL="https://[REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"

# Optional: Protected secret for Cron Endpoint
CRON_SECRET="your-secure-cron-token"
```

### 3. Push Database Schema

Push the Drizzle schema to your PostgreSQL database:

```bash
npx drizzle-kit push
```

### 4. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Progressive Web App (PWA) Installation

- **Desktop (Chrome / Edge)**: Click the **Install** icon in the browser address bar or go to **Settings > Install App**.
- **iOS / iPadOS (Safari)**: Tap the **Share** button, scroll down, and select **Add to Home Screen**.
- **Android**: Tap the browser menu and select **Install App** or tap the in-app install prompt.

---

## 📜 License

Private repository. All rights reserved.
