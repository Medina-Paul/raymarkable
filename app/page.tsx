"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
      {/* Left Side: Login Form */}
      <div className="flex flex-1 flex-col justify-between p-6 sm:p-10 lg:p-14">
        {/* System Name */}
        <div>
          <h1 className="font-bold text-xl tracking-tight text-black dark:text-white">
            Raymarkable
          </h1>
        </div>

        {/* Center Auth Box */}
        <div className="mx-auto w-full max-w-sm my-auto py-12 space-y-6">
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-black dark:text-white">
              Welcome back
            </h2>
            {/* Motto */}
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Build better habits. Produce remarkable results.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-zinc-600 dark:text-zinc-400" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span>{isLoading ? "Signing in..." : "Continue with Google"}</span>
          </button>
        </div>

        {/* Mobile Quote (Visible on mobile/tablet only) */}
        <div className="lg:hidden pt-6 border-t border-zinc-200 dark:border-zinc-800">
          <blockquote className="space-y-1">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 italic">
              "Habits are the compound interest of self-improvement."
            </p>
            <footer className="text-xs text-zinc-500 dark:text-zinc-400">
              — James Clear
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right Side: Quote Showcase (Desktop only) */}
      <div className="hidden lg:flex flex-1 flex-col justify-end p-12 lg:p-16 bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 text-white relative">
        <div className="max-w-md space-y-4">
          <blockquote className="space-y-3">
            <p className="text-2xl lg:text-3xl font-medium tracking-tight leading-snug">
              "Habits are the compound interest of self-improvement."
            </p>
            <footer className="text-sm font-medium text-zinc-400">
              — James Clear
            </footer>
          </blockquote>
        </div>
      </div>
    </div>
  );
}
