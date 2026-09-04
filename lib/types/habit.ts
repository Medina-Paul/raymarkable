/** Shared types for the habits feature.
 *  These mirror the backend schema and will be reused by TanStack Query hooks. */

export type HabitType = "boolean" | "numeric";

export type Category = {
  id: string;
  name: string;
};

export type Habit = {
  id: string;
  title: string;
  category: string;
  date: string; // ISO date string (YYYY-MM-DD)
  deadlineTime?: string | null; // e.g. "22:00"
  habitType: HabitType;
  targetValue?: number | null;
  currentValue: number;
  unit?: string | null;
  scheduledDays?: string[] | null;
  completed: boolean;
};

export type CreateHabitInput = Pick<Habit, "title" | "category" | "date"> & {
  deadlineTime?: string | null;
  habitType?: HabitType;
  targetValue?: number | null;
  currentValue?: number;
  unit?: string | null;
  scheduledDays?: string[] | null;
};
