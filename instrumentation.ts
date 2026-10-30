// Locally (QUEUE_INTERNAL="1"), the app processes the send queue itself
// every 10 seconds. On Vercel, leave QUEUE_INTERNAL empty: the queue is
// processed by /api/cron/send-queue.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.QUEUE_INTERNAL === "1") {
    const { runQueue } = await import("./lib/queue");
    const g = globalThis as unknown as { queueTimer?: ReturnType<typeof setInterval> };
    if (g.queueTimer) return;
    g.queueTimer = setInterval(() => void runQueue(8_000), 10_000);
    console.log("Traitement interne de la file d'envoi actif (toutes les 10 s).");
  }
}
