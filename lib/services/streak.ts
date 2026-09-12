/**
 * SINGLE SOURCE OF TRUTH (SSOT) FOR STREAK CALCULATIONS
 * 
 * Handles consecutive active days calculation from completion date ledgers.
 * Supports the 24-hour grace period (streaks stay alive if logged Today or Yesterday).
 */

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
}

/**
 * Normalizes any date value (string, Date, timestamp) into standard "YYYY-MM-DD"
 * Preserves the exact stored calendar date regardless of server/host timezone.
 */
export function normalizeDate(date: string | Date | unknown): string {
  if (typeof date === "string") return date.split("T")[0];
  if (date instanceof Date) {
    return date.toISOString().split("T")[0];
  }
  return String(date || "");
}

/**
 * Calculates current consecutive streak and maximum historical streak
 * from an array of completion dates, anchored to the user's localized reference date.
 */
export function calculateStreaks(
  completedDates: (string | Date)[],
  clientDate?: string
): StreakResult {
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
  let prevDateMs: number | null = null;

  // Traverse historical logs in chronological order to compute consecutive active days
  for (let i = 0; i < logDates.length; i++) {
    const [year, month, day] = logDates[i].split("-").map(Number);
    const currDateMs = Date.UTC(year, month - 1, day);

    if (prevDateMs === null) {
      tempStreak = 1;
    } else {
      const diffTime = currDateMs - prevDateMs;
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
    prevDateMs = currDateMs;
  }

  // Determine effective today & yesterday based on user's device date
  const effectiveToday = clientDate && clientDate.length >= 10
    ? clientDate.split("T")[0]
    : normalizeDate(new Date());

  const [y, m, d] = effectiveToday.split("-").map(Number);
  const yesterdayObj = new Date(Date.UTC(y, m - 1, d - 1));
  const effectiveYesterday = yesterdayObj.toISOString().split("T")[0];

  const lastLogDate = logDates[logDates.length - 1];
  const isStreakAlive = lastLogDate === effectiveToday || lastLogDate === effectiveYesterday;
  const currentStreak = isStreakAlive ? tempStreak : 0;

  return {
    currentStreak,
    bestStreak: maxHistoricalStreak,
  };
}

