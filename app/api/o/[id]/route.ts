import { prisma } from "@/lib/prisma";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

/** E-mail open-tracking pixel */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.send.updateMany({ where: { id, channel: "EMAIL", openedAt: null }, data: { openedAt: new Date() } }).catch(() => undefined);
  return new Response(new Uint8Array(PIXEL), { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
}
