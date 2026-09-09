"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTeamDetails, useLeaveTeam, useRemoveMember } from "@/lib/hooks/use-teams";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Users, LogOut, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { TeamCodeWidget } from "@/components/teams/team-code-widget";
import { TeamActivityFeed } from "@/components/teams/team-activity-feed";
import { TeamRoster } from "@/components/teams/team-roster";

/*
POD HUB PAGE (/dashboard/teams/[id])
Dedicated dashboard for an individual accountability pod:
1. Displays Pod Name, Member Count (X/5), and Invite UUID Code.
2. Displays Live Social Activity Feed + 5-Member Roster with pending tasks & nudges.
3. Allows leaving the pod or kicking members (leader only).
*/

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const teamId = params?.id || "";

  const { data, isLoading, isError } = useTeamDetails(teamId);
  const leaveMutation = useLeaveTeam();
  const removeMutation = useRemoveMember();

  const [memberToRemove, setMemberToRemove] = useState<{ id: string; name: string } | null>(null);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  // Loading State
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  // Not Found or Error State
  if (isError || !data?.team) {
    return (
      <div className="p-8 max-w-xl mx-auto text-center space-y-4 mt-16">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pod Not Found</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm">
          This accountability pod does not exist or you are no longer a member.
        </p>
        <Link
          href="/dashboard/teams"
          className="inline-flex items-center gap-2 bg-black dark:bg-white text-white dark:text-black font-semibold px-4 py-2 text-sm hover:bg-gray-800 dark:hover:bg-zinc-200 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Pods
        </Link>
      </div>
    );
  }

  const { team, members, events, currentUserId } = data;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto lg:h-full flex flex-col">
      {/* Back to Pods Link */}
      <div className="mb-4">
        <Link
          href="/dashboard/teams"
          className="inline-flex items-center gap-1.5 text-xs md:text-sm font-semibold text-gray-500 hover:text-black dark:text-zinc-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to all pods
        </Link>
      </div>

      {/* Header */}
      <header className="mb-8 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white truncate">
            {team.name}
          </h1>
          <button
            onClick={() => setIsLeaveModalOpen(true)}
            disabled={leaveMutation.isPending}
            className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 border border-transparent hover:border-red-200 dark:hover:border-red-900/40"
          >
            <LogOut className="w-4 h-4" /> Leave Pod
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-gray-500 dark:text-zinc-400 mt-1 flex items-center gap-2 flex-wrap text-sm">
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4" /> {members.length} / 5 Members
            </span>
            <span className="text-gray-300 dark:text-zinc-700">•</span>
            <TeamCodeWidget teamId={team.id} />
          </div>
        </div>
      </header>

      {/* Main Grid: Activity Feed & Team Roster */}
      <div className="grid lg:grid-cols-5 gap-8 lg:flex-1 lg:min-h-0 min-w-0">
        <TeamActivityFeed events={events} />
        <TeamRoster
          teamId={team.id}
          members={members}
          leaderId={team.createdBy}
          currentUserId={currentUserId}
          onRemoveMember={setMemberToRemove}
        />
      </div>

      {/* Leave Team Modal */}
      <ConfirmModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onConfirm={async () => {
          try {
            await leaveMutation.mutateAsync(team.id);
            toast.success("Left the accountability pod.");
            setIsLeaveModalOpen(false);
            router.push("/dashboard/teams");
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to leave team.";
            toast.error(message);
          }
        }}
        title="Leave Accountability Pod"
        description={`Are you sure you want to leave '${team.name}'? You will lose access to this pod's live feed and streak activities.`}
        confirmText="Leave Pod"
        variant="danger"
        isLoading={leaveMutation.isPending}
      />

      {/* Remove Member Modal (Leader Only) */}
      <ConfirmModal
        isOpen={!!memberToRemove}
        onClose={() => setMemberToRemove(null)}
        onConfirm={async () => {
          if (memberToRemove) {
            try {
              await removeMutation.mutateAsync({
                teamId: team.id,
                targetId: memberToRemove.id,
              });
              toast.success(`${memberToRemove.name} was removed from the pod.`);
              setMemberToRemove(null);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : "Failed to remove member.";
              toast.error(message);
            }
          }
        }}
        title="Remove Member"
        description={`Are you sure you want to remove ${memberToRemove?.name} from this pod? They will lose access to the pod dashboard.`}
        confirmText="Remove Member"
        variant="danger"
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
