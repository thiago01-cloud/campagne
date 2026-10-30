"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTimeShort } from "@/lib/format";
import Modal from "./Modal";

type NotificationItem = { id: string; type: string; title: string; body: string | null; url: string | null; read: boolean; createdAt: string };

function BellIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Bell + modal listing the user's notifications (campaign feedback, team
// changes) — same component as TASKS, with generic title/body/url rows
// instead of task rows.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[] | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Silent — the bell just keeps its previous state
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    const handleTick = () => load();
    window.addEventListener("app:refresh-tick", handleTick);
    return () => window.removeEventListener("app:refresh-tick", handleTick);
  }, []);

  async function markRead(body: { id: string } | { all: true }) {
    try {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      // Best effort
    }
  }

  function markOneRead(id: string) {
    setNotifications((cur) => (cur ? cur.map((n) => (n.id === id ? { ...n, read: true } : n)) : cur));
    setUnreadCount((c) => Math.max(0, c - 1));
    markRead({ id });
  }

  function markAllRead() {
    setNotifications((cur) => (cur ? cur.map((n) => ({ ...n, read: true })) : cur));
    setUnreadCount(0);
    markRead({ all: true });
  }

  return (
    <div className="notification-bell">
      <button
        type="button"
        className="icon-button"
        onClick={() => {
          setOpen(!open);
          if (!open) load();
        }}
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Notifications">
        {unreadCount > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
            <button type="button" onClick={markAllRead} style={{ background: "none", border: "none", color: "var(--color-primary)", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
              Tout marquer comme lu
            </button>
          </div>
        )}
        {loading && notifications === null && <p className="muted small">Chargement...</p>}
        {notifications !== null && notifications.length === 0 && <p className="muted small">Aucune notification pour l&apos;instant.</p>}
        {notifications?.map((n) => {
          const content = (
            <>
              <p className="notification-item-title">{n.title}</p>
              <p className="notification-item-meta">
                {n.body ? `${n.body} · ` : ""}
                {formatDateTimeShort(n.createdAt)}
              </p>
            </>
          );
          return n.url ? (
            <Link
              key={n.id}
              href={n.url}
              className="notification-item"
              data-unread={n.read ? undefined : "true"}
              onClick={() => {
                if (!n.read) markOneRead(n.id);
                setOpen(false);
              }}
            >
              {content}
            </Link>
          ) : (
            <div key={n.id} className="notification-item" data-unread={n.read ? undefined : "true"} onClick={() => !n.read && markOneRead(n.id)}>
              {content}
            </div>
          );
        })}
      </Modal>
    </div>
  );
}
