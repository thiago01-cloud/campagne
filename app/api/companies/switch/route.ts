import { NextResponse } from "next/server";
import { createSession, getAccessibleCompanies, getCurrentAgent } from "@/lib/auth";

// Switches the active company without logging out ("Mes entreprises").
export async function POST(request: Request) {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const companyId = String((await request.json().catch(() => ({}))).companyId || "");
  if (!companyId) return NextResponse.json({ error: "Entreprise invalide." }, { status: 400 });
  if (companyId === agent.companyId) return NextResponse.json({ ok: true });
  const choice = (await getAccessibleCompanies(agent.userId)).find((c) => c.company.id === companyId);
  if (!choice) return NextResponse.json({ error: "Vous n'avez pas accès à cette entreprise." }, { status: 403 });
  await createSession({ id: agent.userId }, { companyId: choice.company.id, role: choice.role, agentId: choice.agentId });
  return NextResponse.json({ ok: true });
}
