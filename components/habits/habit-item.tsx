"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { MoreVertical, Check, X, Plus, Minus, Clock } from "lucide-react";
import type { Habit } from "@/lib/types/habit";
import { useUpdateHabitProgress } from "@/lib/hooks/use-habits";

type Props = {
  habit: Habit;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

export function HabitItem({ habit, onToggle, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const updateProgress = useUpdateHabitProgress();

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  // Determine status with 48-hour grace period
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [now]);

  const [year, month, day] = habit.date.split('-').map(Number);
  const [hh, mm] = habit.deadlineTime ? habit.deadlineTime.split(':').map(Number) : [23, 59];
  const scheduledDate = new Date(year, month - 1, day, hh, mm, 59);
  
  const nowMs = now.getTime();
  const scheduledMs = scheduledDate.getTime();
  const gracePeriodEndMs = scheduledMs + 48 * 60 * 60 * 1000; // 48 Hours

  const isNumeric = habit.habitType === "numeric";
  const target = habit.targetValue || 1;
  const [localValue, setLocalValue] = useState(habit.currentValue || 0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep in sync when prop changes externally
  useEffect(() => {
    setLocalValue(habit.currentValue || 0);
  }, [habit.currentValue]);

  const current = localValue;
  const percentage = Math.round((current / target) * 100);
  const isOverachieved = current > target;
  const isAccomplished = habit.completed || (isNumeric && current >= target);

  const isPastDeadline = nowMs > scheduledMs;
  const isGracePeriod = !isAccomplished && isPastDeadline && nowMs <= gracePeriodEndMs;
  const isMissed = !isAccomplished && nowMs > gracePeriodEndMs;
  const isPending = !isAccomplished && !isMissed;

  // Calculate remaining hours in grace period
  const remainingHoursInGrace = isGracePeriod
    ? Math.max(1, Math.ceil((gracePeriodEndMs - nowMs) / (1000 * 60 * 60)))
    : 0;

  // Format date for display
  const dateObj = new Date(year, month - 1, day);
  let displayDate = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (habit.deadlineTime) {
    const h12 = hh % 12 || 12;
    const ampm = hh >= 12 ? 'PM' : 'AM';
    displayDate += ` @ ${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
  }

  let statusText = "Pending";
  let statusColor = "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400";
  if (isAccomplished) {
    statusText = "Accomplished";
    statusColor = "bg-green-100 dark:bg-green-950/60 text-green-800 dark:text-green-400";
  } else if (isGracePeriod) {
    statusText = `Grace (${remainingHoursInGrace}h left)`;
    statusColor = "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900";
  } else if (isMissed) {
    statusText = "Missed";
    statusColor = "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400";
  }

  const syncValue = (val: number) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      updateProgress.mutate({ id: habit.id, value: val });
    }, 350);
  };

  const handleStep = (delta: number) => {
    if (isMissed) return;
    const nextVal = Math.max(0, localValue + delta);
    setLocalValue(nextVal);
    syncValue(nextVal);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 px-3 sm:px-4 border-b border-gray-200 dark:border-zinc-800 last:border-0 hover:bg-gray-50/70 dark:hover:bg-zinc-800/50 transition-colors bg-white dark:bg-zinc-900 gap-2.5 sm:gap-3">
      {/* Left: options + habit title info */}
      <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
        {isPending ? (
          <div ref={ref} className="relative shrink-0 mt-0.5 sm:mt-0">
            <button
              onClick={() => setOpen(!open)}
              aria-label="Options"
              className="p-1 -ml-1 sm:ml-0 text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white focus:outline-none transition-colors cursor-pointer"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {open && (
              <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 z-20 py-1 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  onClick={() => { setOpen(false); onEdit(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-black dark:text-white hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => { setOpen(false); onDelete(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="w-5 sm:w-6 shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
            <p className={`m-0 text-sm font-semibold truncate transition-colors ${isAccomplished ? 'text-gray-900 dark:text-zinc-100' : isMissed ? 'line-through text-gray-400 dark:text-zinc-600' : 'text-black dark:text-white'}`}>
              {habit.title}
            </p>
            <span className={`px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-tight shrink-0 ${statusColor}`}>
              {statusText}
            </span>
            {isOverachieved && (
              <span className="px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold bg-green-700 text-white shrink-0">
                +{current - target} OVER
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 text-[11px] sm:text-xs text-gray-500 dark:text-zinc-400 flex-wrap">
            <span className="font-medium text-gray-700 dark:text-zinc-300">{habit.category}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-gray-400 dark:text-zinc-500 shrink-0" />
              {displayDate}
            </span>
            {habit.scheduledDays && habit.scheduledDays.length > 0 && (
              <>
                <span>•</span>
                <span className="text-gray-400 dark:text-zinc-500 font-medium text-[10px] sm:text-[11px]">
                  {habit.scheduledDays.map(d => d.charAt(0).toUpperCase() + d.slice(1).toLowerCase()).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: Metric Progress Controls or Boolean Toggle */}
      <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-6 sm:pl-0 w-full sm:w-auto">
        {isNumeric ? (
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            {/* Decrement */}
            <button
              onClick={() => handleStep(-1)}
              disabled={isMissed || (!isPending && habit.date < todayStr) || localValue <= 0}
              aria-label="Decrease by 1"
              className="w-7 h-7 shrink-0 flex items-center justify-center border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 disabled:opacity-30 transition-all text-black dark:text-white active:scale-95 cursor-pointer disabled:cursor-default"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            {/* Progress Display Bar */}
            <div className="relative flex-1 sm:flex-initial sm:min-w-[140px] h-7 bg-zinc-800 flex items-center overflow-hidden px-2 select-none min-w-0">
              <div 
                className={`absolute top-0 left-0 h-full transition-all duration-150 ${
                  isAccomplished ? 'bg-green-700' : 'bg-green-800'
                }`}
                style={{ width: `${Math.min(100, percentage)}%` }}
              />
              <div className="relative z-10 w-full flex items-center justify-between text-[11px] sm:text-xs font-semibold text-white gap-1">
                <span className="truncate pr-0.5">
                  {localValue} / {target} {habit.unit || ''}
                </span>
                <span className="text-[10px] text-zinc-300 font-mono shrink-0">
                  {percentage}%
                </span>
              </div>
            </div>

            {/* Increment */}
            <button
              onClick={() => handleStep(1)}
              disabled={isMissed || (!isPending && habit.date < todayStr)}
              aria-label="Increase by 1"
              className="w-7 h-7 shrink-0 flex items-center justify-center border border-black dark:border-white bg-black dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-zinc-200 disabled:opacity-30 transition-all active:scale-95 cursor-pointer disabled:cursor-default"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          /* Simple Boolean Checkmark Button */
          <div className="flex items-center justify-end w-full sm:w-auto">
            <button
              onClick={() => {
                if (isPending) onToggle();
              }}
              disabled={!isPending}
              aria-label={isAccomplished ? "Accomplished" : isMissed ? "Missed" : "Mark complete"}
              className={`w-6 h-6 shrink-0 flex items-center justify-center transition-all focus:outline-none ${
                isAccomplished 
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white border-2 cursor-default opacity-90' 
                  : isMissed 
                  ? 'bg-red-500 text-white border-red-500 border-2 cursor-default opacity-60' 
                  : 'border-2 border-gray-300 dark:border-zinc-700 hover:border-black dark:hover:border-white text-transparent cursor-pointer'
              }`}
            >
              {isAccomplished && <Check className="w-4 h-4 stroke-[3]" />}
              {isMissed && <X className="w-4 h-4 stroke-[3]" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
