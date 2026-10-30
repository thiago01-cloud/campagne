import type { ImportedTable, Row } from "./types";

/** Header → key usable as a message variable: « N° Téléphone » → « n_telephone » */
export function keyFromHeader(raw: string) {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Cleans headers: spaces removed, keys normalized, duplicates renamed (numero, numero_2…) */
export function cleanHeaders(raw: string[]) {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let key = keyFromHeader(String(h ?? ""));
    if (!key) key = `colonne_${i + 1}`;
    if (/^[0-9]/.test(key)) key = `c_${key}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n > 1) {
      let candidate = `${key}_${n}`;
      while (seen.has(candidate)) candidate = `${candidate}_`;
      seen.set(candidate, 1);
      return candidate;
    }
    return key;
  });
}

const isEmpty = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/**
 * Turns a matrix (rows × cells) into a list of objects. The first non-empty
 * row gives the keys; fully empty rows are skipped.
 */
export function matrixToTable(matrix: unknown[][]): ImportedTable {
  let start = 0;
  while (start < matrix.length && (matrix[start] ?? []).every(isEmpty)) start++;
  if (start >= matrix.length) throw new Error("Le fichier est vide.");

  const headerRow = matrix[start].map((c) => (isEmpty(c) ? "" : String(c).trim()));
  let width = headerRow.length;
  while (width > 0 && headerRow[width - 1] === "") width--;
  if (width === 0) throw new Error("Le fichier n'a pas de ligne d'en-tête.");

  const labels = headerRow.slice(0, width).map((l, i) => l || `Colonne ${i + 1}`);
  const headers = cleanHeaders(headerRow.slice(0, width));

  const rows: Row[] = [];
  const lineNumbers: number[] = [];
  let extraColumns = false;
  for (let r = start + 1; r < matrix.length; r++) {
    const cells = matrix[r] ?? [];
    if (cells.every(isEmpty)) continue;
    if (cells.slice(width).some((c) => !isEmpty(c))) extraColumns = true;
    const row: Row = {};
    headers.forEach((key, i) => {
      row[key] = isEmpty(cells[i]) ? "" : String(cells[i]).trim();
    });
    rows.push(row);
    lineNumbers.push(r + 1);
  }
  if (rows.length === 0) throw new Error("Le fichier ne contient aucune ligne de données sous l'en-tête.");

  const warnings: string[] = [];
  if (labels.some((l) => /@/.test(l) || /^\+?[\d\s.\-]{8,}$/.test(l)))
    warnings.push("La première ligne ressemble à des données (numéro ou e-mail) : vérifiez que le fichier contient bien une ligne d'en-tête.");
  if (extraColumns)
    warnings.push("Certaines lignes contiennent des valeurs dans des colonnes sans en-tête : elles ont été ignorées.");

  return { headers, labels, rows, lineNumbers, warnings };
}
