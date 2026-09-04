"use client";

import Link from "next/link";
import Image from "next/image";
import { Crown, Flame, UserMinus, BellRing } from "lucide-react";
import { toast } from "sonner";
import { useNudgeTeammate, type User } from "@/lib/hooks/use-teams";

/*
TEAM ROSTER
Displays all pod members, their current daily streaks, pending habits for today,
and controls to nudge teammates or remove members (leader only).
*/

interface TeamRosterProps {
  members: User[];
  leaderId: string;
  currentUserId: string | null;
  onRemoveMember: (member: { id: string; name: string }) => void;
}

function formatTime(timeStr: string) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":");
  const hh = parseInt(h, 10);
  const ampm = hh >= 12 ? "PM" : "AM";
  const h12 = hh % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export function TeamRoster({
  members = [],
  leaderId,
  currentUserId,
  onRemoveMember,
}: TeamRosterProps) {
  const nudgeMutation = useNudgeTeammate();
  const isLeader = leaderId === currentUserId;

  return (
    <div className="lg:col-span-2 space-y-6 flex flex-col lg:min-h-0 lg:overflow-y-auto pr-2 scrollbar-hide min-w-0">
      <h2 className="font-bold text-gray-900 dark:text-white px-1">Team Roster</h2>
      {members.map((member) => (
        <div
          key={member.id}
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-4 sm:p-5"
        >
          {/* Member Header */}
          <div className="flex items-center justify-between mb-4 gap-2">
            <Link
              href={`/dashboard/profile/${member.id}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity min-w-0 flex-1"
            >
              {/* Avatar + Leader Crown */}
              <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 flex items-center justify-center font-bold relative overflow-visible border border-gray-200 dark:border-zinc-700">
                {member.avatarUrl ? (
                  <div className="w-full h-full relative rounded-full overflow-hidden">
                    <Image
                      src={member.avatarUrl}
                      alt={member.name || "Avatar"}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                ) : (
                  member.name?.[0]?.toUpperCase() || "?"
                )}
                {leaderId === member.id && (
                  <div
                    className="absolute -top-1 -right-1 bg-yellow-400 text-black rounded-full p-0.5 z-10"
                    title="Team Leader"
                  >
                    <Crown className="w-3 h-3" />
                  </div>
                )}
              </div>

              {/* Name & Streak */}
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 dark:text-white truncate">
                  {member.name || "Anonymous"}
                </h3>
                <div className="flex flex-row items-center mt-1">
                  <Flame
                    className={
                      member.currentStreak === 0
                        ? "text-gray-400 dark:text-zinc-600"
                        : "text-orange-500"
                    }
                    size={16}
                  />
                  <p
                    className={`text-xs font-semibold ml-1 ${
                      member.currentStreak === 0
                        ? "text-gray-400 dark:text-zinc-500"
                        : "text-orange-500"
                    }`}
                  >
                    {member.currentStreak} Day Streak
                  </p>
                </div>
              </div>
            </Link>

            {/* Remove Member Button (Leader Only) */}
            {isLeader && currentUserId !== member.id && (
              <button
                onClick={() =>
                  onRemoveMember({
                    id: member.id,
                    name: member.name || "Anonymous",
                  })
                }
                className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 transition-colors cursor-pointer"
                title="Remove Member"
              >
                <UserMinus className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Member's Today Pending Habits */}
          <div className="space-y-2">
            {member.activeHabits && member.activeHabits.length > 0 ? (
              member.activeHabits.map((habit) => (
                <div
                  key={habit.id}
                  className="flex items-center justify-between bg-gray-50 dark:bg-zinc-800/60 px-3 py-2 border border-transparent dark:border-zinc-800"
                >
                  <span className="text-sm font-medium text-gray-700 dark:text-zinc-300 truncate pr-2 flex-1 min-w-0">
                    {habit.title}{" "}
                    {habit.deadlineTime && (
                      <span className="text-gray-400 dark:text-zinc-500 font-normal text-xs ml-1">
                        @{formatTime(habit.deadlineTime)}
                      </span>
                    )}
                  </span>
                  {currentUserId !== member.id && (
                    <button
                      onClick={() => {
                        nudgeMutation.mutate(
                          { targetId: member.id, taskTitle: habit.title },
                          {
                            onSuccess: () => toast.success(`Nudged ${member.name}!`),
                          }
                        );
                      }}
                      disabled={nudgeMutation.isPending}
                      className="shrink-0 p-1.5 text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-950/40 transition-colors cursor-pointer"
                      title="Nudge"
                    >
                      <BellRing className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 dark:text-zinc-500 italic px-2">
                No pending habits today.
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
