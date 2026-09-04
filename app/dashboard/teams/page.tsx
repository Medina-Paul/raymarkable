"use client";

import { useState } from "react";
import { useMyTeam, useLeaveTeam, useRemoveMember } from "@/lib/hooks/use-teams";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Users, LogOut, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { NoTeamView } from "@/components/teams/no-team-view";
import { TeamCodeWidget } from "@/components/teams/team-code-widget";
import { TeamActivityFeed } from "@/components/teams/team-activity-feed";
import { TeamRoster } from "@/components/teams/team-roster";

/*
TEAMS PAGE (POD DASHBOARD)
Orchestrates the team experience:
1. Displays the Onboarding / Join flow if the user has no team.
2. Displays the Team Hub (Activity Feed + Roster + Nudges) if active in a pod.
*/

export default function TeamsPage() {
  const { data, isLoading, isError, refetch } = useMyTeam();
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

  const { team, members, events, currentUserId } = data || {
    team: null,
    members: [],
    events: [],
    currentUserId: null,
  };

  // State 1: User has no team
  if (!team) {
    return <NoTeamView />;
  }

  // State 2: User is in a team
  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto lg:h-full flex flex-col">
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
            <LogOut className="w-4 h-4" /> Leave Team
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
            await leaveMutation.mutateAsync();
            toast.success("Left the team.");
            setIsLeaveModalOpen(false);
          } catch (err: any) {
            toast.error(err.message || "Failed to leave team.");
          }
        }}
        title="Leave Team"
        description="Are you sure you want to leave this accountability team? You will lose access to team activities and streak contributions."
        confirmText="Leave Team"
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
              await removeMutation.mutateAsync(memberToRemove.id);
              toast.success(`${memberToRemove.name} was removed from the team.`);
              setMemberToRemove(null);
            } catch (err: any) {
              toast.error(err.message || "Failed to remove member.");
            }
          }
        }}
        title="Remove Member"
        description={`Are you sure you want to remove ${memberToRemove?.name} from the team? They will lose access to the team dashboard and their active streaks will no longer contribute to the pod.`}
        confirmText="Remove Member"
        variant="danger"
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
