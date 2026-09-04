"use client";

import { useEffect, useRef } from "react";
import { useNotifications, useReadNotification } from "@/lib/hooks/use-teams";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

/*
Clean Web Audio API notification chime.
Plays a subtle, pleasant two-tone synth chime without needing external audio files.
*/
export function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First bell note (E5 - 659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second bell note (A5 - 880 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.1);
    gain2.gain.setValueAtTime(0.15, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.1);
    osc2.stop(now + 0.55);
  } catch (e) {
    // Audio context may be restricted before user interaction
  }
}

export function NotificationsListener() {
  const { data: notifications = [] } = useNotifications();
  const readMutation = useReadNotification();
  const processedIds = useRef(new Set<string>());
  const queryClient = useQueryClient();
  const supabase = createClient();

  // Listen to Supabase Realtime for instant background updates
  useEffect(() => {
    const channel = supabase
      .channel("realtime-updates")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        () => {
          // Instantly refresh notifications when a new one is pushed from the DB
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "team_events" },
        () => {
          // Instantly refresh the team activity feed when a teammate logs an event
          queryClient.invalidateQueries({ queryKey: ["team", "me"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, queryClient]);

  // Process incoming unread notifications
  useEffect(() => {
    notifications.forEach((n) => {
      if (!processedIds.current.has(n.id)) {
        processedIds.current.add(n.id);
        
        const isSoundEnabled = typeof window !== "undefined" && localStorage.getItem("raymarkable_sound_enabled") !== "false";

        // 1. Play audio chime if enabled in user settings
        if (isSoundEnabled) {
          playChime();
        }

        // 2. Fire interactive in-app toast notification
        toast.info("Teammate Nudge", {
          description: n.message,
          duration: 8000,
          action: {
            label: "Dismiss",
            onClick: () => readMutation.mutate(n.id),
          },
        });
      }
    });
  }, [notifications, readMutation]);

  return null;
}
