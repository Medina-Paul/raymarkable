import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

  const me = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });

  if (!me?.teamId || me.teamId !== target?.teamId) {
    redirect("/dashboard/teams");
  }

  return <ProfileView targetUserId={id} isOwnProfile={false} />;
}
