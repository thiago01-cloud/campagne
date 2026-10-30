import type { Row } from "./types";
import { EMAIL_REGEX } from "./cleaning";

const STRONG_PHONE_WORDS = ["tel", "telephone", "phone", "mobile", "portable", "gsm", "cellulaire", "cel", "whatsapp"];
const WEAK_PHONE_WORDS = ["numero", "num", "contact"];
const EXCLUDED_WORDS = ["client", "identifiant", "id", "compte", "dossier", "facture", "commande", "matricule", "piece"];
const EMAIL_WORDS = ["mail", "email", "courriel", "e_mail", "adresse_mail", "adresse_email"];

function score(key: string, strong: string[], weak: string[] = []) {
  const tokens = key.split("_");
  if (strong.includes(key)) return 4;
  if (tokens.some((t) => strong.includes(t))) return 3;
  if (weak.includes(key)) return 2;
  if (tokens.some((t) => weak.includes(t)) && !tokens.some((t) => EXCLUDED_WORDS.includes(t))) return 1;
  return 0;
}

function share(rows: Row[], key: string, test: (v: string) => boolean) {
  const sample = rows.slice(0, 200).map((r) => r[key]).filter((v) => v);
  if (sample.length === 0) return 0;
  return sample.filter(test).length / sample.length;
}

/** Suggests the phone and email columns from their names, then from their content. */
export function detectColumns(headers: string[], rows: Row[]) {
  const best = (scores: [string, number][]) => scores.filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  let emailColumn = best(headers.map((h) => [h, score(h, EMAIL_WORDS)]));
  let phoneColumn = best(headers.filter((h) => h !== emailColumn).map((h) => [h, score(h, STRONG_PHONE_WORDS, WEAK_PHONE_WORDS)]));

  if (!emailColumn) {
    const c = headers.map((h) => [h, share(rows, h, (v) => EMAIL_REGEX.test(v.toLowerCase()))] as [string, number]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] >= 0.6) emailColumn = c[0];
  }
  if (!phoneColumn) {
    const isPhone = (v: string) => /^\+?[\d\s.\-()]{8,18}$/.test(v) && v.replace(/\D/g, "").length >= 8;
    const c = headers.filter((h) => h !== emailColumn).map((h) => [h, share(rows, h, isPhone)] as [string, number]).sort((a, b) => b[1] - a[1])[0];
    if (c && c[1] >= 0.6) phoneColumn = c[0];
  }
  return { phoneColumn, emailColumn };
}
