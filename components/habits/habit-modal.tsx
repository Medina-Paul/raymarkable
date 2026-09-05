"use client";

import { useState, useMemo } from "react";
import { X, Minus, Hash, CheckSquare } from "lucide-react";
import type { Habit, CreateHabitInput, HabitType } from "@/lib/types/habit";
import type { Category } from "@/lib/api/habits";
import { useCategories, useDeleteCategory } from "@/lib/hooks/use-habits";
import { ConfirmModal } from "@/components/ui/confirm-modal";

const DAYS_OF_WEEK = [
  { key: "MON", label: "M" },
  { key: "TUE", label: "T" },
  { key: "WED", label: "W" },
  { key: "THU", label: "T" },
  { key: "FRI", label: "F" },
  { key: "SAT", label: "S" },
  { key: "SUN", label: "S" },
];

const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let i = 0; i < 24; i++) {
  for (let j = 0; j < 60; j += 30) {
    const hh = i.toString().padStart(2, '0');
    const mm = j.toString().padStart(2, '0');
    const ampm = i >= 12 ? 'PM' : 'AM';
    const h12 = i % 12 || 12;
    TIME_OPTIONS.push({ value: `${hh}:${mm}`, label: `${h12}:${mm} ${ampm}` });
  }
}

type Props = {
  /** When editing, pass the habit to pre-fill the form. Null = create mode. */
  habit: Habit | null;
  isPending: boolean;
  onClose: () => void;
  onCreate: (input: CreateHabitInput) => void;
  onUpdate: (habit: Habit) => void;
};

