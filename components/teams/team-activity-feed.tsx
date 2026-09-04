"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import { Sparkles } from "lucide-react";
import type { TeamEvent } from "@/lib/hooks/use-teams";

/*
TEAM ACTIVITY FEED
Displays real-time completion logs and team interactions.
Automatically scrolls to the latest event as new activities arrive.
*/

export function TeamActivityFeed({ events = [] }: { events: TeamEvent[] }) {
  const feedEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the bottom whenever a new activity event is logged
  useEffect(() => {
    if (events.length > 0 && feedEndRef.current) {
      feedEndRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [events]);

  return (
    <div className="lg:col-span-3 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 flex flex-col overflow-hidden h-[500px] lg:h-auto min-w-0">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-800/40 mb-4">
        <h2 className="font-bold text-gray-900 dark:text-white">Live Activity</h2>
      </div>

      {/* Feed List */}
      <div id="live-activity" className="flex-1 overflow-y-auto space-y-4 px-4">
        {events.length === 0 ? (
          <div className="text-center text-gray-400 dark:text-zinc-500 py-12">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p>No activity yet. Start checking off habits!</p>
          </div>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex gap-2 sm:gap-4">
              {/* Actor Avatar */}
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 text-black dark:text-white flex-shrink-0 flex items-center justify-center font-bold relative overflow-hidden">
                {e.actor.avatarUrl ? (
                  <Image
                    src={e.actor.avatarUrl}
                    alt={e.actor.name || "Avatar"}
                    fill
                    className="object-cover"
                    sizes="40px"
                  />
                ) : (
                  e.actor.name?.[0]?.toUpperCase() || "?"
                )}
              </div>

              {/* Message & Timestamp */}
              <div className="min-w-0 flex-1">
                <p className="text-gray-800 dark:text-zinc-200 break-words">
                  <span className="font-bold text-gray-900 dark:text-white">
                    {e.actor.name || "Anonymous"}
                  </span>{" "}
                  {e.message}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  {new Date(e.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={feedEndRef} />
      </div>
    </div>
  );
}
