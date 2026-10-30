"use client";

import { useEffect } from "react";

// Registers public/sw.js as soon as the dashboard loads, so the app is
// installable (PWA) right away — push subscription itself is opted into
// from "Mon compte" (PushNotificationsCard.tsx).
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
