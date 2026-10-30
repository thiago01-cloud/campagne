// Send queue processing — the queue is the `sends` table itself (status
// "PENDING"); no Redis. Called right after a launch/retry (via after()),
// by /api/cron/send-queue, and every 10 s locally (instrumentation.ts).
// On Vercel, a run that stops with messages still waiting calls
// /api/cron/send-queue again (runQueueAndContinue), so a campaign goes out
// to the end without an every-minute cron (not available on the Hobby
// plan). Several runs at once are safe: each message is
// locked before being sent. Each company's own settings apply (rate per
// second, daily cap, STOP mention, default sender).
import type { Settings } from "@prisma/client";
import { prisma } from "./prisma";
import { getSettings, sendsToday } from "./settings";
import { checkCompletion, isUnsubscribed, prepareCampaign, renderEmail, renderSms } from "./campaigns";
import { PermanentError, sendEmail, sendSms } from "./providers";
import { SIMULATION_PREFIX } from "./providers/simulation";
import { parseJson } from "./json";

export const MAX_ATTEMPTS = 3;
const LOCK_MS = 5 * 60_000; // a lock older than this is considered abandoned
const PARALLEL = 10;
const BATCH = 200;

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type QueueReport = { prepared: number; sent: number; failed: number; receipts: number; cappedCompanies: number; remaining: number };

type Outcome = { campaignId: string; companyId: string; ok: boolean; final: boolean } | null;

async function sendOne(id: string, previousLock: Date | null, settingsOf: (companyId: string) => Promise<Settings>): Promise<Outcome> {
  const claimed = await prisma.send.updateMany({ where: { id, status: "PENDING", lockedAt: previousLock }, data: { lockedAt: new Date() } });
  if (claimed.count !== 1) return null; // taken by another run

  const send = await prisma.send.findUnique({ where: { id }, include: { campaign: true, contact: { select: { data: true } } } });
  if (!send) return null;
  const { campaignId } = send;
  const companyId = send.campaign.companyId;
  const settings = await settingsOf(companyId);

  if (await isUnsubscribed(companyId, send.channel, send.recipient)) {
    await prisma.send.update({ where: { id }, data: { status: "FAILED", error: "Désinscrit avant l'envoi", lockedAt: null } });
    return { campaignId, companyId, ok: false, final: true };
  }

  const data = parseJson<Record<string, unknown>>(send.contact?.data, {});
  try {
    let providerId: string;
    if (send.channel === "SMS") {
      ({ providerId } = await sendSms(send.recipient, renderSms(send.campaign, data, settings.stopMention)));
    } else {
      const { subject, content } = renderEmail(send.campaign, data, send.id);
      ({ providerId } = await sendEmail(send.recipient, subject, content, send.campaign.emailSender || settings.defaultSender));
    }
    // updateMany: a very fast delivery receipt (webhook) may already have set "DELIVERED"
    await prisma.send.updateMany({ where: { id, status: "PENDING" }, data: { status: "SENT", error: null, nextAttemptAt: null } });
    await prisma.send.update({ where: { id }, data: { providerId, sentAt: new Date(), attempts: { increment: 1 }, lockedAt: null } });
    return { campaignId, companyId, ok: true, final: false };
  } catch (e) {
    const attempts = send.attempts + 1;
    const final = e instanceof PermanentError || attempts >= MAX_ATTEMPTS;
    await prisma.send.update({
      where: { id },
      data: {
        attempts,
        error: ((e as Error).message || "Erreur inconnue").slice(0, 500),
        lockedAt: null,
        ...(final ? { status: "FAILED", nextAttemptAt: null } : { nextAttemptAt: new Date(Date.now() + 30_000 * 2 ** (attempts - 1)) }), // 30 s, then 1 min
      },
    });
    return { campaignId, companyId, ok: false, final };
  }
}

