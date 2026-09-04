"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type SafeHabit = {
  date: string;
  isActive: boolean;
  category: string;
  title: string;
  currentValue?: number | null;
  targetValue?: number | null;
  unit?: string | null;
};

type CalendarData = {
  [dateStr: string]: {
    completed: number;
    total: number;
  };
};

interface MonthlySectionProps {
  safeHabits: SafeHabit[];
  calendarData: CalendarData;
  initialMonth: number;
  initialYear: number;
  successThreshold: number;
}

export function MonthlySection({
  safeHabits,
  calendarData,
  initialMonth,
  initialYear,
  successThreshold,
}: MonthlySectionProps) {
  const [displayMonth, setDisplayMonth] = useState(initialMonth);
  const [displayYear, setDisplayYear] = useState(initialYear);
  const [selectedDate, setSelectedDate] = useState<number>(new Date().getDate());

  const daysInMonth = new Date(displayYear, displayMonth + 1, 0).getDate();
  const firstDay = new Date(displayYear, displayMonth, 1).getDay(); // 0 = Sun
  const monthName = new Date(displayYear, displayMonth, 1).toLocaleDateString("en-US", { month: "long" });

  const handlePrevMonth = () => {
    if (displayMonth === 0) {
      setDisplayMonth(11);
      setDisplayYear(displayYear - 1);
    } else {
      setDisplayMonth(displayMonth - 1);
    }
    setSelectedDate(1);
  };

  const handleNextMonth = () => {
    if (displayMonth === 11) {
      setDisplayMonth(0);
      setDisplayYear(displayYear + 1);
    } else {
      setDisplayMonth(displayMonth + 1);
    }
    setSelectedDate(1);
  };

  // Format a day number to "YYYY-MM-DD" for lookup
  const getDateStr = (day: number) => {
    const d = new Date(displayYear, displayMonth, day);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  };

  // Get today's local date string for comparison
  const todayStr = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().split("T")[0];
  }, []);

  const selectedDateStr = getDateStr(selectedDate);
  const isFuture = selectedDateStr > todayStr;
  const selectedData = calendarData[selectedDateStr] || { completed: 0, total: 0 };
  const percentage = selectedData.total > 0 ? Math.round((selectedData.completed / selectedData.total) * 100) : 0;

  // --- COMPUTE MONTHLY REPORT FOR DISPLAYED MONTH ---
  const mm = String(displayMonth + 1).padStart(2, "0");
  const monthPrefix = `${displayYear}-${mm}`;

  const monthHabits = useMemo(() => {
    return safeHabits.filter((h) => h.date.startsWith(monthPrefix));
  }, [safeHabits, monthPrefix]);

  const monthTotal = monthHabits.length;
  const monthCompleted = monthHabits.filter((h) => !h.isActive).length;
  const monthOverall = monthTotal > 0 ? Math.round((monthCompleted / monthTotal) * 100) : 0;

  const { bestDay, lowestDay } = useMemo(() => {
    let best = 0;
    let lowest = 100;
    const monthDates = Object.keys(calendarData).filter((d) => d.startsWith(monthPrefix));
    
    if (monthDates.length === 0) {
      return { bestDay: 0, lowestDay: 0 };
    }

    let hasData = false;
    monthDates.forEach((d) => {
      const { completed, total } = calendarData[d];
      if (total > 0) {
        hasData = true;
        const pct = Math.round((completed / total) * 100);
        if (pct > best) best = pct;
        if (pct < lowest) lowest = pct;
      }
    });

    return {
      bestDay: best,
      lowestDay: hasData ? lowest : 0,
    };
  }, [calendarData, monthPrefix]);

  // --- HABIT PROGRESS (GROUPED BY CATEGORY WITH VOLUME) ---
  const habitProgress = useMemo(() => {
    const stats: Record<string, { completed: number; total: number; volume: number; unit?: string }> = {};

    monthHabits.forEach((h) => {
      const category = h.category || "Uncategorized";
      if (!stats[category]) {
        stats[category] = { completed: 0, total: 0, volume: 0, unit: h.unit || undefined };
      }
      stats[category].total += 1;
      if (!h.isActive) {
        stats[category].completed += 1;
        stats[category].volume += h.currentValue || h.targetValue || 1;
      }
    });

    return Object.entries(stats)
      .map(([name, stat]) => {
        const pct = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;
        return {
          name,
          completed: stat.completed,
          total: stat.total,
          volume: stat.volume,
          unit: stat.unit,
          percent: pct,
        };
      })
      .sort((a, b) => {
        if (b.percent !== a.percent) return b.percent - a.percent;
        return b.total - a.total;
      })
      .slice(0, 5);
  }, [monthHabits]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Interactive Calendar */}
      <div className="lg:col-span-1 bg-white dark:bg-zinc-900 p-4 sm:p-6 border border-gray-200 dark:border-zinc-800 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-black dark:text-white">{monthName} {displayYear}</h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={handlePrevMonth} 
              aria-label="Previous Month"
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={handleNextMonth} 
              aria-label="Next Month"
              className="p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-500 dark:text-zinc-400 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-400 dark:text-zinc-500 mb-2">
          <div>S</div><div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div>
        </div>
        
        <div className="grid grid-cols-7 gap-1 flex-1">
          {/* Empty offset days */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          
          {/* Days of the month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isSelected = selectedDate === day;
            const dateStr = getDateStr(day);
            const dayData = calendarData[dateStr];
            const isDayFuture = dateStr > todayStr;
            
            let completionRatio = 0;
            if (dayData && dayData.total > 0) {
              completionRatio = dayData.completed / dayData.total;
            }

            let style = "text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800";
            let bgStyle = "";
            
            if (isDayFuture) {
              style = "text-gray-300 dark:text-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 border border-transparent border-dashed hover:border-gray-200 dark:hover:border-zinc-700";
            } else if (dayData && dayData.total > 0) {
              const pct = completionRatio * 100;
              if (pct === 100) {
                bgStyle = "bg-green-800 dark:bg-green-600 text-white font-bold";
              } else if (pct >= 66) {
                bgStyle = "bg-green-600 dark:bg-green-500 text-white font-bold";
              } else if (pct >= 33) {
                bgStyle = "bg-green-400 dark:bg-green-400 text-white font-bold";
              } else if (pct > 0) {
                bgStyle = "bg-green-200 dark:bg-green-300 text-green-900 font-bold";
              } else {
                bgStyle = "bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-zinc-500 font-bold";
              }
              style = bgStyle;
            }

            if (isSelected) {
              if (bgStyle) {
                style = `${bgStyle} scale-110 z-10`;
              } else {
                style = "bg-black dark:bg-white text-white dark:text-black font-bold transform scale-110 z-10";
              }
            }

            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(day)}
                className={`cursor-pointer aspect-square flex items-center justify-center text-xs transition-transform ${style}`}
              >
                {day}
              </button>
            );
          })}
        </div>
        
        {/* Dynamic Daily Report Panel */}
        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 p-4 sm:p-6">
          <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium mb-1">
            {monthName} {selectedDate}, {displayYear}
          </p>
          
          {isFuture ? (
            <>
              <div className="flex items-end gap-3 mb-2">
                <p className="text-3xl font-bold text-gray-300 dark:text-zinc-600">--%</p>
                <p className="text-sm font-medium text-gray-400 dark:text-zinc-500 mb-1 leading-none">Upcoming</p>
              </div>
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 mt-2 bg-white dark:bg-zinc-800 inline-block px-2 py-1 border border-gray-200 dark:border-zinc-700">
                {selectedData.total} habits scheduled
              </p>
            </>
          ) : (
            <>
              <div className="flex items-end gap-3">
                <p className="text-3xl font-bold text-black dark:text-white">{percentage}%</p>
                <p className="text-sm font-medium text-gray-400 dark:text-zinc-500 mb-1 leading-none">Accomplished</p>
              </div>
              <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 mt-2 bg-white dark:bg-zinc-800 inline-block px-2 py-1 border border-gray-200 dark:border-zinc-700">
                {selectedData.completed} of {selectedData.total} habits completed
              </p>
            </>
          )}
        </div>
      </div>

      {/* Monthly Report & Categories (Synchronized with Display Month) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white dark:bg-zinc-900 p-6 border border-gray-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-black dark:text-white uppercase tracking-wide">
              Monthly Report ({monthName} {displayYear})
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-1">Overall</p>
              <p className="text-lg font-bold text-black dark:text-white">{monthOverall}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-1">Habits Done</p>
              <p className="text-lg font-bold text-black dark:text-white">{monthCompleted}/{monthTotal}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-1">Best Day</p>
              <p className="text-lg font-bold text-black dark:text-white">{bestDay}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-1">Lowest Day</p>
              <p className="text-lg font-bold text-black dark:text-white">{lowestDay}%</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 border border-gray-200 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-black dark:text-white uppercase tracking-wide">
              Habit Progress ({monthName} {displayYear})
            </h3>
          </div>
          <div className="space-y-1">
            {habitProgress.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-zinc-500 py-4 text-center">No habits recorded for {monthName} {displayYear}.</p>
            )}
            {habitProgress.map((habit) => {
              return (
                <div key={habit.name} className="relative w-full h-8 bg-zinc-800 flex items-center overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-green-700 transition-all duration-500 ease-out" 
                    style={{ width: `${Math.min(100, habit.percent)}%` }}
                  />
                  <div className="relative z-10 w-full flex justify-between items-center px-3">
                    <span className="text-sm font-semibold text-white truncate pr-4">
                      {habit.name}
                    </span>
                    <span className="text-xs font-medium text-zinc-300 shrink-0 font-mono">
                      {habit.unit && habit.volume > 0 ? (
                        <span>{habit.volume.toLocaleString()} {habit.unit} • {habit.completed}/{habit.total} ({habit.percent}%)</span>
                      ) : (
                        <span>{habit.completed}/{habit.total} ({habit.percent}%)</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
