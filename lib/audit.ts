// Audit log of sensitive actions (import, launch, deletion, account and
// settings changes) — required by the specification. Never interrupts the
// action it records.
import { prisma } from "./prisma";
import { toJson } from "./json";

export async function audit(actor: { id: string; companyId: string }, action: string, target?: string | null, details?: unknown) {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: actor.companyId,
        agentId: actor.id,
        action,
        target: target ?? null,
        details: details === undefined ? null : toJson(details),
      },
    });
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}
