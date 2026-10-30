// Creates in-app notifications (bell) for agents and sends the matching
// push to their devices, in one call. Campaign feedback goes first to the
// agent who created the campaign, and also to their direct superior(s) —
// the chef(s) of their group(s), see supervisorsOf() in lib/team.ts.
import { prisma } from "./prisma";
import { sendPushToUsers } from "./push";
import { supervisorsOf } from "./team";
import { NOTIFICATION_TYPE_LABELS } from "./enums";

export type NotificationInput = { type: string; title?: string; body?: string; url?: string; tag?: string };

export async function notify(agentIds: Iterable<string>, n: NotificationInput) {
  const ids = [...new Set(agentIds)];
  if (ids.length === 0) return;
  const title = n.title ?? NOTIFICATION_TYPE_LABELS[n.type] ?? n.type;
  try {
    await prisma.notification.createMany({
      data: ids.map((agentId) => ({ agentId, type: n.type, title, body: n.body ?? null, url: n.url ?? null })),
    });
    const agents = await prisma.agent.findMany({ where: { id: { in: ids } }, select: { userId: true } });
    await sendPushToUsers(
      agents.map((a) => a.userId),
      { title, body: n.body ?? "", url: n.url ?? "/dashboard", tag: n.tag }
    );
  } catch (err) {
    console.error("Notification failed:", err);
  }
}

type CampaignRef = { id: string; name: string; createdById: string };

// Feedback about a campaign: to its creator and/or the creator's supervisors.
export async function notifyCampaign(
  campaign: CampaignRef,
  type: string,
  body: string,
  who: "creator" | "supervisors" | "both" = "both",
  actorId?: string
) {
  const recipients = new Set<string>();
  if (who !== "supervisors") recipients.add(campaign.createdById);
  if (who !== "creator") for (const id of await supervisorsOf(campaign.createdById)) recipients.add(id);
  if (actorId) recipients.delete(actorId); // nobody is notified of their own action
  await notify(recipients, {
    type,
    title: `${NOTIFICATION_TYPE_LABELS[type] ?? type} · ${campaign.name}`,
    body,
    url: `/dashboard/campaigns/${campaign.id}`,
    tag: `campaign-${campaign.id}`,
  });
}
