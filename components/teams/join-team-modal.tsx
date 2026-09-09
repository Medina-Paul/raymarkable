"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useJoinTeam } from "@/lib/hooks/use-teams";
import { Loader2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

interface JoinTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function JoinTeamModal({ isOpen, onClose }: JoinTeamModalProps) {
  const [inviteCode, setInviteCode] = useState("");
  const joinMutation = useJoinTeam();
  const router = useRouter();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inviteCode.trim();
    if (!trimmed) return;

    joinMutation.mutate(trimmed, {
      onSuccess: (res) => {
        toast.success("Successfully joined the accountability pod!");
        setInviteCode("");
        onClose();
        const targetId = res?.teamId || trimmed;
        router.push(`/dashboard/teams/${targetId}`);
      },
      onError: (err: Error) => {
        toast.error(err.message || "Failed to join team.");
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-6 shadow-2xl relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={joinMutation.isPending}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 p-1 cursor-pointer transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="space-y-2 mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5" /> Join a Pod
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            Paste the unique invite code (UUID) shared by your teammate to join their pod.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-zinc-300 mb-1.5">
              Invite Code (UUID)
            </label>
            <input
              type="text"
              placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
              required
              autoFocus
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white font-mono text-sm transition"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={joinMutation.isPending}
              className="px-4 py-2 text-sm font-semibold text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={joinMutation.isPending || !inviteCode.trim()}
              className="bg-black dark:bg-white text-white dark:text-black font-semibold px-5 py-2 hover:bg-gray-800 dark:hover:bg-zinc-200 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {joinMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Joining...
                </>
              ) : (
                "Join Pod"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
