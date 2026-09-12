import { useState, useEffect, useMemo } from "react";
import type { Habit, Category } from "@/lib/types/habit";
import { formatLocalDate } from "@/lib/utils/formatters";
import { GRACE_PERIOD_HOURS } from "@/lib/constants";

/*
USE GROUPED HABITS HOOK

Encapsulates all domain logic for habits page filtering:
1. Keeps track of live time (updates every minute).
2. Calculates 24-hour grace periods for missed habits.
3. Filters habits by tab (Today, All, Archive, or Category).
4. Groups habits chronologically by date descending.
5. Formats date headers ("Today", "Yesterday (Grace Period)", etc.).
*/

const EMPTY_HABITS: Habit[] = [];
const EMPTY_CATEGORIES: Category[] = [];

export interface HabitDateGroup {
  date: string;
  habits: Habit[];
}

export function useGroupedHabits(
  habits: Habit[] = EMPTY_HABITS,
  categories: Category[] = EMPTY_CATEGORIES,
  activeTab: string
) {
  const [now, setNow] = useState(() => new Date());

  // Update clock every minute for accurate grace period tracking
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => formatLocalDate(now), [now]);

  const yesterdayStr = useMemo(() => {
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    return formatLocalDate(yest);
  }, [now]);

  // Dynamic tabs: standard views + user categories
  const tabs = useMemo(() => {
    const baseTabs = ["Today", "All", "Archive"];
    const categoryTabs = categories.map((c) => c.name);
    return [...baseTabs, ...categoryTabs];
  }, [categories]);

  // Derive effective active tab during render instead of cascading useEffect setState
  const effectiveTab = tabs.includes(activeTab) ? activeTab : "Today";

  // Group and filter habits
  const groupedHabits: HabitDateGroup[] = useMemo(() => {
    const nowMs = now.getTime();

    // A habit is missed if past deadline + GRACE_PERIOD_HOURS without completion
    const isMissed = (h: Habit) => {
      if (h.completed) return false;
      const [year, month, day] = h.date.split("-").map(Number);
      const [hh, mm] = h.deadlineTime ? h.deadlineTime.split(":").map(Number) : [23, 59];
      const scheduledMs = new Date(year, month - 1, day, hh, mm, 59).getTime();
      const graceEndMs = scheduledMs + GRACE_PERIOD_HOURS * 60 * 60 * 1000;
      return nowMs > graceEndMs;
    };

    let filtered = habits;

    if (effectiveTab === "Archive") {
      // Historical completed habits (past dates) AND expired habits (>24h grace)
      filtered = habits.filter(
        (h) => (h.completed && h.date < todayStr) || isMissed(h)
      );
    } else if (effectiveTab === "Today") {
      // Today's habits (all) + yesterday's pending habits still in grace window
      filtered = habits.filter(
        (h) =>
          h.date === todayStr ||
          (h.date === yesterdayStr && !h.completed && !isMissed(h))
      );
    } else if (effectiveTab === "All") {
      // All active pending habits + today's habits
      filtered = habits.filter(
        (h) => (!h.completed && !isMissed(h)) || h.date === todayStr
      );
    } else {
      // Category tab: active habits + today's habits matching the category name
      filtered = habits.filter(
        (h) =>
          h.category === effectiveTab &&
          ((!h.completed && !isMissed(h)) || h.date === todayStr)
      );
    }

    // Group habits by YYYY-MM-DD
    const groups: Record<string, Habit[]> = {};
    for (const h of filtered) {
      if (!groups[h.date]) groups[h.date] = [];
      groups[h.date].push(h);
    }

    // Sort dates descending (newest first)
    const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

    return sortedDates.map((date) => ({
      date,
      habits: groups[date],
    }));
  }, [habits, effectiveTab, todayStr, yesterdayStr, now]);

  // Human-friendly date header helper
  const formatDateHeader = (dateStr: string) => {
    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday (Grace Period)";

    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return {
    groupedHabits,
    tabs,
    todayStr,
    yesterdayStr,
    formatDateHeader,
    activeTab: effectiveTab,
  };
}
