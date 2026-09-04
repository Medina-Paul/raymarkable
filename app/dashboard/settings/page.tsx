import { createClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const profile = await db.query.users.findFirst({
    where: eq(users.id, user.id)
  });

  if (!profile) {
    redirect("/");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-black mb-2 dark:text-white">Settings</h1>
      <p className="text-gray-400 mb-8 dark:text-zinc-400">Manage your account preferences and goals.</p>
      
      <SettingsForm initialThreshold={profile.successThreshold} />
    </div>
  );
}
