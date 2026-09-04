"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { playChime } from "@/components/notifications-listener";

export type NotificationPermissionState = NotificationPermission | "unsupported";

/**
 * Encapsulates all browser-level notification and audio chime APIs:
 * - LocalStorage sound preference toggle
 * - Web Notification permission state machine
 * - Service Worker native push/banner dispatch
 * - Test notification trigger
 */
export function useDeviceNotifications() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [permission, setPermission] = useState<NotificationPermissionState>("default");

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load persisted chime preference
    setSoundEnabled(localStorage.getItem("raymarkable_sound_enabled") !== "false");

    // Detect browser notification support & permission
    if ("Notification" in window) {
      setPermission(Notification.permission);
    } else {
      setPermission("unsupported");
    }
  }, []);

  const toggleSound = useCallback(() => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem("raymarkable_sound_enabled", nextVal ? "true" : "false");

    if (nextVal) {
      playChime();
      toast.success("Audio chime enabled");
    } else {
      toast.info("Audio chime muted");
    }
  }, [soundEnabled]);

  const requestPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Notifications are not supported by this browser.");
      return;
    }

    try {
      const res = await Notification.requestPermission();
      setPermission(res);

      if (res === "granted") {
        toast.success("Phone / device alerts enabled!");
        // Dispatch instant welcome confirmation banner
        if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification("Raymarkable", {
              body: "Device alerts enabled! Teammate nudges will appear on your lock screen.",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              vibrate: [200, 100, 200],
            } as any);
          });
        } else if ("Notification" in window) {
          new Notification("Raymarkable", {
            body: "Device alerts enabled! Teammate nudges will appear on your lock screen.",
            icon: "/icons/icon-192x192.png",
          });
        }
      } else if (res === "denied") {
        toast.error("Notifications were blocked in your browser or phone settings.");
      }
    } catch {
      toast.error("Could not request notification permission.");
    }
  }, []);

  const sendTestAlert = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      toast.error("Please enable device notifications first.");
      return;
    }

    if (soundEnabled) {
      playChime();
    }

    const payload = {
      body: "This is what a teammate nudge looks like on your phone!",
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
      vibrate: [200, 100, 200],
      data: { url: "/dashboard/habits" },
    };

    const dispatchTest = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const reg =
            (await navigator.serviceWorker.getRegistration()) ||
            (await Promise.race([
              navigator.serviceWorker.ready,
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
            ]));

          if (reg && "showNotification" in reg) {
            await reg.showNotification("Raymarkable Nudge", payload as any);
            return;
          }
        } catch (swErr) {
          console.warn("[Test Notification] SW showNotification failed, trying fallback:", swErr);
        }
      }

      try {
        new Notification("Raymarkable Nudge", {
          body: payload.body,
          icon: payload.icon,
        });
      } catch (e) {
        console.warn("[Test Notification] Window Notification fallback unavailable:", e);
      }
    };

    dispatchTest();

    toast.success("Test alert sent to your device!");
  }, [soundEnabled]);

  return {
    soundEnabled,
    toggleSound,
    permission,
    requestPermission,
    sendTestAlert,
  };
}
