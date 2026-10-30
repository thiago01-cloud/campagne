// Phone number helpers — same rules as TASKS (lib/phone.ts there), shared
// by account forms, login and the contact import.

// Strips spaces, dots, dashes, parentheses and slashes, keeping digits and
// a leading "+".
export function normalizePhone(value: string | undefined | null): string {
  if (!value) return "";
  return value.trim().replace(/[\s.\-()/]/g, "");
}

// Country dial code + number typed locally → international number, e.g.
// composeInternationalPhone("+241", "077 00 00 00") → "+24177000000".
// Only ONE leading trunk zero is stripped (Gabon's post-2021 plan has
// subscriber numbers that themselves start with 0 — see TASKS).
export function composeInternationalPhone(dialCode: string, localNumber: string | undefined | null): string {
  const digitsOnly = normalizePhone(localNumber).replace(/^0/, "");
  return normalizePhone(`${dialCode}${digitsOnly}`);
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+$/.test(value.trim());
}

const DEFAULT_PHONE_DIAL_CODE = "+241";

// Normalizes a number typed in a single freeform field (login, search):
// "+…" kept, "00…" → "+…", anything else is a Gabon national number.
export function resolvePhoneQuery(value: string, dialCode = DEFAULT_PHONE_DIAL_CODE): string {
  const trimmed = normalizePhone(value);
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  // "00" is the international prefix only on a long number: a 9-digit
  // "00…" is a Gabon national number whose subscriber part starts with 0.
  if (trimmed.startsWith("00") && trimmed.length > 10) return `+${trimmed.slice(2)}`;
  return composeInternationalPhone(dialCode, trimmed);
}

// wa.me wants digits only: "+24174582442" → "24174582442".
export function toWhatsAppNumber(phone: string): string {
  return normalizePhone(phone).replace(/^\+/, "");
}

type PhoneResult = { ok: true; value: string } | { ok: false; reason: string };

// Contact import: puts any number found in a file into international
// format ("+24177000000"), with the configured default dial code
// (Settings.dialCode, digits only, e.g. "241") for national numbers.
// Also accepts numbers already prefixed with the dial code but without
// "+" (e.g. "24177000000"), and numbers whose leading 0 was lost by Excel
// (e.g. 77000000).
export function normalizeContactPhone(raw: string, dialCode: string): PhoneResult {
  const text = (raw ?? "").trim();
  if (!text) return { ok: false, reason: "Téléphone manquant" };
  const code = dialCode.replace(/\D/g, "");
  const hasPlus = text.startsWith("+");
  let digits = normalizePhone(text).replace(/^\+/, "");
  if (!/^\d+$/.test(digits)) return { ok: false, reason: `Téléphone invalide « ${text} »` };

  if (hasPlus) {
    // already international
  } else if (digits.startsWith("00") && digits.length > 10) {
    digits = digits.slice(2);
  } else if (code && digits.startsWith(code) && digits.length >= code.length + 8) {
    // already prefixed with the dial code
  } else {
    digits = code + digits.replace(/^0/, "");
  }

  const local = code && digits.startsWith(code) ? digits.length - code.length : digits.length;
  if (digits.length > 15 || local < 7) return { ok: false, reason: `Téléphone invalide « ${text} »` };
  return { ok: true, value: `+${digits}` };
}

// Turns a stored international number back into the national-format digits
// PhoneField's "local number" input expects (same as TASKS): "+24177000000"
// → "077000000". A number from another country can't be prefilled.
export function toLocalNumberForPhoneField(query: string): string {
  const trimmed = normalizePhone(query);
  const withoutIdd = trimmed.startsWith("00") && trimmed.length > 10 ? `+${trimmed.slice(2)}` : trimmed;
  const dialDigits = DEFAULT_PHONE_DIAL_CODE.slice(1);
  if (withoutIdd.startsWith(`+${dialDigits}`)) return `0${withoutIdd.slice(1 + dialDigits.length)}`;
  if (withoutIdd.startsWith("+")) return "";
  return trimmed;
}
