"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { playChime } from "@/components/notifications-listener";

export type NotificationPermissionState = NotificationPermission | "unsupported";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribes the current browser to native Web Push using the application VAPID public key
 * and persists the endpoint and cryptographic keys to the server database.
 */
async function registerWebPushSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("[WebPush] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.");
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let subscription = await reg.pushManager.getSubscription();

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys) {
      console.warn("[WebPush] Incomplete push subscription object.");
      return false;
    }

    const res = await fetch("/api/v1/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: subJson.endpoint,
        keys: subJson.keys,
      }),
    });

    return res.ok;
  } catch (err) {
    console.warn("[WebPush] Registration failed:", err);
    return false;
  }
}

/**
 * Encapsulates all browser-level notification and Web Push APIs:
 * - LocalStorage sound preference toggle
 * - W3C Web Push subscription & VAPID handshake
 * - Backend subscription sync
 * - Background native push testing
 */
export function useDeviceNotifications() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("raymarkable_sound_enabled") !== "false";
  });
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return typeof window !== "undefined" && !("Notification" in window) ? "unsupported" : "default";
  });
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // If already granted, ensure the push subscription is synced to the database
    if ("Notification" in window && Notification.permission === "granted") {
      registerWebPushSubscription().catch(() => {});
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

    setIsSubscribing(true);
    try {
      const res = await Notification.requestPermission();
      setPermission(res);

      if (res === "granted") {
        toast.info("Registering push notifications with device...");
        const registered = await registerWebPushSubscription();
        if (registered) {
          toast.success("Phone & lock screen alerts enabled!");
        } else {
          toast.success("Notification permissions enabled!");
        }

        // Show welcome notification
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification("Raymarkable", {
            body: "Device alerts active! Teammate nudges will appear on your lock screen.",
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            vibrate: [200, 100, 200],
          } as any);
        }
      } else if (res === "denied") {
        toast.error("Notifications were blocked in your browser or phone settings.");
      }
    } catch {
      toast.error("Could not request notification permission.");
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  const sendTestAlert = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") {
      toast.error("Please enable device notifications first.");
      return;
    }

    if (soundEnabled) {
      playChime();
    }

    try {
      // 1. First attempt real server-side Web Push dispatch
      const res = await fetch("/api/v1/push/test", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.sentCount > 0) {
          toast.success("Test alert pushed to your device!");
          return;
        }
      }

      // 2. Fallback to local Service Worker if server push hasn't registered yet
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Raymarkable Nudge", {
          body: "This is what a teammate nudge looks like on your phone!",
          icon: "/icons/icon-192x192.png",
          badge: "/icons/icon-192x192.png",
          vibrate: [200, 100, 200],
          data: { url: "/dashboard/habits" },
        } as any);
        toast.success("Local test alert sent!");
        return;
      }

      // 3. Fallback to Window Notification
      new Notification("Raymarkable Nudge", {
        body: "This is what a teammate nudge looks like on your phone!",
        icon: "/icons/icon-192x192.png",
      });
      toast.success("Local test alert sent!");
    } catch (e) {
      console.warn("[Test Notification] Failed to trigger test alert:", e);
      toast.error("Failed to send test alert.");
    }
  }, [soundEnabled]);

  return {
    soundEnabled,
    toggleSound,
    permission,
    isSubscribing,
    requestPermission,
    sendTestAlert,
  };
}
