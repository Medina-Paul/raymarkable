"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, ChevronDown } from "lucide-react";
import type { Habit } from "@/lib/types/habit";
import {
  useHabits,
  useCreateHabit,
  useUpdateHabit,
  useToggleHabit,
  useDeleteHabit,
  useCategories,
} from "@/lib/hooks/use-habits";
import { useGroupedHabits } from "@/lib/hooks/use-grouped-habits";
import { HabitItem } from "@/components/habits/habit-item";
import { HabitModal } from "@/components/habits/habit-modal";
import { ConfirmModal } from "@/components/ui/confirm-modal";

/*
HABITS PAGE
Displays user habits filtered by tab (Today, All, Archive, or Category).
Provides controls to create, edit, toggle, and delete habits.
*/

export default function HabitsPage() {
  const [activeTab, setActiveTab] = useState<string>("Today");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);
  const [confirmingHabit, setConfirmingHabit] = useState<Habit | null>(null);
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Queries & Mutations
  const { data: habits = [], isLoading } = useHabits();
  const { data: categories = [] } = useCategories();

  const createMutation = useCreateHabit(() => setModalOpen(false));
  const updateMutation = useUpdateHabit(() => setEditingHabit(null));
  const toggleMutation = useToggleHabit();
  const deleteMutation = useDeleteHabit();

  // Business logic hook: date math, grace window, and grouping
  const { groupedHabits, tabs, formatDateHeader } = useGroupedHabits(
    habits,
    categories,
    activeTab,
    setActiveTab
  );

  // Close mobile dropdown when clicking outside
  useEffect(() => {
    function close(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMobileDropdownOpen(false);
      }
    }
    if (isMobileDropdownOpen) document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [isMobileDropdownOpen]);

  return (
    <div className="max-w-4xl lg:max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 md:py-8 min-h-full">
      {/* Tabs Navigation */}
      <div className="mb-8">
        {/* Mobile Dropdown */}
        <div className="md:hidden relative" ref={dropdownRef}>
          <button
            onClick={() => setIsMobileDropdownOpen(!isMobileDropdownOpen)}
            className="w-full flex items-center justify-between p-3 border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-black dark:text-white text-sm font-semibold focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white outline-none transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            <span>{activeTab}</span>
            <ChevronDown
              className={`w-4 h-4 text-gray-500 dark:text-zinc-400 transition-transform duration-200 ${
                isMobileDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {isMobileDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 z-30 py-1 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setIsMobileDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    activeTab === tab
                      ? "bg-gray-50 dark:bg-zinc-800 font-bold text-black dark:text-white"
                      : "text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white font-medium"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Tabs */}
        <div className="hidden md:flex gap-6 border-b border-gray-200 dark:border-zinc-800 overflow-x-auto overflow-y-hidden scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap ${
                activeTab === tab
                  ? "border-black dark:border-white text-black dark:text-white"
                  : "border-transparent text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Habits List */}
      <div className="pb-24">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-14 bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : groupedHabits.length === 0 ? (
          <p className="text-center text-gray-400 dark:text-zinc-500 py-16 text-sm">
            No habits found for {activeTab.toLowerCase()}.
          </p>
        ) : (
          <div className="space-y-8">
            {groupedHabits.map((group) => (
              <div key={group.date}>
                {/* Date Group Header */}
                <h3 className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-3 px-1">
                  {formatDateHeader(group.date)}
                </h3>

                {/* Habit Items Container */}
                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
                  {group.habits.map((habit) => (
                    <HabitItem
                      key={habit.id}
                      habit={habit}
                      onToggle={() => setConfirmingHabit(habit)}
                      onEdit={() => setEditingHabit(habit)}
                      onDelete={() => setDeletingHabit(habit)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setModalOpen(true)}
        aria-label="Create new habit"
        className="fixed bottom-8 right-8 w-14 h-14 bg-black text-white dark:bg-white dark:text-black rounded-full flex items-center justify-center hover:bg-gray-800 dark:hover:bg-zinc-200 hover:scale-105 active:scale-95 transition-all z-10 focus:outline-none cursor-pointer"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Create Modal */}
      {modalOpen && (
        <HabitModal
          habit={null}
          isPending={createMutation.isPending}
          onClose={() => setModalOpen(false)}
          onCreate={(input) => createMutation.mutate(input)}
          onUpdate={() => {}}
        />
      )}

      {/* Edit Modal */}
      {editingHabit && (
        <HabitModal
          key={editingHabit.id}
          habit={editingHabit}
          isPending={updateMutation.isPending}
          onClose={() => setEditingHabit(null)}
          onCreate={() => {}}
          onUpdate={(updated) => updateMutation.mutate(updated)}
        />
      )}

      {/* Complete Habit Modal */}
      <ConfirmModal
        isOpen={confirmingHabit !== null}
        onClose={() => setConfirmingHabit(null)}
        onConfirm={async () => {
          if (confirmingHabit) {
            await toggleMutation.mutateAsync(confirmingHabit.id);
            setConfirmingHabit(null);
          }
        }}
        title="Complete Habit"
        description={`Are you sure you want to mark "${confirmingHabit?.title}" as completed?`}
        isLoading={toggleMutation.isPending}
        variant="primary"
      />

      {/* Delete Habit Modal */}
      <ConfirmModal
        isOpen={deletingHabit !== null}
        onClose={() => setDeletingHabit(null)}
        onConfirm={async () => {
          if (deletingHabit) {
            await deleteMutation.mutateAsync(deletingHabit.id);
            setDeletingHabit(null);
          }
        }}
        title="Delete Habit"
        description={`Are you sure you want to delete "${deletingHabit?.title}"? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
