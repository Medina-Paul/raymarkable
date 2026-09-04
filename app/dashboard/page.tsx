"use client";

import { useMemo, useState, useEffect } from "react";
import { useHabits } from "@/lib/hooks/use-habits";
import { useNotifications, useReadNotification } from "@/lib/hooks/use-teams";
import { CheckCircle2, Clock, Inbox, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ProfileCard } from "@/components/profile/profile-card";

export default function DashboardPage() {
  const { data: habits = [], isLoading: habitsLoading } = useHabits();
  const { data: notifications = [], isLoading: notifsLoading } = useNotifications();
  const readMutation = useReadNotification();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = useMemo(() => { const y = now.getFullYear(); const m = String(now.getMonth() + 1).padStart(2, "0"); const d = String(now.getDate()).padStart(2, "0"); return `${y}-${m}-${d}`; }, [now]);
  const currentTime = useMemo(() => now.toTimeString().slice(0, 5), [now]);

  // Compute Daily Ring
  const todayHabits = useMemo(() => habits.filter((h) => h.date === todayStr), [habits, todayStr]);
  const completedToday = todayHabits.filter((h) => h.completed).length;
  const totalToday = todayHabits.length;
  const progressPercentage = totalToday === 0 ? 0 : Math.round((completedToday / totalToday) * 100);

  // Compute "Next Up"
  const nextUp = useMemo(() => {
    const pending = todayHabits.filter(h => !h.completed);
    if (pending.length === 0) return null;
    
    // Grab future scheduled ones
    const futureScheduled = pending.filter(h => h.deadlineTime && h.deadlineTime >= currentTime);
    futureScheduled.sort((a, b) => (a.deadlineTime! > b.deadlineTime! ? 1 : -1));
    
    if (futureScheduled.length > 0) return futureScheduled[0];
    
    // Otherwise, just return the first unscheduled/missed one
    return pending[0];
  }, [todayHabits, currentTime]);
  
  function formatTime(time: string) {
    const [h, m] = time.split(':');
    const hh = parseInt(h, 10);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  }

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto">

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left: Profile Card */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <ProfileCard />
          {/* Inbox / Nudges */}
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 border border-gray-200 dark:border-zinc-800 flex flex-col">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 mb-4">
              <Inbox className="w-5 h-5" />
              <h2 className="font-semibold text-sm tracking-wide uppercase">Inbox</h2>
              {notifications.length > 0 && (
                <span className="ml-auto bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-bold px-2 py-0.5 rounded-full">
                  {notifications.length}
                </span>
              )}
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 -mx-2 px-2 scrollbar-hide max-h-64">
              {notifsLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="bg-gray-100 dark:bg-zinc-800 h-16"></div>
                  <div className="bg-gray-100 dark:bg-zinc-800 h-16"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-zinc-500 py-6">
                  <CheckCircle2 className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-sm">You're all caught up!</p>
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className="bg-zinc-50/50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 p-3 flex justify-between items-start gap-3">
                    <p className="text-sm text-gray-800 dark:text-zinc-200 leading-snug">{n.message}</p>
                    <button 
                      onClick={() => readMutation.mutate(n.id)}
                      className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-950/40 px-2 py-1 transition-colors shrink-0 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 flex flex-col gap-6 mt-10">

          {/* Next Up Widget */}
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 border border-gray-200 dark:border-zinc-800 flex flex-col">
            <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 mb-4">
              <Clock className="w-5 h-5" />
              <h2 className="font-semibold text-sm tracking-wide uppercase">Up Next</h2>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              {habitsLoading ? (
                <div className="animate-pulse bg-gray-200 dark:bg-zinc-800 h-8 w-3/4"></div>
              ) : nextUp ? (
                <>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
                    {nextUp.title}
                  </p>
                  <p className="text-gray-500 dark:text-zinc-400 mt-2 font-medium">
                    {nextUp.deadlineTime ? `Due at ${formatTime(nextUp.deadlineTime)}` : "Scheduled for today"}
                    {nextUp.habitType === "numeric" && nextUp.targetValue && (
                      <span className="text-zinc-800 dark:text-zinc-200 ml-2 font-semibold font-mono text-sm">
                        • {nextUp.currentValue}/{nextUp.targetValue} {nextUp.unit || "units"}
                      </span>
                    )}
                  </p>
                </>
              ) : (
                <p className="text-gray-400 dark:text-zinc-500 italic">No scheduled habits remaining today.</p>
              )}
            </div>
            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800">
              <Link href="/dashboard/habits" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1 group">
                Go to Habits <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>

          {/* Daily Progress Ring */}
          <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 border border-gray-200 dark:border-zinc-800 flex flex-col items-center text-center">
            <h2 className="font-semibold text-sm tracking-wide uppercase text-gray-400 dark:text-zinc-500 w-full text-left mb-6">Today's Progress</h2>
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="64" cy="64" r="56" className="stroke-gray-100 dark:stroke-zinc-800" strokeWidth="12" fill="none" />
                <circle 
                  cx="64" cy="64" r="56" 
                  className="stroke-green-700 dark:stroke-green-600 transition-all duration-1000 ease-out" 
                  strokeWidth="12" 
                  fill="none" 
                  strokeDasharray="351.8" /* 2 * pi * 56 */
                  strokeDashoffset={351.8 - (351.8 * progressPercentage) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-black dark:text-white">{progressPercentage}%</span>
              </div>
            </div>
            <p className="mt-4 text-gray-500 dark:text-zinc-400 font-medium">{completedToday} of {totalToday} habits completed</p>
          </div>
        </div>
      </div>
    </div>
  );
}
