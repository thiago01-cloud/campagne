import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { clearSession, createPreSession, createSession, getAccessibleCompanies, getCurrentAgent } from "@/lib/auth";

// Renaming or deleting a company is reserved for its OWNER, whichever
// company is active in the session (same as TASKS).
async function requireOwnedCompany(id: string) {
  const agent = await getCurrentAgent();
  if (!agent) return { error: NextResponse.json({ error: "Non connecté." }, { status: 401 }) };
  const company = await prisma.company.findUnique({ where: { id } });
  if (!company) return { error: NextResponse.json({ error: "Entreprise introuvable." }, { status: 404 }) };
  if (company.ownerId !== agent.userId) return { error: NextResponse.json({ error: "Réservé au propriétaire de cette entreprise." }, { status: 403 }) };
  return { agent, company };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { company, error } = await requireOwnedCompany(id);
  if (error) return error;
  const name = String((await request.json().catch(() => ({}))).name || "").trim();
  if (!name) return NextResponse.json({ error: "Le nom de l'entreprise est requis." }, { status: 400 });
  const updated = await prisma.company.update({ where: { id: company!.id }, data: { name } });
  return NextResponse.json({ company: updated });
}

// Deletes a company and everything scoped to it (cascades). If it was the
// active company, switches to another one, or back to pre-session.
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { agent, company, error } = await requireOwnedCompany(id);
  if (error) return error;
  await prisma.company.delete({ where: { id: company!.id } });
  if (agent!.companyId === company!.id) {
    const remaining = await getAccessibleCompanies(agent!.userId);
    if (remaining.length > 0) {
      const next = remaining[0];
      await createSession({ id: agent!.userId }, { companyId: next.company.id, role: next.role, agentId: next.agentId });
    } else {
      await clearSession();
      await createPreSession({ id: agent!.userId });
    }
  }
  return NextResponse.json({ ok: true });
}
