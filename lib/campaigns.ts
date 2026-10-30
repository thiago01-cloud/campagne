// Campaign server logic (no Next.js dependency): preparation of the sends,
// delivery statuses, retries, end-of-campaign detection + notifications.
import type { Campaign, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { fillVariables } from "./messages/variables";
import { finalSmsText } from "./messages/sms";
import { appUrl, buildEmail } from "./messages/email";
import { notifyCampaign } from "./notifications";
import { formatNumber } from "./format";
import type { SendChannel } from "./enums";

type Data = Record<string, unknown>;

export function channelsOf(channel: string): SendChannel[] {
  return channel === "BOTH" ? ["SMS", "EMAIL"] : [channel as SendChannel];
}

export function renderSms(c: Pick<Campaign, "smsMessage" | "stopMention">, data: Data, stopText: string) {
  return finalSmsText(fillVariables(c.smsMessage ?? "", data), c.stopMention, stopText);
}

export function renderEmail(c: Pick<Campaign, "emailSubject" | "emailBody">, data: Data, sendId: string | null /* null = test */) {
  const base = appUrl();
  const subject = fillVariables(c.emailSubject ?? "", data);
  const content = buildEmail(fillVariables(c.emailBody ?? "", data), {
    unsubscribeUrl: sendId ? `${base}/unsubscribe/${sendId}` : `${base}/unsubscribe/test`,
    pixelUrl: sendId ? `${base}/api/o/${sendId}` : null,
  });
  return { subject, content };
}

export async function isUnsubscribed(companyId: string, channel: string, recipient: string) {
  const u = await prisma.unsubscribe.findFirst({
    where: channel === "SMS" ? { companyId, phone: recipient, channel: "SMS" } : { companyId, email: recipient, channel: "EMAIL" },
    select: { id: true },
  });
  return !!u;
}

/**
 * Creates the sends of a scheduled campaign whose time has come (one per
 * contact and channel, unsubscribed recipients excluded), in a single
 * transaction. Returns true if this call prepared the campaign.
 */
export async function prepareCampaign(campaignId: string) {
  const claimed = await prisma.campaign.updateMany({ where: { id: campaignId, status: "SCHEDULED" }, data: { status: "PREPARING" } });
  if (claimed.count !== 1) return false;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign?.listId) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "CANCELLED", completedAt: new Date() } });
    return false;
  }

  const unsubscribes = await prisma.unsubscribe.findMany({ where: { companyId: campaign.companyId }, select: { phone: true, email: true, channel: true } });
  const blockedPhones = new Set(unsubscribes.filter((u) => u.channel === "SMS" && u.phone).map((u) => u.phone!));
  const blockedEmails = new Set(unsubscribes.filter((u) => u.channel === "EMAIL" && u.email).map((u) => u.email!));
  const channels = channelsOf(campaign.channel);

  const rows: Prisma.SendCreateManyInput[] = [];
  let cursor: string | undefined;
  for (;;) {
    const contacts = await prisma.contact.findMany({
      where: { listId: campaign.listId, valid: true },
      select: { id: true, phone: true, email: true },
      orderBy: { id: "asc" },
      take: 5000,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (contacts.length === 0) break;
    cursor = contacts[contacts.length - 1].id;
    for (const c of contacts) {
      if (channels.includes("SMS") && c.phone && !blockedPhones.has(c.phone))
        rows.push({ campaignId, contactId: c.id, channel: "SMS", recipient: c.phone });
      if (channels.includes("EMAIL") && c.email && !blockedEmails.has(c.email))
        rows.push({ campaignId, contactId: c.id, channel: "EMAIL", recipient: c.email });
    }
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const ok = await tx.campaign.updateMany({
          where: { id: campaignId, status: "PREPARING" }, // cancelled meanwhile: give up
          data: rows.length ? { status: "SENDING", startedAt: now } : { status: "COMPLETED", startedAt: now, completedAt: now },
        });
        if (ok.count !== 1) throw new Error("CANCELLED");
        for (let i = 0; i < rows.length; i += 2000) await tx.send.createMany({ data: rows.slice(i, i + 2000) });
      },
      { timeout: 120_000, maxWait: 10_000 }
    );
  } catch (e) {
    if ((e as Error).message === "CANCELLED") return false;
    // Failure: back to "scheduled", retried on the next queue run
    await prisma.campaign.updateMany({ where: { id: campaignId, status: "PREPARING" }, data: { status: "SCHEDULED" } });
    throw e;
  }

  // A campaign scheduled for later: its creator (and chef) learn that sending has started.
  const wasScheduled =
    campaign.scheduledAt && campaign.launchedAt && campaign.scheduledAt.getTime() - campaign.launchedAt.getTime() > 60_000;
  if (wasScheduled)
    await notifyCampaign(campaign, "CAMPAIGN_STARTED", `L'envoi programmé démarre : ${formatNumber(rows.length)} message(s).`, "both");
  if (rows.length === 0) await notifyCampaign(campaign, "CAMPAIGN_COMPLETED", "Aucun destinataire à contacter (liste vide ou désinscrits).", "both");
  return true;
}

/** Marks the campaign "completed" once no message is pending, and notifies. */
export async function checkCompletion(campaignId: string) {
  const pending = await prisma.send.count({ where: { campaignId, status: "PENDING" } });
  if (pending > 0) return;
  const done = await prisma.campaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  if (done.count !== 1) return;
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return;
  const groups = await prisma.send.groupBy({ by: ["status"], where: { campaignId }, _count: true });
  const count = (s: string) => groups.find((g) => g.status === s)?._count ?? 0;
  const sent = count("SENT") + count("DELIVERED");
  await notifyCampaign(
    campaign,
    "CAMPAIGN_COMPLETED",
    `${formatNumber(sent)} envoyé(s), ${formatNumber(count("FAILED"))} échec(s).`,
    "both"
  );
}

/** Delivery status reported by a provider (webhook) */
export async function applyProviderStatus(providerId: string, status: "delivered" | "failed" | "sent", error?: string) {
  const now = new Date();
  if (status === "delivered")
    return prisma.send.updateMany({ where: { providerId }, data: { status: "DELIVERED", deliveredAt: now, error: null } });
  if (status === "failed")
    return prisma.send.updateMany({ where: { providerId }, data: { status: "FAILED", error: error ?? "Échec signalé par le fournisseur" } });
  return prisma.send.updateMany({ where: { providerId, status: "PENDING" }, data: { status: "SENT", sentAt: now } });
}

export const NO_RETRY_ERRORS = ["Désinscrit", "Campagne annulée"];

/** Puts a campaign's failed messages back in the queue. Returns how many. */
export async function retryFailures(campaignId: string) {
  const failed = await prisma.send.findMany({
    where: {
      campaignId,
      status: "FAILED",
      OR: [{ error: null }, { NOT: NO_RETRY_ERRORS.map((e) => ({ error: { startsWith: e } })) }],
    },
    select: { id: true },
  });
  if (failed.length === 0) return 0;
  const ids = failed.map((f) => f.id);
  for (let i = 0; i < ids.length; i += 5000)
    await prisma.send.updateMany({
      where: { id: { in: ids.slice(i, i + 5000) } },
      data: { status: "PENDING", error: null, attempts: 0, providerId: null, sentAt: null, deliveredAt: null, nextAttemptAt: null, lockedAt: null },
    });
  await prisma.campaign.update({ where: { id: campaignId }, data: { status: "SENDING", completedAt: null } });
  return ids.length;
}
