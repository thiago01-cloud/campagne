import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { visibilityFilter } from "@/lib/team";
import { parseJson } from "@/lib/json";
import type { Role } from "@/lib/enums";

/** Lists (visible to the user) and settings needed by the campaign editor */
export async function editorData(agent: { id: string; role: Role; companyId: string }) {
  const [lists, s] = await Promise.all([
    prisma.contactList.findMany({
      where: { validCount: { gt: 0 }, ...(await visibilityFilter(agent)) },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, validCount: true, columns: true, phoneColumn: true, emailColumn: true },
    }),
    getSettings(agent.companyId),
  ]);
  return {
    lists: lists.map((l) => ({ ...l, columns: parseJson<string[]>(l.columns, []) })),
    settings: { stopMention: s.stopMention, defaultSender: s.defaultSender },
  };
}
