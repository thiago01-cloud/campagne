import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAgent } from "@/lib/auth";
import { canSeeItem } from "@/lib/team";
import { parseJson } from "@/lib/json";
import { exportResponse } from "@/lib/export";
import { fileSlug } from "@/lib/format";

/** Export of rejected rows (invalid format, duplicate, unsubscribed) with their reason */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { agent, error } = await requireAgent();
  if (error) return error;
  const { id } = await params;
  const list = await prisma.contactList.findUnique({ where: { id }, select: { name: true, companyId: true, createdById: true } });
  if (!list || !(await canSeeItem(agent!, list))) return NextResponse.json({ error: "Liste introuvable." }, { status: 404 });
  const rejects = await prisma.contact.findMany({ where: { listId: id, valid: false }, orderBy: { row: "asc" }, select: { row: true, rejectReason: true, data: true } });
  const rows = rejects.map((r) => ({ ligne: r.row, motif: r.rejectReason ?? "", ...parseJson<Record<string, string>>(r.data, {}) }));
  const format = new URL(req.url).searchParams.get("format") ?? "csv";
  return exportResponse(rows.length ? rows : [{ ligne: "", motif: "Aucune ligne rejetée" }], `rejets-${fileSlug(list.name)}`, format);
}
