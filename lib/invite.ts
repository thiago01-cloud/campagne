// Login link for an account added from the team page (and shared again
// later on demand) — same mechanism as TASKS: a signed token, opened via
// GET /api/auth/accept-invite, which logs the account in and sends it to
// /set-password if it has no password yet.
import { signToken } from "./token";
import { getSecret } from "./auth";
import { APP_NAME } from "./constants";

const INVITE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export async function buildInviteUrl(userId: string, companyId: string, origin: string): Promise<string> {
  const token = await signToken({ userId, companyId, purpose: "invite" }, getSecret(), INVITE_TOKEN_TTL_SECONDS);
  return `${origin}/api/auth/accept-invite?token=${encodeURIComponent(token)}`;
}

export function inviteMessage(firstName: string, companyName: string, inviteUrl: string, alreadyActive: boolean): string {
  return alreadyActive
    ? `Bonjour ${firstName}, voici votre lien de connexion à ${APP_NAME} (${companyName}) : ${inviteUrl}`
    : `Bonjour ${firstName}, ${companyName} vous invite à rejoindre ${APP_NAME}. Cliquez sur ce lien pour vous connecter et choisir votre mot de passe : ${inviteUrl}`;
}
