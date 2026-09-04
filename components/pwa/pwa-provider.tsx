"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/*
PWA LIFECYCLE CONTEXT & PROVIDER

Manages everything related to installing the app on phones and computers:
1. Registers the `/sw.js` Service Worker in production (disabled in dev to prevent cache collisions).
2. Detects if the app is already installed (`display-mode: standalone`).
3. Catches the browser's `beforeinstallprompt` event on Android/Chrome to trigger 1-click install.
4. Detects iOS Safari where installation requires the manual Share -> "Add to Home Screen" flow.
*/

interface PwaContextType {
  isInstallable: boolean;
  isInstalled: boolean;
  isIos: boolean;
  promptInstall: () => Promise<void>;
}

const PwaContext = createContext<PwaContextType>({
  isInstallable: false,
  isInstalled: false,
  isIos: false,
  promptInstall: async () => {},
});

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    // 1. Service Worker Management:
    // Only activate caching in production. In local development, unregister service workers
    // to prevent stale cached HTML from causing hydration mismatches during active development.
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "production") {
        window.addEventListener("load", () => {
          navigator.serviceWorker
            .register("/sw.js")
            .catch((error) => {
              console.warn("[PWA] Service Worker registration failed:", error);
            });
        });
      } else {
        // In development, clear any lingering service workers on localhost
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    }

    // 2. Detect if the user launched the app from their home screen (standalone mode)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    // 3. Detect iOS devices (iPhone, iPad, iPod)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 4. On Chrome / Android / Edge, capture the native install event so we can trigger it with our own button
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault(); // Prevent automatic browser banner
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. Detect when installation successfully finishes
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  // Launches the native browser installation dialog
  const promptInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  return (
    <PwaContext.Provider value={{ isInstallable, isInstalled, isIos, promptInstall }}>
      {children}
    </PwaContext.Provider>
  );
}

export const usePwa = () => useContext(PwaContext);
