"use client";

import { useState } from "react";
import { useCreateTeam, useJoinTeam } from "@/lib/hooks/use-teams";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/*
NO TEAM VIEW (ONBOARDING SCREEN)
Displayed when the current user is not part of any accountability team.
Allows users to either create a new pod or join an existing one using an invite code.
*/

export function NoTeamView() {
  const [teamName, setTeamName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const createMutation = useCreateTeam();
  const joinMutation = useJoinTeam();

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim()) {
      createMutation.mutate(teamName.trim(), {
        onError: (err: any) => toast.error(err.message || "Failed to create team"),
      });
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      joinMutation.mutate(joinCode.trim(), {
        onError: (err: any) => toast.error(err.message || "Failed to join team"),
      });
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-3xl mx-auto space-y-12 mt-16">
      <header className="text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Accountability Teams
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 mt-2 text-md">
          Take accountability with up to 4 friends and build habits together.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Create a Team */}
        <div className="p-6">
          <h2 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Create a Team</h2>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mb-4">
            Start a new pod and invite your friends.
          </p>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Team Name"
              maxLength={30}
              required
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white"
            />
            <button
              disabled={createMutation.isPending}
              className="bg-black dark:bg-white text-white dark:text-black font-semibold py-2 hover:bg-gray-800 dark:hover:bg-zinc-200 transition flex items-center justify-center cursor-pointer disabled:cursor-default"
            >
              {createMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Team"}
            </button>
          </form>
        </div>

        {/* Join a Team */}
        <div className="p-6">
          <h2 className="font-bold text-lg mb-2 text-gray-900 dark:text-white">Join a Team</h2>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mb-4">
            Have an invite code? Paste it here.
          </p>
          <form onSubmit={handleJoin} className="flex flex-col gap-3">
            <input
              type="text"
              placeholder="Invite Code (UUID)"
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="px-4 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white font-mono text-sm"
            />
            <button
              disabled={joinMutation.isPending}
              className="bg-black dark:bg-white text-white dark:text-black font-semibold py-2 hover:bg-gray-800 dark:hover:bg-zinc-200 transition flex items-center justify-center cursor-pointer disabled:cursor-default"
            >
              {joinMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join Team"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
