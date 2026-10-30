"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ACCEPTED_EXTENSIONS, extensionOf, openWorkbook, readCsv, readSheet } from "@/lib/import/reading";
import { detectColumns } from "@/lib/import/detection";
import { cleanContacts, type CleanContact } from "@/lib/import/cleaning";
import type { ImportedTable } from "@/lib/import/types";
import DataTable from "../../../components/DataTable";
import { Alert, Stat } from "../../../components/ui";

type Settings = { dialCode: string; maxFileMb: number; maxContacts: number };
const STEPS = ["Fichier", "Aperçu et colonnes", "Nettoyage et enregistrement"];

function download(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// Import wizard: the file is read in the browser (CSV with papaparse, Excel
// with SheetJS), turned into a list of { header: value } objects, then
// cleaned; only the extracted rows are sent to POST /api/lists.
export default function ImportWizard({ settings }: { settings: Settings }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [over, setOver] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [table, setTable] = useState<ImportedTable | null>(null);
  const [info, setInfo] = useState("");
  const [phoneColumn, setPhoneColumn] = useState("");
  const [emailColumn, setEmailColumn] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  function applyTable(t: ImportedTable, fileName: string, details: string) {
    if (t.rows.length > settings.maxContacts)
      throw new Error(`Le fichier contient ${t.rows.length.toLocaleString("fr-FR")} lignes ; le maximum est ${settings.maxContacts.toLocaleString("fr-FR")}.`);
    const d = detectColumns(t.headers, t.rows);
    setTable(t);
    setPhoneColumn(d.phoneColumn ?? "");
    setEmailColumn(d.emailColumn ?? "");
    setName((n) => n || fileName.replace(/\.[^.]+$/, ""));
    setInfo(details);
    setStep(1);
  }

  async function pickFile(f: File) {
    setError("");
    setTable(null);
    setWorkbook(null);
    setSheet(null);
    const ext = extensionOf(f.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) return setError(`Format non accepté (${ext || "sans extension"}). Formats acceptés : CSV, XLSX, XLS.`);
    if (f.size === 0) return setError("Le fichier est vide.");
    if (f.size > settings.maxFileMb * 1024 * 1024) return setError(`Le fichier dépasse ${settings.maxFileMb} Mo.`);
    setFile(f);
    setReading(true);
    try {
      if (ext === ".csv") {
        const t = await readCsv(f);
        applyTable(t, f.name, `CSV · séparateur : ${t.delimiter} · encodage : ${t.encoding}`);
      } else {
        const wb = await openWorkbook(f);
        if (wb.SheetNames.length === 0) throw new Error("Le classeur ne contient aucune feuille.");
        if (wb.SheetNames.length === 1) {
          setSheet(wb.SheetNames[0]);
          applyTable(readSheet(wb, wb.SheetNames[0]), f.name, `Excel · feuille « ${wb.SheetNames[0]} »`);
        } else {
          setWorkbook(wb); // the user picks the sheet
        }
      }
    } catch (e) {
      setError((e as Error).message || "Fichier illisible.");
    }
    setReading(false);
  }

  function pickSheet(s: string) {
    if (!workbook || !file) return;
    setError("");
    try {
      setSheet(s);
      applyTable(readSheet(workbook, s), file.name, `Excel · feuille « ${s} »`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const report = useMemo(() => {
    if (!table || (!phoneColumn && !emailColumn)) return null;
    return cleanContacts(table.rows, table.lineNumbers, { phoneColumn: phoneColumn || null, emailColumn: emailColumn || null, dialCode: settings.dialCode });
  }, [table, phoneColumn, emailColumn, settings.dialCode]);
  const rejects = useMemo(() => report?.contacts.filter((c) => !c.valid) ?? [], [report]);

  function exportRejects(format: "csv" | "xlsx") {
    const ws = XLSX.utils.json_to_sheet(rejects.map((r: CleanContact) => ({ ligne: r.row, motif: r.rejectReason ?? "", ...r.data })));
    const base = `rejets-${(name || "import").replace(/[^\w-]+/g, "-")}`;
    if (format === "csv") download("﻿" + XLSX.utils.sheet_to_csv(ws, { FS: ";" }), `${base}.csv`, "text/csv;charset=utf-8");
    else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rejets");
      XLSX.writeFile(wb, `${base}.xlsx`);
    }
  }

  async function save() {
    if (!table || !file) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          sourceFile: file.name,
          sheet,
          columns: table.headers,
          phoneColumn: phoneColumn || null,
          emailColumn: emailColumn || null,
          rows: table.rows,
          lineNumbers: table.lineNumbers,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Enregistrement impossible.");
      router.push(`/dashboard/lists/${data.id}?created=1`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  const columnLabel = (key: string) => {
    const i = table?.headers.indexOf(key) ?? -1;
    const label = i >= 0 ? table!.labels[i] : key;
    return label === key ? key : `${label} (${key})`;
  };

  return (
    <div>
      <ol className="steps-bar">
        {STEPS.map((s, i) => (
          <li key={s} data-state={i === step ? "current" : i < step ? "done" : undefined}>
            <strong>{i + 1}</strong> {s}
          </li>
        ))}
      </ol>

      {error && <div style={{ marginBottom: 16 }}><Alert tone="danger">{error}</Alert></div>}

      {step === 0 && (
        <div className="card">
          <div
            className="dropzone"
            data-over={over ? "true" : undefined}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              const f = e.dataTransfer.files[0];
              if (f) pickFile(f);
            }}
            onClick={() => input.current?.click()}
          >
            <div style={{ fontSize: 30, color: "var(--color-accent)" }}>⇪</div>
            <p style={{ fontWeight: 700, margin: "8px 0 4px" }}>{reading ? "Lecture du fichier…" : "Glissez-déposez votre fichier ici"}</p>
            <p className="muted small" style={{ margin: 0 }}>ou cliquez pour importer · CSV, XLSX, XLS · {settings.maxFileMb} Mo maximum</p>
            <input
              ref={input}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
                e.target.value = "";
              }}
            />
          </div>
          {workbook && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Ce classeur contient plusieurs feuilles : laquelle importer ?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {workbook.SheetNames.map((s) => (
                  <button key={s} className="button-secondary button" onClick={() => pickSheet(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
          <p className="muted small" style={{ marginTop: 18, marginBottom: 0 }}>
            La première ligne du tableau doit contenir les en-têtes (ex. nom, numero, mail, identifiant). Le fichier est lu dans votre navigateur ;
            seules les données extraites sont envoyées au serveur.
          </p>
        </div>
      )}

      {step === 1 && table && (
        <div style={{ display: "grid", gap: 18 }}>
          {table.warnings.map((w) => <Alert key={w}>{w}</Alert>)}
          <div className="card">
            <div className="card-row" style={{ marginBottom: 14 }}>
              <div>
                <h3>{file?.name}</h3>
                <p className="muted small" style={{ margin: "4px 0 0" }}>
                  {info} · {table.rows.length.toLocaleString("fr-FR")} lignes · {table.headers.length} colonnes
                </p>
              </div>
              <button className="button-ghost button button-small" onClick={() => setStep(0)}>Changer de fichier</button>
            </div>
            <div className="field-grid field-grid-3">
              <div className="field">
                <label>Nom de la liste</label>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="field">
                <label>Colonne du numéro de téléphone</label>
                <select value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)}>
                  <option value="">— Aucune —</option>
                  {table.headers.map((c) => <option key={c} value={c}>{columnLabel(c)}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Colonne de l&apos;e-mail</label>
                <select value={emailColumn} onChange={(e) => setEmailColumn(e.target.value)}>
                  <option value="">— Aucune —</option>
                  {table.headers.map((c) => <option key={c} value={c}>{columnLabel(c)}</option>)}
                </select>
              </div>
            </div>
            <p className="muted small" style={{ margin: 0 }}>
              Proposition automatique d&apos;après le nom et le contenu des colonnes, modifiable. Toutes les colonnes restent utilisables comme variables :{" "}
              {table.headers.map((c) => <code key={c} className="code" style={{ marginRight: 4 }}>{`{{${c}}}`}</code>)}
            </p>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Aperçu</h3>
            <DataTable columns={table.headers} rows={table.rows} highlighted={[phoneColumn, emailColumn].filter(Boolean)} />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button className="button-secondary button" onClick={() => setStep(0)}>Retour</button>
            <button className="button" disabled={!phoneColumn && !emailColumn} onClick={() => setStep(2)}>Nettoyer et vérifier →</button>
          </div>
          {!phoneColumn && !emailColumn && <p className="error-message" style={{ textAlign: "right" }}>Indiquez au moins la colonne téléphone ou la colonne e-mail.</p>}
        </div>
      )}

      {step === 2 && table && report && (
        <div style={{ display: "grid", gap: 18 }}>
          <div className="stats-grid">
            <Stat label="Lignes lues" value={report.total.toLocaleString("fr-FR")} />
            <Stat label="Contacts valides" value={report.valid.toLocaleString("fr-FR")} tone="green" />
            <Stat label="Rejetés" value={report.rejected.toLocaleString("fr-FR")} tone="red" detail="format invalide ou manquant" />
            <Stat label="Doublons retirés" value={report.duplicates.toLocaleString("fr-FR")} tone="amber" detail="même numéro ou même e-mail" />
          </div>
          {(report.withoutPhone > 0 || report.withoutEmail > 0) && (
            <Alert tone="info">
              {report.withoutPhone > 0 && <>{report.withoutPhone.toLocaleString("fr-FR")} contact(s) valide(s) sans téléphone exploitable (e-mail uniquement). </>}
              {report.withoutEmail > 0 && <>{report.withoutEmail.toLocaleString("fr-FR")} contact(s) valide(s) sans e-mail exploitable (SMS uniquement).</>}
            </Alert>
          )}
          <Alert tone="info">
            Téléphones mis au format international (ex. 077 00 00 00 → +{settings.dialCode}77000000), e-mails en minuscules. Les contacts désinscrits
            seront retirés à l&apos;enregistrement.
          </Alert>
          <div className="card">
            <div className="card-row" style={{ marginBottom: 10, flexWrap: "wrap" }}>
              <h3>Lignes rejetées et doublons ({rejects.length.toLocaleString("fr-FR")})</h3>
              {rejects.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="button-secondary button button-small" onClick={() => exportRejects("csv")}>Exporter en CSV</button>
                  <button className="button-secondary button button-small" onClick={() => exportRejects("xlsx")}>Exporter en Excel</button>
                </div>
              )}
            </div>
            {rejects.length === 0 ? (
              <p className="muted small">Aucune ligne rejetée.</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: 13.5 }}>
                {rejects.slice(0, 30).map((r) => (
                  <li key={r.row} style={{ display: "flex", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--color-border)" }}>
                    <span className="muted" style={{ width: 72, flexShrink: 0 }}>Ligne {r.row}</span>
                    <span className={r.duplicate ? "tone-amber" : "tone-red"}>{r.rejectReason}</span>
                  </li>
                ))}
                {rejects.length > 30 && <li className="muted" style={{ paddingTop: 8 }}>… et {rejects.length - 30} autre(s) : exportez le fichier pour tout voir.</li>}
              </ul>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button className="button-secondary button" onClick={() => setStep(1)}>Retour</button>
            <button className="button" disabled={saving || report.valid === 0 || !name.trim()} onClick={save}>
              {saving ? "Enregistrement…" : `Enregistrer la liste (${report.valid.toLocaleString("fr-FR")} contacts)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
