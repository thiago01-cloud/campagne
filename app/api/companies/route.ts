import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, getAccessibleCompanies, getCurrentAgent, getPreSessionPayload } from "@/lib/auth";

// Companies accessible to the current account ("Mes entreprises").
export async function GET() {
  const agent = await getCurrentAgent();
  if (!agent) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const companies = await getAccessibleCompanies(agent.userId);
  return NextResponse.json({
    companies: companies.map(({ company, role }) => ({ id: company.id, name: company.name, role })),
    currentCompanyId: agent.companyId,
  });
}

// Creates a company — mid-signup (pre-session) or as an additional one for
// a connected account — and switches the account into it. The owner gets
// an ADMIN Agent record right away (same as TASKS), so every list,
// campaign and notification can point at an Agent.
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Le nom de l'entreprise est requis." }, { status: 400 });

  const userId = (await getCurrentAgent())?.userId ?? (await getPreSessionPayload())?.userId;
  if (!userId) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const { company, ownerAgent } = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({ data: { name, ownerId: userId } });
    const ownerAgent = await tx.agent.create({ data: { userId, companyId: company.id, role: "ADMIN" } });
    await tx.settings.create({ data: { companyId: company.id } });
    return { company, ownerAgent };
  });

  await createSession({ id: userId }, { companyId: company.id, role: "OWNER", agentId: ownerAgent.id });
  return NextResponse.json({ company }, { status: 201 });
}