export function HabitModal({ habit, isPending, onClose, onCreate, onUpdate }: Props) {
  const isEditing = habit !== null;

  const [title, setTitle] = useState(habit?.title || "");
  const [category, setCategory] = useState(habit?.category || "");
  const [showCategories, setShowCategories] = useState(false);
  const [date, setDate] = useState(() => {
    if (habit?.date) return habit.date;
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [deadlineTime, setDeadlineTime] = useState(habit?.deadlineTime || "");
  const [habitType, setHabitType] = useState<HabitType>(habit?.habitType || "boolean");
  const [targetValue, setTargetValue] = useState<string>(habit?.targetValue ? String(habit.targetValue) : "");
  const [unit, setUnit] = useState<string>(habit?.unit || "");
  const [scheduledDays, setScheduledDays] = useState<string[]>(habit?.scheduledDays || []);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const { data: categories = [] } = useCategories();
  const deleteCategoryMutation = useDeleteCategory();

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const yesterdayStr = useMemo(() => {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const availableTimeOptions = useMemo(() => {
    if (date !== todayStr) return TIME_OPTIONS;
    
    const now = new Date();
    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    return TIME_OPTIONS.filter(t => t.value >= currentHHMM);
  }, [date, todayStr]);

  function toggleDay(dayKey: string) {
    setScheduledDays(prev => 
      prev.includes(dayKey) ? prev.filter(d => d !== dayKey) : [...prev, dayKey]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedCategory = category.trim();
    if (!trimmedTitle || !trimmedCategory) return;

    const parsedTarget = habitType === "numeric" ? (parseInt(targetValue, 10) || 1) : null;
    const trimmedUnit = habitType === "numeric" ? (unit.trim() || "reps") : null;

    const payload: CreateHabitInput = { 
      title: trimmedTitle, 
      category: trimmedCategory, 
      date,
      deadlineTime: deadlineTime || null,
      habitType,
      targetValue: parsedTarget,
      unit: trimmedUnit,
      scheduledDays: scheduledDays.length > 0 ? scheduledDays : null,
    };

    if (isEditing && habit) {
      onUpdate({ ...habit, ...payload, currentValue: habit.currentValue || 0 });
    } else {
      onCreate(payload);
    }
  }

  return (
    <div 
      onMouseDown={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-white dark:bg-zinc-900 overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-gray-200 dark:border-zinc-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-black dark:text-white">
            {isEditing ? "Edit Habit" : "New Habit"}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto scrollbar-hide">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-black dark:text-white mb-1.5">Title</label>
            <input
              autoFocus
              required
              type="text"
              maxLength={60}
              placeholder="What do you want to accomplish?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
          </div>

          {/* Category ComboBox */}
          <div className="relative">
            <label className="block text-sm font-semibold text-black dark:text-white mb-1.5">Habit Category</label>
            <input
              required
              type="text"
              maxLength={25}
              placeholder="e.g. Health, Work, Study, Faith"
              value={category}
              onFocus={() => setShowCategories(true)}
              onChange={(e) => {
                setCategory(e.target.value);
                setShowCategories(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowCategories(false), 150);
              }}
              className="w-full px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
            
            {showCategories && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 max-h-48 overflow-y-auto shadow-lg">
                {categories
                  .filter(c => c.name.toLowerCase().includes(category.toLowerCase()))
                  .map(c => (
                    <div 
                      key={c.id} 
                      className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800 group"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCategory(c.name);
                        setShowCategories(false);
                      }}
                    >
                      <span className="text-sm text-gray-700 dark:text-zinc-200">{c.name}</span>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingCategory(c);
                        }}
                        className="text-black dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1"
                        title="Remove from suggestions"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    </div>
                ))}
                
                {category.trim() && !categories.some(c => c.name.toLowerCase() === category.trim().toLowerCase()) && (
                  <div 
                    className="px-3 py-2 cursor-pointer bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 text-sm font-medium text-black dark:text-white border-t border-gray-100 dark:border-zinc-800"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setShowCategories(false);
                    }}
                  >
                    Create &quot;{category.trim()}&quot;
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tracking Mode Selection */}
          <div>
            <label className="block text-sm font-semibold text-black dark:text-white mb-1.5">Tracking Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setHabitType("boolean")}
                className={`py-2 px-3 flex items-center justify-center gap-2 text-xs font-semibold border transition-all cursor-pointer ${
                  habitType === "boolean"
                    ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white"
                    : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700"
                }`}
              >
                <CheckSquare className="w-4 h-4" />
                Simple Checkmark
              </button>
              <button
                type="button"
                onClick={() => setHabitType("numeric")}
                className={`py-2 px-3 flex items-center justify-center gap-2 text-xs font-semibold border transition-all cursor-pointer ${
                  habitType === "numeric"
                    ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white"
                    : "bg-white dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-700"
                }`}
              >
                <Hash className="w-4 h-4" />
                Target Counter
              </button>
            </div>
          </div>

          {/* Numeric Target Fields (if Numeric Mode) */}
          {habitType === "numeric" && (
            <div className="p-3 bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-700 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Target Amount</label>
                  <input
                    required
                    type="number"
                    min={1}
                    max={99999}
                    placeholder="e.g. 50"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm text-black dark:text-white bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 dark:text-zinc-300 mb-1">Unit</label>
                  <input
                    required
                    type="text"
                    maxLength={20}
                    placeholder="e.g. reps, chapters, km"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm text-black dark:text-white bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-black dark:text-white mb-1.5">
                Date <span className="text-gray-400 dark:text-zinc-500 font-normal text-xs">(48h Grace)</span>
              </label>
              <input
                required
                type="date"
                value={date}
                min={yesterdayStr}
                className="w-full px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white [color-scheme:light] dark:[color-scheme:dark]"
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setDate(nextDate);
                  if (nextDate === todayStr && deadlineTime) {
                    const now = new Date();
                    const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    if (deadlineTime < currentHHMM) {
                      setDeadlineTime("");
                    }
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-black dark:text-white mb-1.5">
                Time <span className="text-gray-400 dark:text-zinc-500 font-normal">(Optional)</span>
              </label>
              <select
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full px-3 py-2 text-sm text-black dark:text-white bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
              >
                <option value="">No deadline</option>
                {availableTimeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
                {deadlineTime && !availableTimeOptions.some(t => t.value === deadlineTime) && (
                  <option value={deadlineTime}>{deadlineTime}</option>
                )}
              </select>
            </div>
          </div>

          {/* Repeat Schedule Days */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-semibold text-black dark:text-white">Scheduled Days</label>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {scheduledDays.length === 0 ? "Daily / One-time" : `${scheduledDays.length} days/wk`}
              </span>
            </div>
            <div className="flex justify-between gap-1">
              {DAYS_OF_WEEK.map(({ key, label }) => {
                const isSelected = scheduledDays.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleDay(key)}
                    className={`flex-1 py-1.5 text-xs font-bold border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white"
                        : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-semibold text-black dark:text-white border border-gray-300 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors focus:outline-none cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 text-sm font-semibold text-white dark:text-black bg-black dark:bg-white border border-black dark:border-white hover:bg-gray-800 dark:hover:bg-zinc-200 disabled:opacity-60 cursor-pointer transition-colors focus:outline-none"
            >
              {isPending ? "Saving…" : isEditing ? "Save Changes" : "Create"}
            </button>
          </div>
        </form>
      </div>

      {/* Remove Category Suggestion Modal */}
      <ConfirmModal
        isOpen={deletingCategory !== null}
        onClose={() => setDeletingCategory(null)}
        onConfirm={async () => {
          if (deletingCategory) {
            await deleteCategoryMutation.mutateAsync(deletingCategory.id);
            setDeletingCategory(null);
          }
        }}
        title="Remove Category Suggestion"
        description={`Remove "${deletingCategory?.name}" from your suggestion list? Any existing or archived habits with this category will not be affected.`}
        confirmText="Remove"
        isLoading={deleteCategoryMutation.isPending}
      />
    </div>
  );
}

