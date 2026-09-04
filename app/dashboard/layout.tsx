import { Sidebar } from "@/components/sidebar";
import { NotificationsListener } from "@/components/notifications-listener";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[100dvh] w-full bg-gray-50 dark:bg-zinc-950 flex-col md:flex-row overflow-hidden">
      <Sidebar />
      <NotificationsListener />
      <main className="flex-1 overflow-y-auto pt-14 md:pt-0 bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">
        {children}
      </main>
    </div>
  );
}
