"use client";

import { useMemo } from "react";

interface HeatmapProps {
  data: Record<string, { completed: number; total: number }>;
  successThreshold: number;
}

export function Heatmap({ data, successThreshold }: HeatmapProps) {
  // Generate last 12 weeks of data (84 days)
  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const result = [];
    
    // Start from 12 weeks ago, Sunday
    const start = new Date(today);
    start.setDate(start.getDate() - (12 * 7) - start.getDay());
    
    while (start <= today) {
      const y = start.getFullYear();
      const m = String(start.getMonth() + 1).padStart(2, "0");
      const d = String(start.getDate()).padStart(2, "0");
      const dateStr = `${y}-${m}-${d}`;
      
      const stats = data[dateStr];
      let percent = 0;
      if (stats && stats.total > 0) {
        percent = Math.round((stats.completed / stats.total) * 100);
      }
      
      result.push({
        date: dateStr,
        percent,
        hasData: !!stats && stats.total > 0
      });
      
      start.setDate(start.getDate() + 1);
    }
    
    return result;
  }, [data]);

  // Group into columns (weeks)
  const columns = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  const getColor = (percent: number, hasData: boolean) => {
    if (!hasData || percent === 0) return "bg-gray-100 dark:bg-zinc-800";
    if (percent === 100) return "bg-green-800 dark:bg-green-600";
    if (percent >= 66) return "bg-green-600 dark:bg-green-500";
    if (percent >= 33) return "bg-green-400 dark:bg-green-400";
    return "bg-green-200 dark:bg-green-300";
  };

  return (
    <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 border border-gray-200 dark:border-zinc-800 flex flex-col">
      <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6">Activity Heatmap</h3>
      <div className="flex-1 flex items-center justify-center overflow-x-auto">
        <div className="flex gap-1.5 min-w-max pb-2">
          {columns.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-1.5">
              {week.map((day, dayIdx) => (
                <div
                  key={day.date}
                  className={`w-4 h-4 ${getColor(day.percent, day.hasData)}`}
                  title={`${day.date}: ${day.hasData ? day.percent + "% completed" : "No habits"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2 text-xs font-medium text-gray-500 dark:text-zinc-400">
        <span>Less</span>
        <div className="w-3 h-3 bg-gray-100 dark:bg-zinc-800"></div>
        <div className="w-3 h-3 bg-green-200 dark:bg-green-300"></div>
        <div className="w-3 h-3 bg-green-400 dark:bg-green-400"></div>
        <div className="w-3 h-3 bg-green-600 dark:bg-green-500"></div>
        <div className="w-3 h-3 bg-green-800 dark:bg-green-600"></div>
        <span>More</span>
      </div>
    </div>
  );
}
