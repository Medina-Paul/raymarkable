import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileView } from "@/components/profile/profile-view";
import { cookies } from "next/headers";

export default async function MyProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const cookieStore = await cookies();
  const clientDate = cookieStore.get("x-client-date")?.value;

  return <ProfileView targetUserId={user.id} isOwnProfile={true} clientDate={clientDate} />;
}

