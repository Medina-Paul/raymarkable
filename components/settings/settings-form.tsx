"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Target, Palette, Sun, Moon, Laptop, Smartphone, Download, CheckCircle2, Share, Bell, Volume2, VolumeX, AlertTriangle, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { useUpdateProfile, useDeleteAccount } from "@/lib/hooks/use-habits";
import { usePwa } from "@/components/pwa/pwa-provider";
import { createClient } from "@/lib/supabase/client";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { playChime } from "@/components/notifications-listener";

export function SettingsForm({ initialThreshold }: { initialThreshold: number }) {
  const [threshold, setThreshold] = useState(initialThreshold);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const router = useRouter();
  const updateProfile = useUpdateProfile();
  const deleteAccountMutation = useDeleteAccount();
  const { theme, setTheme } = useTheme();
  const { isInstallable, isInstalled, isIos, promptInstall } = usePwa();
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();

  // Audio Chime Preference (persisted in localStorage)
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setSoundEnabled(localStorage.getItem("raymarkable_sound_enabled") !== "false");
    }
  }, []);

  const handleSave = () => {
    updateProfile.mutate({ successThreshold: threshold }, {
      onSuccess: () => {
        toast.success("Settings saved successfully!");
        router.refresh();
      },
      onError: () => {
        toast.error("Failed to save settings");
      }
    });
  };

  const handleToggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem("raymarkable_sound_enabled", nextVal ? "true" : "false");
    if (nextVal) {
      playChime();
      toast.success("Audio chime enabled");
    } else {
      toast.info("Audio chime muted");
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccountMutation.mutateAsync();
      await supabase.auth.signOut();
      toast.success("Your account and all associated data have been deleted.");
      router.push("/");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account");
    }
  };

  return (
    <div className="space-y-12">
      {/* Accountability & Goals Section */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          <h2 className="text-lg font-bold text-black dark:text-white">Accountability & Goals</h2>
        </div>
        
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">
              Daily Success Threshold
            </label>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
              What percentage of your daily habits must be completed for the day to be marked as "Green" (Successful) on your Progress heatmap?
            </p>
            
            <div className="flex items-center gap-4">
              <input 
                type="range" 
                min="10" 
                max="100" 
                step="5"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-zinc-800 appearance-none cursor-pointer accent-black dark:accent-white"
              />
              <span className="font-bold text-lg w-12 text-right text-black dark:text-white">{threshold}%</span>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={updateProfile.isPending || threshold === initialThreshold}
              className="mt-4 px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-default"
            >
              {updateProfile.isPending ? "Saving..." : "Save Goal"}
            </button>
          </div>
        </div>
      </section>

      {/* Appearance Section */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Palette className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          <h2 className="text-lg font-bold text-black dark:text-white">Appearance</h2>
        </div>
        
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-zinc-300 mb-1">
              Theme Settings
            </label>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4">
              Choose your preferred interface theme.
            </p>
            {mounted ? (
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`px-3 py-2.5 border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "light"
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  <Sun className="w-4 h-4" /> Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`px-3 py-2.5 border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "dark"
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  <Moon className="w-4 h-4" /> Dark
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`px-3 py-2.5 border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    theme === "system"
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  <Laptop className="w-4 h-4" /> System
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                <div className="h-9 bg-gray-100 dark:bg-zinc-800 animate-pulse border border-gray-200 dark:border-zinc-700" />
                <div className="h-9 bg-gray-100 dark:bg-zinc-800 animate-pulse border border-gray-200 dark:border-zinc-700" />
                <div className="h-9 bg-gray-100 dark:bg-zinc-800 animate-pulse border border-gray-200 dark:border-zinc-700" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Notifications Section */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          <h2 className="text-lg font-bold text-black dark:text-white">Notifications</h2>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Teammate Nudges</h3>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              When teammates nudge you about pending habits, an in-app toast will appear with action controls.
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-800 dark:text-zinc-200 flex items-center gap-1.5">
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-orange-500" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
                Audio Chime
              </p>
              <p className="text-[11px] text-gray-500 dark:text-zinc-400">
                Play a subtle bell chime when a nudge arrives
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleSound}
              className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer shrink-0 border ${
                soundEnabled
                  ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white hover:bg-gray-800 dark:hover:bg-zinc-200"
                  : "bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-700"
              }`}
            >
              {soundEnabled ? "Enabled" : "Muted"}
            </button>
          </div>
        </div>
      </section>

      {/* Application & Installation Section */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <Smartphone className="w-5 h-5 text-gray-500 dark:text-zinc-400" />
          <h2 className="text-lg font-bold text-black dark:text-white">Install Application</h2>
        </div>

        <div className="space-y-4 max-w-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 flex items-center justify-center shadow-sm border border-gray-200 dark:border-zinc-800">
              <Image 
                src="/icon.svg" 
                alt="Raymarkable Icon" 
                width={40} 
                height={40} 
                className="w-full h-full object-cover" 
              />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Raymarkable</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Install for fullscreen, offline-ready habit tracking</p>
            </div>
          </div>

          {isInstalled ? (
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 p-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>App is installed and running in standalone mode on this device.</span>
            </div>
          ) : isIos ? (
            <div className="space-y-2 text-xs text-gray-600 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800/60 p-3.5 border border-gray-200 dark:border-zinc-700">
              <p className="font-bold text-gray-900 dark:text-white">To install on iOS / iPadOS:</p>
              <p className="flex items-center gap-1.5">
                1. Tap the <Share className="w-3.5 h-3.5 text-blue-500 inline shrink-0" /> Share button in Safari.
              </p>
              <p>
                2. Scroll down and tap <span className="font-bold text-gray-900 dark:text-white">&apos;Add to Home Screen&apos;</span>.
              </p>
            </div>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={promptInstall}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" /> Install App to Device
            </button>
          ) : (
            <div className="text-xs text-gray-500 dark:text-zinc-400 ">
              <p className="font-medium">
                To install on your phone or desktop, click the install icon in your browser&apos;s address bar or use the browser menu &gt; <strong>&apos;Install Raymarkable&apos;</strong>.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Delete Account */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <h2 className="text-lg font-bold text-red-600 dark:text-red-400">Delete Account</h2>
        </div>

        <div className="space-y-4 max-w-md">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Delete Account & Data</h3>
            <p className="text-xs text-gray-600 dark:text-zinc-400">
              Permanently delete your user profile and wipe all habits, logs, streak records, team memberships, and notifications from the database. This action cannot be undone.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" /> Delete Account
          </button>
        </div>
      </section>

      {/* Confirmation Modal for Permanent Account Deletion */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        description="Are you absolutely sure you want to delete your account? All your habits, completion logs, streaks, and team associations will be permanently wiped from the database. This action is irreversible."
        confirmText="Permanently Delete Account"
        variant="danger"
        isLoading={deleteAccountMutation.isPending}
      />
    </div>
  );
}
