// Reading CSV and Excel files in the browser
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { matrixToTable } from "./headers";
import type { ImportedTable } from "./types";

export const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export function extensionOf(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/** UTF-8 when possible, otherwise Latin-1 (Windows-1252). */
function decodeText(buffer: ArrayBuffer) {
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "UTF-8" };
  } catch {
    return { text: new TextDecoder("windows-1252").decode(buffer), encoding: "Latin-1" };
  }
}

const DELIMITER_NAMES: Record<string, string> = { ",": "virgule", ";": "point-virgule", "\t": "tabulation", "|": "barre verticale" };

export async function readCsv(file: File): Promise<ImportedTable & { delimiter: string; encoding: string }> {
  const { text, encoding } = decodeText(await file.arrayBuffer());
  const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    header: false,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t", "|"],
  });
  if (result.data.length === 0) throw new Error("Le fichier est vide.");
  const table = matrixToTable(result.data);
  return { ...table, delimiter: DELIMITER_NAMES[result.meta.delimiter] ?? result.meta.delimiter, encoding };
}

export async function openWorkbook(file: File) {
  try {
    return XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  } catch {
    throw new Error("Le fichier Excel est illisible ou protégé par un mot de passe.");
  }
}

function cellToText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return "";
    return new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC" }).format(v);
  }
  // Large integers (phone numbers) keep all their digits
  if (typeof v === "number") return Number.isInteger(v) ? v.toFixed(0) : String(v).replace(".", ",");
  return String(v);
}

export function readSheet(workbook: XLSX.WorkBook, sheetName: string): ImportedTable {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`La feuille « ${sheetName} » est introuvable.`);
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "", blankrows: false });
  return matrixToTable(matrix.map((row) => row.map(cellToText)));
}