/** Simulation mode: messages "sent" a few seconds ago get a receipt (delivered or, sometimes, failed). */
async function simulateReceipts() {
  const sends = await prisma.send.findMany({
    where: { status: "SENT", providerId: { startsWith: SIMULATION_PREFIX }, sentAt: { lte: new Date(Date.now() - 3000) } },
    select: { id: true },
    take: 5000,
  });
  if (sends.length === 0) return 0;
  const failed: string[] = [];
  const delivered: string[] = [];
  for (const s of sends) (Math.random() < 0.06 ? failed : delivered).push(s.id);
  if (delivered.length) await prisma.send.updateMany({ where: { id: { in: delivered } }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  if (failed.length) await prisma.send.updateMany({ where: { id: { in: failed } }, data: { status: "FAILED", error: "Destinataire injoignable (simulation)" } });
  return sends.length;
}

export async function processQueue(maxDurationMs = 50_000): Promise<QueueReport> {
  const start = Date.now();
  const report: QueueReport = { prepared: 0, sent: 0, failed: 0, receipts: 0, cappedCompanies: 0, remaining: 0 };

  const settingsCache = new Map<string, Settings>();
  const settingsOf = async (companyId: string) => {
    if (!settingsCache.has(companyId)) settingsCache.set(companyId, await getSettings(companyId));
    return settingsCache.get(companyId)!;
  };
  const sentTodayCache = new Map<string, number>();
  const sentTodayOf = async (companyId: string) => {
    if (!sentTodayCache.has(companyId)) sentTodayCache.set(companyId, await sendsToday(companyId));
    return sentTodayCache.get(companyId)!;
  };

  report.receipts = await simulateReceipts();

  // Preparations interrupted by a crash: retry them
  await prisma.campaign.updateMany({ where: { status: "PREPARING", updatedAt: { lt: new Date(Date.now() - LOCK_MS) } }, data: { status: "SCHEDULED" } });
  // Scheduled campaigns whose time has come
  const due = await prisma.campaign.findMany({ where: { status: "SCHEDULED", scheduledAt: { lte: new Date() } }, select: { id: true }, orderBy: { scheduledAt: "asc" } });
  for (const c of due) {
    if (Date.now() - start > maxDurationMs / 2) break;
    if (await prepareCampaign(c.id)) report.prepared++;
  }

  const capped = new Set<string>();
  const touched = new Set<string>();
  while (Date.now() - start < maxDurationMs - 2000) {
    const now = new Date();
    const candidates = await prisma.send.findMany({
      where: {
        status: "PENDING",
        campaign: { status: "SENDING", ...(capped.size ? { companyId: { notIn: [...capped] } } : {}) },
        AND: [
          { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
          { OR: [{ lockedAt: null }, { lockedAt: { lt: new Date(now.getTime() - LOCK_MS) } }] },
        ],
      },
      select: { id: true, lockedAt: true, campaign: { select: { companyId: true } } },
      orderBy: { createdAt: "asc" },
      take: BATCH,
    });
    if (candidates.length === 0) {
      // Nothing ready: wait for the next retry if it falls within this run
      const next = await prisma.send.findFirst({
        where: { status: "PENDING", nextAttemptAt: { gt: now }, campaign: { status: "SENDING", ...(capped.size ? { companyId: { notIn: [...capped] } } : {}) } },
        select: { nextAttemptAt: true },
        orderBy: { nextAttemptAt: "asc" },
      });
      const wait = next?.nextAttemptAt ? next.nextAttemptAt.getTime() - Date.now() : Infinity;
      if (wait > maxDurationMs - 3000 - (Date.now() - start)) break;
      await pause(Math.max(wait, 200));
      continue;
    }

    // This second's share for each company: its rate, within its daily cap
    const quota = new Map<string, number>();
    const picked: typeof candidates = [];
    for (const c of candidates) {
      const companyId = c.campaign.companyId;
      if (!quota.has(companyId)) {
        const s = await settingsOf(companyId);
        const remaining = s.dailyCap - (await sentTodayOf(companyId));
        if (remaining <= 0) capped.add(companyId);
        quota.set(companyId, Math.max(0, Math.min(Math.max(1, s.ratePerSecond), remaining)));
      }
      const left = quota.get(companyId)!;
      if (left > 0) {
        picked.push(c);
        quota.set(companyId, left - 1);
      }
    }
    if (picked.length === 0) break; // every company with pending messages reached its daily cap

    const tick = Date.now();
    for (let i = 0; i < picked.length; i += PARALLEL) {
      const outcomes = await Promise.all(picked.slice(i, i + PARALLEL).map((c) => sendOne(c.id, c.lockedAt, settingsOf)));
      for (const o of outcomes) {
        if (!o) continue;
        touched.add(o.campaignId);
        if (o.ok) {
          report.sent++;
          sentTodayCache.set(o.companyId, (sentTodayCache.get(o.companyId) ?? 0) + 1);
        } else if (o.final) report.failed++;
      }
    }
    const elapsed = Date.now() - tick;
    if (elapsed < 1000) await pause(1000 - elapsed);
  }

  report.cappedCompanies = capped.size;
  for (const id of touched) await checkCompletion(id);
  // Messages still waiting (not held by another run, company not capped)
  const lockLimit = new Date(Date.now() - LOCK_MS);
  report.remaining = await prisma.send.count({
    where: {
      status: "PENDING",
      campaign: { status: "SENDING", ...(capped.size ? { companyId: { notIn: [...capped] } } : {}) },
      OR: [{ lockedAt: null }, { lockedAt: { lt: lockLimit } }],
    },
  });
  return report;
}

const g = globalThis as unknown as { queueRunning?: boolean };

/** Starts a run unless one is already in progress in this process. */
export async function runQueue(maxDurationMs = 50_000) {
  if (g.queueRunning) return null;
  g.queueRunning = true;
  try {
    const report = await processQueue(maxDurationMs);
    if (report.sent || report.failed || report.prepared)
      console.log(
        `File d'envoi : ${report.prepared} campagne(s) préparée(s), ${report.sent} envoyé(s), ${report.failed} échec(s)` +
          (report.cappedCompanies ? ` — plafond quotidien atteint pour ${report.cappedCompanies} entreprise(s)` : "")
      );
    return report;
  } catch (e) {
    console.error("File d'envoi :", e);
    return null;
  } finally {
    g.queueRunning = false;
  }
}

/**
 * Calls /api/cron/send-queue so that a new run takes over (a Vercel
 * function is limited in time). `origin` is the app's own address (from the
 * request). Only the request needs to leave: the next run goes on by itself.
 */
export async function continueQueue(origin: string) {
  if (process.env.QUEUE_INTERNAL === "1") return; // local: the 10-second timer takes over
  const secret = process.env.CRON_SECRET;
  await fetch(`${origin}/api/cron/send-queue`, {
    headers: secret ? { authorization: `Bearer ${secret}` } : {},
    signal: AbortSignal.timeout(5000),
  }).catch(() => {});
}

/** Runs the queue, then hands over to a new run if messages are still waiting. */
export async function runQueueAndContinue(origin: string, maxDurationMs = 50_000) {
  const report = await runQueue(maxDurationMs);
  if (report && report.remaining > 0) await continueQueue(origin);
  return report;
}
