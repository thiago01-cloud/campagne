import { NextResponse } from "next/server";
import { createSession, getAccessibleCompanies, getPreSessionPayload } from "@/lib/auth";

// Second login step, when an account can open several companies: turns
// the pre-session into a full session for the chosen company (TASKS).
export async function POST(request: Request) {
  const pre = await getPreSessionPayload();
  if (!pre?.userId) return NextResponse.json({ error: "Session expirée, merci de vous reconnecter." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const choice = (await getAccessibleCompanies(pre.userId)).find((c) => c.company.id === String(body.companyId || ""));
  if (!choice) return NextResponse.json({ error: "Vous n'avez pas accès à cette entreprise." }, { status: 403 });
  await createSession({ id: pre.userId }, { companyId: choice.company.id, role: choice.role, agentId: choice.agentId });
  return NextResponse.json({ ok: true });
}
