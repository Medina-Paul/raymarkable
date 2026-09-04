"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, PanelLeft, PanelLeftOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ui/confirm-modal";

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false); // Mobile state
  const [isDesktopOpen, setIsDesktopOpen] = useState(true); // Desktop state
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await supabase.auth.signOut();
    setIsLogoutModalOpen(false);
    router.push("/");
    router.refresh();
  };

  const youItems = [
    { name: "Home", href: "/dashboard" },
    { name: "Habits", href: "/dashboard/habits" },
    { name: "Progress", href: "/dashboard/profile" },
  ];

  const accountabilityItems = [
    { name: "Teams", href: "/dashboard/teams" },
  ];

  return (
    <>
      {/* Mobile Header with Hamburger */}
      <div className="md:hidden flex items-center justify-between bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-zinc-800/80 p-4 h-14 w-full fixed top-0 z-20">
        <Link 
          href="/dashboard"
          className="font-bold text-base text-gray-900 dark:text-white hover:opacity-80 transition-opacity"
        >
          Raymarkable
        </Link>
        <button 
          onClick={() => setIsOpen(true)} 
          className="p-2 -mr-2 text-gray-600 dark:text-zinc-300 cursor-pointer"
          aria-label="Open sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
      </div>

      {/* Floating Desktop Open Button (Visible only when Desktop sidebar is closed) */}
      {!isDesktopOpen && (
        <button
          onClick={() => setIsDesktopOpen(true)}
          className="hidden md:flex fixed top-4 left-4 z-20 p-2 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
          aria-label="Open sidebar"
        >
          <PanelLeftOpen className="h-5 w-5" />
        </button>
      )}

      {/* Overlay for mobile to close sidebar when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden transition-opacity"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-40 bg-white dark:bg-[#121212] border-r border-gray-200 dark:border-zinc-800/80 transform transition-all duration-300 ease-in-out flex flex-col w-60 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } md:relative md:translate-x-0 ${
          isDesktopOpen ? "md:w-60 md:opacity-100" : "md:w-0 md:opacity-0 md:overflow-hidden md:border-none"
        }`}
      >
        {/* Top Title / Header */}
        <div className="flex h-14 items-center justify-between px-4 shrink-0 whitespace-nowrap">
          <Link 
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="font-bold text-base text-gray-900 dark:text-white hover:opacity-80 transition-opacity"
          >
            Raymarkable
          </Link>
          {/* Close button for mobile */}
          <button 
            onClick={() => setIsOpen(false)} 
            className="md:hidden p-1.5 -mr-1.5 text-gray-500 dark:text-zinc-400 hover:text-black dark:hover:text-white cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
          {/* Collapse button for desktop */}
          <button 
            onClick={() => setIsDesktopOpen(false)} 
            className="hidden md:flex p-1.5 -mr-1.5 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors cursor-pointer"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
        
        {/* Navigation Content */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto whitespace-nowrap">
          {/* Section 1: YOU */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-mono font-medium tracking-wider text-zinc-500 uppercase select-none">
              You
            </div>
            <div className="space-y-0.5 mt-0.5">
              {youItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-1.5 text-sm rounded transition-colors ${
                      isActive
                        ? "bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white font-bold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 font-normal"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-zinc-800/80 !my-3" />

          {/* Section 2: ACCOUNTABILITY */}
          <div>
            <div className="px-3 py-1.5 text-[11px] font-mono font-medium tracking-wider text-zinc-500 uppercase select-none">
              Accountability
            </div>
            <div className="space-y-0.5 mt-0.5">
              {accountabilityItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className={`block px-3 py-1.5 text-sm rounded transition-colors ${
                      isActive
                        ? "bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white font-bold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 font-normal"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Bottom Area: Settings & Logout */}
        <div className="border-t border-gray-200 dark:border-zinc-800/80 p-3 space-y-0.5 whitespace-nowrap">
          <Link
            href="/dashboard/settings"
            onClick={() => setIsOpen(false)}
            className={`block px-3 py-1.5 text-sm rounded transition-colors ${
              pathname === "/dashboard/settings"
                ? "bg-zinc-200 dark:bg-zinc-800 text-black dark:text-white font-bold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 font-normal"
            }`}
          >
            Settings
          </Link>
          <button 
            onClick={() => {
              setIsOpen(false);
              setIsLogoutModalOpen(true);
            }}
            disabled={isLoggingOut}
            className="w-full text-left block px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 rounded transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogout}
        title="Log Out"
        description="Are you sure you want to log out of your account?"
        confirmText="Log Out"
        variant="danger"
        isLoading={isLoggingOut}
      />
    </>
  );
}
