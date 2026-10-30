"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Same component as TASKS: keeps every dashboard page's server data fresh
// (campaign progress, notifications...) by polling router.refresh(), and
// broadcasts "app:refresh-tick" so client-fetched widgets (the bell) follow
// the same cadence. Paused while the tab is hidden or offline.
const REFRESH_INTERVAL_MS = 8000;

export default function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    function tick() {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;
      router.refresh();
      window.dispatchEvent(new Event("app:refresh-tick"));
    }
    const id = setInterval(tick, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
