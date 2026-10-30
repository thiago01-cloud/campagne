import { after, NextResponse } from "next/server";
import { continueQueue, runQueue } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Processes the send queue. Called:
 *  - by the queue itself, to continue a campaign (runQueueAndContinue);
 *  - by Vercel Cron (vercel.json — once a day on the Hobby plan);
 *  - by an external service every minute (e.g. cron-job.org), needed for
 *    scheduled campaigns to leave on time: GET with
 *    "Authorization: Bearer <CRON_SECRET>", or ?key=<CRON_SECRET>.
 * Same protection as TASKS's crons: skipped when CRON_SECRET is empty (local).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? new URL(req.url).searchParams.get("key");
    if (given !== secret) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const report = await runQueue(50_000);
  if (report && report.remaining > 0) after(() => continueQueue(new URL(req.url).origin));
  return NextResponse.json(report ?? { info: "Un traitement est déjà en cours." });
}
