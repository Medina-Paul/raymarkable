import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { db } from "@/lib/db";
import { teamMembers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { cookies } from "next/headers";

export default async function TeamMemberProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  if (id === user.id) {
    redirect("/dashboard/profile");
  }

  // Find all teams 'me' belongs to
  const myTeams = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, user.id));

  if (myTeams.length === 0) {
    redirect("/dashboard/teams");
  }

  const myTeamIds = myTeams.map((t) => t.teamId);

  // Check if target user belongs to at least one of my teams
  const sharedMembership = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(and(eq(teamMembers.userId, id), inArray(teamMembers.teamId, myTeamIds)))
    .limit(1)
    .then((res) => res[0]);

  if (!sharedMembership) {
    redirect("/dashboard/teams");
  }

  const cookieStore = await cookies();
  const clientDate = cookieStore.get("x-client-date")?.value;

  return <ProfileView targetUserId={id} isOwnProfile={false} clientDate={clientDate} />;
}


