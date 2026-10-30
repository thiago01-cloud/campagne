import { prisma } from "./prisma";

// Settings of a company, created with default values on first read.
export async function getSettings(companyId: string) {
  return prisma.settings.upsert({ where: { companyId }, update: {}, create: { companyId } });
}

// Start of the current day in Libreville (UTC+1, no daylight saving).
export function startOfDayLibreville(now = new Date()) {
  const offset = 60 * 60 * 1000;
  const local = new Date(now.getTime() + offset);
  local.setUTCHours(0, 0, 0, 0);
  return new Date(local.getTime() - offset);
}

export async function sendsToday(companyId: string) {
  return prisma.send.count({ where: { sentAt: { gte: startOfDayLibreville() }, campaign: { companyId } } });
}
