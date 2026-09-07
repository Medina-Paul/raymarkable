"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { playChime } from "@/components/notifications-listener";
import { STORAGE_KEYS } from "@/lib/constants";
import { subscribePush, unsubscribePush } from "@/lib/api/push";

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
async function registerWebPushSubscription(forceRenew = false): Promise<{ success: boolean; error?: string }> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { success: false, error: "Push notifications are not supported on this browser or private/incognito mode." };
  }

  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    console.warn("[WebPush] NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing.");
    return { success: false, error: "NEXT_PUBLIC_VAPID_PUBLIC_KEY environment variable is not configured." };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    
    let subscription = await reg.pushManager.getSubscription();

    // Only unsubscribe if forced (e.g. user manually re-subscribing or repairing)
    if (forceRenew && subscription) {
      await subscription.unsubscribe().catch(() => {});
      subscription = null;
    }

    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });
    }

    const subJson = subscription.toJSON();
    if (!subJson.endpoint || !subJson.keys) {
      return { success: false, error: "Browser returned an incomplete push subscription object." };
    }

    const res = await subscribePush({
      endpoint: subJson.endpoint,
      keys: subJson.keys as Record<string, string>,
    });

    if (res.success) {
      localStorage.removeItem(STORAGE_KEYS.PUSH_DISABLED);
      return { success: true };
    }

    return { success: false, error: res.error || "Server rejected registration" };
  } catch (err: unknown) {
    console.warn("[WebPush] Registration failed:", err);
    const errObj = err as { message?: string } | undefined;
    let msg = errObj?.message || "Registration failed on device";
    if (msg.includes("push service error")) {
      msg = "Push service error: Could not reach Google FCM. If using Brave or an Ad-blocker/VPN, ensure push services are allowed.";
    }
    return { success: false, error: msg };
  }
}

/**
 * Unsubscribes the current device from Web Push and removes its record from the database.
 */
async function unregisterWebPushSubscription(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await unsubscribePush(endpoint);
    }

    localStorage.setItem(STORAGE_KEYS.PUSH_DISABLED, "true");
    return true;
  } catch (err) {
    console.warn("[WebPush] Unsubscription failed:", err);
    localStorage.setItem(STORAGE_KEYS.PUSH_DISABLED, "true");
    return false;
  }
}

/**
 * Encapsulates all browser-level notification and Web Push APIs:
 * - LocalStorage sound preference toggle
 * - W3C Web Push subscription & VAPID handshake (enable & disable)
 * - Backend subscription sync & deletion
 * - Background native push testing
 */
export function useDeviceNotifications() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(STORAGE_KEYS.SOUND_ENABLED) !== "false";
  });
  const [permission, setPermission] = useState<NotificationPermissionState>(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      return Notification.permission;
    }
    return typeof window !== "undefined" && !("Notification" in window) ? "unsupported" : "default";
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStatus = async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setIsSubscribed(false);
        return;
      }

      setPermission(Notification.permission);

      if (Notification.permission !== "granted") {
        setIsSubscribed(false);
        return;
      }

      const isExplicitlyDisabled = localStorage.getItem(STORAGE_KEYS.PUSH_DISABLED) === "true";
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();

        if (sub && !isExplicitlyDisabled) {
          setIsSubscribed(true);
          registerWebPushSubscription(false).catch(() => {});
        } else if (sub && isExplicitlyDisabled) {
          await sub.unsubscribe().catch(() => {});
          setIsSubscribed(false);
        } else {
          setIsSubscribed(false);
        }
      } catch {
        setIsSubscribed(false);
      }
    };

    checkStatus();
  }, []);

  const toggleSound = useCallback(() => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    localStorage.setItem(STORAGE_KEYS.SOUND_ENABLED, nextVal ? "true" : "false");

    if (nextVal) {
      playChime();
      toast.success("Audio chime enabled");
    } else {
      toast.info("Audio chime muted");
    }
  }, [soundEnabled]);

  const enableAlerts = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.error("Notifications are not supported by this browser.");
      return;
    }

    setIsLoading(true);
    try {
      let currentPerm = Notification.permission;
      if (currentPerm !== "granted") {
        currentPerm = await Notification.requestPermission();
        setPermission(currentPerm);
      }

      if (currentPerm === "granted") {
        toast.info("Registering push notifications with device...");
        const regResult = await registerWebPushSubscription();
        if (regResult.success) {
          setIsSubscribed(true);
          toast.success("Phone & lock screen alerts enabled!");

          // Show welcome notification
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            reg.showNotification("Raymarkable", {
              body: "Device alerts active! Teammate nudges will appear on your lock screen.",
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              vibrate: [200, 100, 200],
            } as NotificationOptions & { vibrate?: number[]; badge?: string }).catch(() => {});
          }
        } else {
          toast.error(regResult.error || "Could not complete push registration.");
        }
      } else if (currentPerm === "denied") {
        setIsSubscribed(false);
        toast.error("Notifications were blocked in your browser or phone settings.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not request notification permission.";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disableAlerts = useCallback(async () => {
    setIsLoading(true);
    try {
      await unregisterWebPushSubscription();
      setIsSubscribed(false);
      toast.info("Phone alerts disabled for this device.");
    } catch {
      toast.error("Failed to disable phone alerts.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendTestAlert = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted" || !isSubscribed) {
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
        } as NotificationOptions & { vibrate?: number[]; badge?: string });
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
  }, [soundEnabled, isSubscribed]);

  return {
    soundEnabled,
    toggleSound,
    permission,
    isSubscribed,
    isLoading,
    enableAlerts,
    disableAlerts,
    sendTestAlert,
  };
}
