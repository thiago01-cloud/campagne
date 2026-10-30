import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canSeeItem } from "@/lib/team";
import { parseJson } from "@/lib/json";

/** Sample of valid contacts, for message previews */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const list = await prisma.contactList.findUnique({ where: { id }, select: { companyId: true, createdById: true } });
  if (!list || !(await canSeeItem(agent!, list))) return NextResponse.json({ error: "Liste introuvable." }, { status: 404 });
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 50) || 50, 200);
  const contacts = await prisma.contact.findMany({
    where: { listId: id, valid: true },
    select: { id: true, phone: true, email: true, data: true },
    orderBy: { row: "asc" },
    take: limit,
  });
  return NextResponse.json({ contacts: contacts.map((c) => ({ ...c, data: parseJson<Record<string, string>>(c.data, {}) })) });
}
