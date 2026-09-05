/**
 * SINGLE SOURCE OF TRUTH (SSOT) FOR STREAK CALCULATIONS
 * 
 * Handles consecutive active days calculation from completion date ledgers.
 * Supports the 48-hour grace period (streaks stay alive if logged Today or Yesterday).
 */

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
}

/**
 * Normalizes any date value (string, Date, timestamp) into standard "YYYY-MM-DD"
 */
export function normalizeDate(date: string | Date | unknown): string {
  if (typeof date === "string") return date.split("T")[0];
  if (date instanceof Date) return date.toISOString().split("T")[0];
  return String(date || "");
}

/**
 * Calculates current consecutive streak and maximum historical streak
 * from an array of completion dates.
 */
export function calculateStreaks(completedDates: (string | Date)[]): StreakResult {
  if (!completedDates || completedDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  // Deduplicate dates into unique sorted strings (YYYY-MM-DD)
  const logDates = Array.from(
    new Set(completedDates.map(normalizeDate).filter(Boolean))
  ).sort();

  if (logDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0 };
  }

  let tempStreak = 0;
  let maxHistoricalStreak = 0;
  let prevDate: Date | null = null;

  // Traverse historical logs in chronological order to compute consecutive active days
  for (let i = 0; i < logDates.length; i++) {
    const [year, month, day] = logDates[i].split("-").map(Number);
    const currDate = new Date(year, month - 1, day);

    if (!prevDate) {
      tempStreak = 1;
    } else {
      const diffTime = currDate.getTime() - prevDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 3600 * 24));

      if (diffDays === 1) {
        tempStreak++;
      } else if (diffDays > 1) {
        tempStreak = 1; // Gap detected: streak resets
      }
    }

    if (tempStreak > maxHistoricalStreak) {
      maxHistoricalStreak = tempStreak;
    }
    prevDate = currDate;
  }

  // Check 48-hour grace window (today or yesterday)
  const now = new Date();
  const todayStr = normalizeDate(now);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = normalizeDate(yesterday);

  const lastLogDate = logDates[logDates.length - 1];
  const isStreakAlive = lastLogDate === todayStr || lastLogDate === yesterdayStr;
  const currentStreak = isStreakAlive ? tempStreak : 0;

  return {
    currentStreak,
    bestStreak: maxHistoricalStreak,
  };
}
