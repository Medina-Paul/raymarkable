"use client";

import Link from "next/link";
import { Users, Crown, ChevronRight } from "lucide-react";
import type { TeamSummary } from "@/lib/types/team";

interface TeamCardProps {
  team: TeamSummary;
}

export function TeamCard({ team }: TeamCardProps) {
  const visibleMembers = team.members.slice(0, 4);
  const remainingCount = team.memberCount - visibleMembers.length;

  return (
    <Link
      href={`/dashboard/teams/${team.id}`}
      className="group relative flex flex-col justify-between p-6 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-black dark:hover:border-white transition-all duration-200"
    >
      {/* Top Section */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate group-hover:text-black dark:group-hover:text-white">
            {team.name}
          </h2>
          {team.isLeader && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400 shrink-0">
              <Crown className="w-3 h-3" /> Leader
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
          <Users className="w-3.5 h-3.5" />
          <span>
            {team.memberCount} / 5 {team.memberCount === 1 ? "Member" : "Members"}
          </span>
        </div>
      </div>

      {/* Bottom Section: Avatar Stack & Action Arrow */}
      <div className="mt-6 pt-4 border-t border-gray-100 dark:border-zinc-800/80 flex items-center justify-between">
        {/* Member Avatars Stack */}
        <div className="flex items-center -space-x-2 overflow-hidden">
          {visibleMembers.map((member) => (
            <div
              key={member.id}
              className="inline-block h-7 w-7 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-200 dark:bg-zinc-700 overflow-hidden shrink-0"
              title={member.name}
            >
              {member.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.avatarUrl}
                  alt={member.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-gray-700 dark:text-zinc-300">
                  {member.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
          ))}
          {remainingCount > 0 && (
            <div className="inline-flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-100 dark:bg-zinc-800 text-[10px] font-bold text-gray-500 dark:text-zinc-400 shrink-0">
              +{remainingCount}
            </div>
          )}
        </div>

        {/* Enter Pod Link */}
        <div className="flex items-center gap-1 text-xs font-semibold text-gray-900 dark:text-white transition-transform">
          <span>Open Hub</span>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors" />
        </div>
      </div>
    </Link>
  );
}
