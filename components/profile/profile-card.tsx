import { useProfile } from "@/lib/hooks/use-habits";
import { Flame, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export function ProfileCard() {
  const { data: profile, isLoading } = useProfile();

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 mt-10 flex items-center justify-center h-[400px]">
        <div className="animate-pulse flex flex-col items-center">
          <div className="w-20 h-20 bg-gray-200 dark:bg-zinc-800 rounded-full mb-4"></div>
          <div className="h-6 w-32 bg-gray-200 dark:bg-zinc-800 mb-2"></div>
          <div className="h-4 w-48 bg-gray-200 dark:bg-zinc-800"></div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 relative mt-10">
      {/* Avatar sticking out */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2">
        <div className="w-20 h-20 rounded-full border-4 border-white dark:border-zinc-900 overflow-hidden bg-gray-100 dark:bg-zinc-800">
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white font-bold text-2xl">
              {profile.name?.charAt(0) || "U"}
            </div>
          )}
        </div>
      </div>

      <div className="pt-14 pb-6 px-4 sm:px-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{profile.name}</h2>
        
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center divide-x divide-gray-100 dark:divide-zinc-800 mb-2">
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-1">Active</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{profile.totalHabits - profile.completedHabits}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-1">Completed</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{profile.completedHabits}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 font-medium mb-1">Total</p>
            <p className="text-xl font-semibold text-gray-900 dark:text-white">{profile.totalHabits}</p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-zinc-800 px-4 sm:px-6 py-5">
        <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1">Latest Activity</p>
        {profile.latestActivity ? (
          <p className="text-sm text-gray-900 dark:text-zinc-200 font-medium">
            {profile.latestActivity.title} <span className="text-gray-500 dark:text-zinc-400 font-normal ml-1">• {profile.latestActivity.date}</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-zinc-400 italic">No completed activities yet.</p>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-zinc-800 px-6 py-5 flex items-start gap-4">
        <div className="flex flex-col items-center justify-center">
          <p className="text-xs font-semibold text-gray-900 dark:text-white mb-1 text-left w-full">Your streak</p>
          <div className="flex items-center gap-4 mt-2">
            <div className="relative flex flex-col items-center">
              <Flame className="w-10 h-10 text-orange-500 fill-orange-500" />
              <span className="absolute top-4 text-white text-xs font-bold">{profile.streak}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-zinc-300 leading-snug">
              {profile.streak > 0 
                ? `You're on a ${profile.streak} day streak! Keep crushing those habits.`
                : "Log an activity or complete a habit today to start your streak."}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 dark:border-zinc-800">
        <Link href="/dashboard/profile" className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group">
          <span className="text-sm font-semibold text-black dark:text-white group-hover:underline">Your Full Profile</span>
          <ChevronRight className="w-5 h-5 text-black dark:text-white group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
