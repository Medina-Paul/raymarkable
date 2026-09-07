import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
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

  const me = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  const target = await db.query.users.findFirst({ where: eq(users.id, id) });

  if (!me?.teamId || me.teamId !== target?.teamId) {
    redirect("/dashboard/teams");
  }

  const cookieStore = await cookies();
  const clientDate = cookieStore.get("x-client-date")?.value;

  return <ProfileView targetUserId={id} isOwnProfile={false} clientDate={clientDate} />;
}

