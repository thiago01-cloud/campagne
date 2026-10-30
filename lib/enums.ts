// French labels and allowed values for the enum-like String fields of
// prisma/schema.prisma (SQLite has no native enum — same convention as
// TASKS). Centralized here to stay consistent across forms, filters and
// display pages.

export const ROLES = ["ADMIN", "MANAGER", "AGENT", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];
// Role shown in the session: the company owner is "OWNER" (with ADMIN rights)
export type SessionRole = "OWNER" | Role;

export const ROLE_LABELS: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  MANAGER: "Chef de groupe",
  AGENT: "Agent",
  VIEWER: "Lecteur",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export const CHANNELS = ["SMS", "EMAIL", "BOTH"] as const;
export type Channel = (typeof CHANNELS)[number];
export type SendChannel = "SMS" | "EMAIL";

export const CHANNEL_LABELS: Record<string, string> = {
  SMS: "SMS",
  EMAIL: "E-mail",
  BOTH: "SMS + e-mail",
};

export const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "PREPARING", "SENDING", "COMPLETED", "CANCELLED"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const ACTIVE_CAMPAIGN_STATUSES = ["SCHEDULED", "PREPARING", "SENDING"];

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  SCHEDULED: "Programmée",
  PREPARING: "En préparation",
  SENDING: "En cours",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
};

export const SEND_STATUSES = ["PENDING", "SENT", "DELIVERED", "FAILED"] as const;
export type SendStatus = (typeof SEND_STATUSES)[number];

export const SEND_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SENT: "Envoyé",
  DELIVERED: "Livré",
  FAILED: "Échoué",
};

// Badge tone for each status (see .badge-* in app/globals.css)
export const STATUS_TONES: Record<string, "gray" | "blue" | "green" | "red" | "amber" | "violet"> = {
  DRAFT: "gray",
  SCHEDULED: "violet",
  PREPARING: "amber",
  SENDING: "blue",
  COMPLETED: "green",
  CANCELLED: "red",
  PENDING: "gray",
  SENT: "blue",
  DELIVERED: "green",
  FAILED: "red",
};

// Every notification type, created by lib/notifications.ts and shown by
// the bell (NotificationBell.tsx) + sent as push.
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  CAMPAIGN_LAUNCHED: "Campagne lancée",
  CAMPAIGN_STARTED: "Envoi démarré",
  CAMPAIGN_COMPLETED: "Campagne terminée",
  CAMPAIGN_CANCELLED: "Campagne annulée",
  GROUP_JOINED: "Ajouté à un groupe",
  GROUP_LEADER: "Nommé chef de groupe",
  TEST: "Notification de test",
};
