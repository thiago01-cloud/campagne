// Authentication helpers used by API routes and server pages — same
// architecture as TASKS (lib/auth.ts there):
//
// A single "User" (login account, by phone or email) can own one or more
// Company, and/or hold an "Agent" record (staff) in a company. Login
// therefore happens in two steps:
//   1. Verify phone/email + password (User table).
//   2. Compute the companies accessible to this user. One → connect
//      directly. Several → "pre-session" (authenticated, company not chosen
//      yet) and /login/choose-company. None → pre-session and
//      /create-company.
// The full session cookie contains { userId, companyId, role, agentId },
// where `role` is "OWNER" (user owns the company) or the Agent role. The
// agent's role and status are always re-read from the database, so a role
// change or a blocked account takes effect immediately.
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { signToken, verifyToken } from "./token";
import { prisma } from "./prisma";
import { PRE_SESSION_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from "./constants";
import type { Role, SessionRole } from "./enums";

const PRE_SESSION_DURATION_SECONDS = 60 * 10; // 10 minutes — time to choose or create a company

export type SessionPayload = { userId: string; companyId: string; role: SessionRole; agentId: string; iat?: number };

export function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set. Add it to your .env file (see .env.example).");
  return secret;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

const cookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge,
});

export type AccessibleCompany = { company: { id: string; name: string }; role: SessionRole; agentId: string };

// Companies the user can open: those they own, plus those where they hold
// an active Agent record. Every company has an Agent record for its owner
// (created with the company — see POST /api/companies).
export async function getAccessibleCompanies(userId: string): Promise<AccessibleCompany[]> {
  const agents = await prisma.agent.findMany({
    where: { userId, OR: [{ active: true }, { company: { ownerId: userId } }] },
    include: { company: true },
    orderBy: { joinedAt: "asc" },
  });
  return agents.map((a) => ({
    company: { id: a.company.id, name: a.company.name },
    role: a.company.ownerId === userId ? "OWNER" : (a.role as Role),
    agentId: a.id,
  }));
}

// Login step 1 when no single company can be opened directly
export async function createPreSession(user: { id: string }): Promise<void> {
  const token = await signToken({ userId: user.id }, getSecret(), PRE_SESSION_DURATION_SECONDS);
  (await cookies()).set(PRE_SESSION_COOKIE_NAME, token, cookieOptions(PRE_SESSION_DURATION_SECONDS));
}

export async function clearPreSession(): Promise<void> {
  (await cookies()).set(PRE_SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export async function getPreSessionPayload(): Promise<{ userId: string } | null> {
  const token = (await cookies()).get(PRE_SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken<{ userId: string }>(token, getSecret());
}

// Full session for the chosen company (step 2, or direct login)
export async function createSession(user: { id: string }, c: { companyId: string; role: SessionRole; agentId: string }): Promise<void> {
  const token = await signToken(
    { userId: user.id, companyId: c.companyId, role: c.role, agentId: c.agentId, iat: Math.floor(Date.now() / 1000) },
    getSecret(),
    SESSION_DURATION_SECONDS
  );
  (await cookies()).set(SESSION_COOKIE_NAME, token, cookieOptions(SESSION_DURATION_SECONDS));
  await clearPreSession();
}

export async function clearSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE_NAME, "", { path: "/", maxAge: 0 });
  await clearPreSession();
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken<SessionPayload>(token, getSecret());
}

// Logs `user` in: one accessible company → full session; otherwise a
// pre-session. Returns the next step for the client (same values as TASKS).
export async function startSession(user: { id: string }): Promise<"connected" | "choose_company" | "create_company"> {
  const companies = await getAccessibleCompanies(user.id);
  if (companies.length === 1) {
    const { company, role, agentId } = companies[0];
    await createSession(user, { companyId: company.id, role, agentId });
    return "connected";
  }
  await createPreSession(user);
  return companies.length === 0 ? "create_company" : "choose_company";
}

export type CurrentAgent = {
  id: string; // Agent record in THIS company
  userId: string;
  companyId: string;
  companyName: string;
  ownerId: string;
  isOwner: boolean;
  firstName: string;
  lastName: string;
  fullName: string;
  country: string;
  phone: string;
  email: string | null;
  passwordSetAt: Date | null;
  role: Role; // OWNER acts as ADMIN
  displayRole: SessionRole; // "OWNER" | "ADMIN" | "MANAGER" | "AGENT" | "VIEWER"
};

// The connected agent in the active company — or null (no/invalid cookie,
// account or company deleted, or agent blocked in the meantime).
export async function getCurrentAgent(): Promise<CurrentAgent | null> {
  const payload = await getSessionPayload();
  if (!payload?.userId || !payload.companyId || !payload.agentId) return null;
  const agent = await prisma.agent.findUnique({ where: { id: payload.agentId }, include: { user: true, company: true } });
  if (!agent || agent.userId !== payload.userId || agent.companyId !== payload.companyId) return null;
  const isOwner = agent.company.ownerId === agent.userId;
  if (!agent.active && !isOwner) return null;
  const u = agent.user;
  return {
    id: agent.id,
    userId: u.id,
    companyId: agent.companyId,
    companyName: agent.company.name,
    ownerId: agent.company.ownerId,
    isOwner,
    firstName: u.firstName,
    lastName: u.lastName,
    fullName: `${u.firstName} ${u.lastName}`.trim(),
    country: u.country,
    phone: u.phone,
    email: u.email,
    passwordSetAt: u.passwordSetAt,
    role: isOwner ? "ADMIN" : (agent.role as Role),
    displayRole: isOwner ? "OWNER" : (agent.role as Role),
  };
}

export function needsPasswordSetup(agent: { passwordSetAt: Date | null }): boolean {
  return !agent.passwordSetAt;
}

// Route Handler guard: `{ agent }` or `{ error }` (a JSON response ready to
// be returned as-is). Usage:
//   const { agent, error } = await requireAgent(["ADMIN"]); if (error) return error;
export async function requireAgent(roles?: Role[]) {
  const agent = await getCurrentAgent();
  if (!agent) return { error: NextResponse.json({ error: "Vous n'êtes pas connecté." }, { status: 401 }) };
  if (roles && !roles.includes(agent.role)) {
    return { error: NextResponse.json({ error: "Action non autorisée pour votre rôle." }, { status: 403 }) };
  }
  return { agent };
}

// Roles allowed to import lists and create/launch campaigns
export const WRITER_ROLES: Role[] = ["ADMIN", "MANAGER", "AGENT"];

export function canWrite(agent: { role: Role }): boolean {
  return WRITER_ROLES.includes(agent.role);
}
