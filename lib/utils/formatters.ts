/**
 * SHARED FORMATTER UTILITIES
 */

/**
 * Formats a 24-hour time string ("HH:mm") into a 12-hour string with AM/PM (e.g. "8:30 PM").
 */
export function formatTime(timeStr?: string | null): string {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const formattedHour = h % 12 || 12;
  return `${formattedHour}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Formats a Date object or date-like value into local "YYYY-MM-DD".
 */
export function formatLocalDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
