import type { Row } from "./types";
import { normalizeContactPhone } from "../phone";

export const EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export type CleaningOptions = {
  phoneColumn: string | null;
  emailColumn: string | null;
  dialCode: string; // e.g. "241"
};

type Result = { ok: true; value: string } | { ok: false; reason: string };

/** Checks the format and lowercases the address. */
export function normalizeEmail(raw: string): Result {
  const text = (raw ?? "").trim().toLowerCase().replace(/^mailto:/, "");
  if (!text) return { ok: false, reason: "E-mail manquant" };
  if (!EMAIL_REGEX.test(text)) return { ok: false, reason: `E-mail invalide « ${raw.trim()} »` };
  return { ok: true, value: text };
}

export type CleanContact = {
  row: number;
  phone: string | null;
  email: string | null;
  data: Row;
  valid: boolean;
  duplicate: boolean;
  rejectReason: string | null;
};

export type CleaningReport = {
  total: number;
  valid: number;
  rejected: number;
  duplicates: number;
  withoutPhone: number; // valid contacts with no usable phone
  withoutEmail: number; // valid contacts with no usable email
  contacts: CleanContact[];
};

/**
 * Cleans and validates contacts: formats, duplicates (same phone or same
 * email). A contact is valid if it has at least one usable channel among
 * the mapped columns.
 */
export function cleanContacts(rows: Row[], lineNumbers: number[], o: CleaningOptions): CleaningReport {
  const phonesSeen = new Map<string, number>();
  const emailsSeen = new Map<string, number>();
  const contacts: CleanContact[] = [];
  let valid = 0;
  let rejected = 0;
  let duplicates = 0;
  let withoutPhone = 0;
  let withoutEmail = 0;

  rows.forEach((data, i) => {
    const row = lineNumbers[i] ?? i + 2;
    const reasons: string[] = [];
    let phone: string | null = null;
    let email: string | null = null;

    if (o.phoneColumn) {
      const r = normalizeContactPhone(data[o.phoneColumn] ?? "", o.dialCode);
      if (r.ok) phone = r.value;
      else reasons.push(r.reason);
    }
    if (o.emailColumn) {
      const r = normalizeEmail(data[o.emailColumn] ?? "");
      if (r.ok) email = r.value;
      else reasons.push(r.reason);
    }

    if (!phone && !email) {
      rejected++;
      contacts.push({ row, phone: null, email: null, data, valid: false, duplicate: false, rejectReason: reasons.join(" ; ") || "Aucun moyen de contact" });
      return;
    }

    const phoneRow = phone ? phonesSeen.get(phone) : undefined;
    const emailRow = email ? emailsSeen.get(email) : undefined;
    if (phoneRow !== undefined || emailRow !== undefined) {
      duplicates++;
      const reason =
        phoneRow !== undefined ? `Doublon de la ligne ${phoneRow} (même numéro)` : `Doublon de la ligne ${emailRow} (même e-mail)`;
      contacts.push({ row, phone, email, data, valid: false, duplicate: true, rejectReason: reason });
      return;
    }

    if (phone) phonesSeen.set(phone, row);
    if (email) emailsSeen.set(email, row);
    if (o.phoneColumn && !phone) withoutPhone++;
    if (o.emailColumn && !email) withoutEmail++;
    valid++;
    contacts.push({ row, phone, email, data, valid: true, duplicate: false, rejectReason: null });
  });

  return { total: rows.length, valid, rejected, duplicates, withoutPhone, withoutEmail, contacts };
}
