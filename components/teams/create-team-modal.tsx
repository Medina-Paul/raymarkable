"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateTeam } from "@/lib/hooks/use-teams";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateTeamModal({ isOpen, onClose }: CreateTeamModalProps) {
  const [teamName, setTeamName] = useState("");
  const createMutation = useCreateTeam();
  const router = useRouter();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = teamName.trim();
    if (!trimmed) return;

    createMutation.mutate(trimmed, {
      onSuccess: (res) => {
        toast.success(`Accountability pod '${trimmed}' created!`);
        setTeamName("");
        onClose();
        if (res.team?.id) {
          router.push(`/dashboard/teams/${res.team.id}`);
        }
      },
      onError: (err: Error) => {
        toast.error(err.message || "Failed to create team.");
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={createMutation.isPending}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-1 cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Plus className="w-5 h-5" /> Create Pod
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Start a new accountability pod (max 5 members) and invite your teammates.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-zinc-300 mb-1.5">
              Pod Name
            </label>
            <input
              type="text"
              placeholder="e.g. Morning 5AM Club, Gym Squad"
              maxLength={30}
              required
              autoFocus
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white text-sm transition"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={createMutation.isPending}
              className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !teamName.trim()}
              className="bg-black dark:bg-white text-white dark:text-black font-semibold px-5 py-2 hover:bg-gray-800 dark:hover:bg-zinc-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating...
                </>
              ) : (
                "Create Pod"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
