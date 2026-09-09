"use client";

import { useState } from "react";
import { useMyTeams } from "@/lib/hooks/use-teams";
import { Plus, UserPlus, Users, Loader2 } from "lucide-react";
import { NoTeamView } from "@/components/teams/no-team-view";
import { TeamCard } from "@/components/teams/team-card";
import { CreateTeamModal } from "@/components/teams/create-team-modal";
import { JoinTeamModal } from "@/components/teams/join-team-modal";
import { MAX_TEAMS_PER_USER } from "@/lib/constants";

/*
TEAMS OVERVIEW PAGE
Displays the user's accountability pods in a responsive grid.
Allows creating new pods or joining existing pods via invite code (up to 10 max).
*/

export default function TeamsPage() {
  const { data: teams, isLoading } = useMyTeams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isJoinOpen, setIsJoinOpen] = useState(false);

  // Loading State
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const teamList = teams || [];

  // State 1: User has no teams yet
  if (teamList.length === 0) {
    return <NoTeamView />;
  }

  const isAtLimit = teamList.length >= MAX_TEAMS_PER_USER;

  // State 2: User has 1 or more teams
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header & Controls */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
              Accountability Pods
            </h1>
            <span className="px-2.5 py-1 text-xs font-semibold bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-200 dark:border-zinc-700">
              {teamList.length} / {MAX_TEAMS_PER_USER} Pods
            </span>
          </div>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
            Track daily habits and hold each other accountable across your teams.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsJoinOpen(true)}
            disabled={isAtLimit}
            className="px-3.5 py-2 text-xs md:text-sm font-semibold border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-800 dark:text-zinc-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={isAtLimit ? `Max ${MAX_TEAMS_PER_USER} pods reached` : undefined}
          >
            <UserPlus className="w-4 h-4" /> Join with Code
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            disabled={isAtLimit}
            className="bg-black dark:bg-white text-white dark:text-black font-semibold px-4 py-2 text-xs md:text-sm hover:bg-gray-800 dark:hover:bg-zinc-200 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title={isAtLimit ? `Max ${MAX_TEAMS_PER_USER} pods reached` : undefined}
          >
            <Plus className="w-4 h-4" /> Create Pod
          </button>
        </div>
      </header>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teamList.map((team) => (
          <TeamCard key={team.id} team={team} />
        ))}

        {/* Quick Add Card (if under limit) */}
        {!isAtLimit && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-200 dark:border-zinc-800 hover:border-black dark:hover:border-white transition-all text-gray-400 dark:text-zinc-500 hover:text-black dark:hover:text-white group cursor-pointer min-h-[170px]"
          >
            <div className="w-10 h-10 flex items-center justify-center mb-3">
              <Plus className="w-5 h-5" />
            </div>
            <span className="font-semibold text-sm">Create Another Pod</span>
            <span className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              Up to {MAX_TEAMS_PER_USER - teamList.length} more
            </span>
          </button>
        )}
      </div>

      {/* Modals */}
      <CreateTeamModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
      <JoinTeamModal isOpen={isJoinOpen} onClose={() => setIsJoinOpen(false)} />
    </div>
  );
}

