// Small shared constants, deliberately with no other dependency: this
// file must be importable without restriction by the middleware (edge
// runtime), by server or client components, etc. Same principle as TASKS.
export const SESSION_COOKIE_NAME = "campagnes_session";

// Temporary cookie between the two steps of login, while an account that
// can reach several companies picks one (see /login/choose-company), or
// while a brand new account creates its first company. Short-lived.
export const PRE_SESSION_COOKIE_NAME = "campagnes_pre_session";

// A session expires after this much inactivity — the middleware re-issues
// the cookie on every visit (sliding expiry), as required by the
// specification ("sessions expirées après inactivité").
export const SESSION_DURATION_SECONDS = 60 * 60 * 8; // 8 hours
export const SESSION_REFRESH_AFTER_SECONDS = 60 * 10; // re-sign at most every 10 minutes

// ---------------------------------------------------------------------
// Application-wide constants: name, description, footer signature and
// color palette. Rendering colors live in app/globals.css (:root CSS
// variables); COLORS mirrors them for the few places a CSS variable
// can't be used (manifest, theme color). Keep both in sync.
// ---------------------------------------------------------------------

export const APP_NAME = "CAMPAGNES";

export const APP_DESCRIPTION =
  "Plateforme d'import de contacts et de campagnes SMS / e-mail : du fichier client à la campagne envoyée et suivie.";

export const FOOTER_SIGNATURE = "By EasyX Corporate, JLNM 2026";

export const COLORS = {
  background: "#f4f7f6",
  surface: "#ffffff",
  border: "#dce4e2",
  text: "#172321",
  textMuted: "#64706d",
  primary: "#0f4c45",
  primaryHover: "#0a3a34",
  primaryTint: "#e2f1ee",
  accent: "#f08c2e",
  accentTint: "#fdeedd",
  danger: "#b3261e",
  success: "#1a8a4c",
};

// Builds a consistent page title, e.g. "Connexion — CAMPAGNES".
export function pageTitle(subtitle?: string): string {
  return subtitle ? `${subtitle} — ${APP_NAME}` : APP_NAME;
}
