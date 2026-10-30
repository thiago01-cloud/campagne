"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { countSms, finalSmsText } from "@/lib/messages/sms";
import { fillVariables, unknownVariables } from "@/lib/messages/variables";
import { buildEmail } from "@/lib/messages/email";
import { Alert } from "../../components/ui";

type ListOption = { id: string; name: string; validCount: number; columns: string[]; phoneColumn: string | null; emailColumn: string | null };
type PreviewContact = { id: string; phone: string | null; email: string | null; data: Record<string, string> };
type Channel = "SMS" | "EMAIL" | "BOTH";
export type InitialCampaign = {
  id: string;
  name: string;
  channel: Channel;
  listId: string | null;
  smsMessage: string | null;
  stopMention: boolean;
  emailSubject: string | null;
  emailSender: string | null;
  emailBody: string | null;
};
type Field = "sms" | "subject" | "body";

const CHANNELS: { value: Channel; title: string; text: string }[] = [
  { value: "SMS", title: "SMS", text: "Message court sur mobile" },
  { value: "EMAIL", title: "E-mail", text: "Objet, expéditeur et corps" },
  { value: "BOTH", title: "Les deux", text: "Un SMS et un e-mail par contact" },
];

export default function CampaignEditor({
  lists,
  settings,
  initial,
  initialListId,
}: {
  lists: ListOption[];
  settings: { stopMention: string; defaultSender: string | null };
  initial?: InitialCampaign;
  initialListId?: string;
}) {
  const router = useRouter();
  const [id, setId] = useState(initial?.id ?? null);
  const [name, setName] = useState(initial?.name ?? "");
  const [listId, setListId] = useState(initial?.listId ?? (initialListId && lists.some((l) => l.id === initialListId) ? initialListId : lists[0]?.id ?? ""));
  const [channel, setChannel] = useState<Channel>(initial?.channel ?? "SMS");
  const [smsMessage, setSmsMessage] = useState(initial?.smsMessage ?? "");
  const [stopMention, setStopMention] = useState(initial?.stopMention ?? true);
  const [emailSubject, setEmailSubject] = useState(initial?.emailSubject ?? "");
  const [emailSender, setEmailSender] = useState(initial?.emailSender ?? settings.defaultSender ?? "");
  const [emailBody, setEmailBody] = useState(initial?.emailBody ?? "");
  const [contacts, setContacts] = useState<PreviewContact[]>([]);
  const [contactId, setContactId] = useState("");
  const [testPhone, setTestPhone] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [mode, setMode] = useState<"now" | "later">("now");
  const [when, setWhen] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState<null | "draft" | "test" | "launch">(null);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);

  const smsRef = useRef<HTMLTextAreaElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<Field>("sms");

  const list = lists.find((l) => l.id === listId);
  const columns = list?.columns ?? [];
  const withSms = channel !== "EMAIL";
  const withEmail = channel !== "SMS";

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;
    fetch(`/api/lists/${listId}/contacts?limit=50`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setContacts(d.contacts ?? []);
        setContactId(d.contacts?.[0]?.id ?? "");
      })
      .catch(() => setContacts([]));
    return () => {
      cancelled = true;
    };
  }, [listId]);

  const contact = contacts.find((c) => c.id === contactId);
  const data = useMemo(() => contact?.data ?? {}, [contact]);
  const smsPreview = finalSmsText(fillVariables(smsMessage, data), stopMention, settings.stopMention);
  const count = countSms(smsPreview);
  const maxSegments = useMemo(
    () => contacts.reduce((m, c) => Math.max(m, countSms(finalSmsText(fillVariables(smsMessage, c.data), stopMention, settings.stopMention)).segments), 0),
    [contacts, smsMessage, stopMention, settings.stopMention]
  );
  const unknown = unknownVariables(`${withSms ? smsMessage : ""} ${withEmail ? `${emailSubject} ${emailBody}` : ""}`, columns);
  const emailPreview = useMemo(() => buildEmail(fillVariables(emailBody || " ", data), { unsubscribeUrl: "#desinscription" }).html, [emailBody, data]);

  function insertVariable(key: string) {
    const field = lastField.current;
    const el = field === "sms" ? smsRef.current : field === "subject" ? subjectRef.current : bodyRef.current;
    const value = field === "sms" ? smsMessage : field === "subject" ? emailSubject : emailBody;
    const setter = field === "sms" ? setSmsMessage : field === "subject" ? setEmailSubject : setEmailBody;
    const token = `{{${key}}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    setter(value.slice(0, start) + token + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const payload = () => ({ name, channel, listId, smsMessage, stopMention, emailSubject, emailSender, emailBody });

  async function call(url: string, method: string, body: unknown) {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Erreur inattendue.");
    return d;
  }

  async function save() {
    const d = id ? await call(`/api/campaigns/${id}`, "PUT", payload()) : await call("/api/campaigns", "POST", payload());
    if (!id) {
      setId(d.id);
      window.history.replaceState(null, "", `/dashboard/campaigns/${d.id}/edit`);
    }
    return d.id as string;
  }

  async function run(kind: "draft" | "test" | "launch", fn: () => Promise<void>) {
    setBusy(kind);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ tone: "danger", text: (e as Error).message });
    }
    setBusy(null);
  }

  const saveDraft = () =>
    run("draft", async () => {
      await save();
      setMessage({ tone: "success", text: "Brouillon enregistré." });
    });

  const sendTest = () =>
    run("test", async () => {
      const d = await call("/api/campaigns/test", "POST", { ...payload(), contactId: contactId || null, phone: withSms ? testPhone : null, email: withEmail ? testEmail : null });
      setMessage({ tone: "success", text: d.message });
    });

  const launch = () =>
    run("launch", async () => {
      if (mode === "later" && !when) throw new Error("Choisissez la date et l'heure d'envoi.");
      const campaignId = await save();
      await call(`/api/campaigns/${campaignId}/launch`, "POST", { consent, scheduledAt: mode === "later" ? new Date(when).toISOString() : null });
      router.push(`/dashboard/campaigns/${campaignId}`);
      router.refresh();
    });

  const contactLabel = (c: PreviewContact) => [...columns.slice(0, 2).map((k) => c.data[k]).filter(Boolean), c.phone ?? c.email].filter(Boolean).join(" · ");

  return (
    <div className="editor-layout">
      <div style={{ display: "grid", gap: 18, minWidth: 0 }}>
        <div className="card">
          <h3 style={{ marginBottom: 14 }}>1. Campagne</h3>
          <div className="field-grid field-grid-2">
            <div className="field">
              <label>Nom de la campagne</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Rappel échéance novembre" />
            </div>
            <div className="field">
              <label>Liste de contacts</label>
              <select value={listId} onChange={(e) => setListId(e.target.value)}>
                {lists.length === 0 && <option value="">Aucune liste disponible</option>}
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>{l.name} ({l.validCount.toLocaleString("fr-FR")} contacts)</option>
                ))}
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Canal</label>
            <div className="choice-grid">
              {CHANNELS.map((c) => (
                <button key={c.value} type="button" className="choice-card" data-active={channel === c.value ? "true" : undefined} onClick={() => setChannel(c.value)}>
                  <strong>{c.title}</strong>
                  <div className="muted small">{c.text}</div>
                </button>
              ))}
            </div>
            {list && withSms && !list.phoneColumn && <p className="tone-amber small">Cette liste n&apos;a pas de colonne téléphone : aucun SMS ne sera envoyé.</p>}
            {list && withEmail && !list.emailColumn && <p className="tone-amber small">Cette liste n&apos;a pas de colonne e-mail : aucun e-mail ne sera envoyé.</p>}
          </div>
        </div>

        <div className="card">
          <h3>2. Message</h3>
          <p className="muted small" style={{ margin: "6px 0 10px" }}>
            Cliquez sur une variable pour l&apos;insérer à l&apos;endroit du curseur. Valeur de remplacement si la case est vide : <span className="code">{"{{nom|Client}}"}</span>
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
            {columns.map((c) => (
              <button key={c} type="button" className="variable-chip" onMouseDown={(e) => e.preventDefault()} onClick={() => insertVariable(c)}>
                {`{{${c}}}`}
              </button>
            ))}
          </div>

          {withSms && (
            <div className="field">
              <label>Texte du SMS</label>
              <textarea
                ref={smsRef}
                rows={5}
                value={smsMessage}
                onFocus={() => (lastField.current = "sms")}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Bonjour {{nom}}, votre identifiant est {{identifiant}}."
              />
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, color: "var(--color-text)" }}>
                  <input type="checkbox" checked={stopMention} onChange={(e) => setStopMention(e.target.checked)} />
                  SMS marketing : ajouter « {settings.stopMention} »
                </label>
                <span className={count.segments > 1 ? "tone-amber" : "muted"}>
                  {count.characters} / {count.perSegment} car. · {count.segments} SMS · {count.encoding}
                </span>
              </div>
              {count.encoding === "Unicode" && (
                <span className="tone-amber small">
                  Caractères spéciaux détectés ({count.specialCharacters.slice(0, 8).join(" ")}) : 70 caractères par SMS au lieu de 160.
                </span>
              )}
              {maxSegments > count.segments && <span className="muted small">Selon les contacts, ce message peut atteindre {maxSegments} SMS (sur l&apos;échantillon).</span>}
            </div>
          )}

          {withEmail && (
            <>
              <div className="field-grid field-grid-2">
                <div className="field">
                  <label>Expéditeur</label>
                  <input value={emailSender} onChange={(e) => setEmailSender(e.target.value)} placeholder="GAM Gabon <contact@gam.ga>" />
                </div>
                <div className="field">
                  <label>Objet</label>
                  <input ref={subjectRef} value={emailSubject} onFocus={() => (lastField.current = "subject")} onChange={(e) => setEmailSubject(e.target.value)} />
                </div>
              </div>
              <div className="field">
                <label>Corps de l&apos;e-mail</label>
                <textarea
                  ref={bodyRef}
                  rows={9}
                  value={emailBody}
                  onFocus={() => (lastField.current = "body")}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder={"Bonjour {{nom|Madame, Monsieur}},\n\n…"}
                />
                <span className="muted small">Un lien de désinscription est ajouté automatiquement en bas de chaque e-mail.</span>
              </div>
            </>
          )}
          {unknown.length > 0 && (
            <Alert>Variable(s) absente(s) de la liste : {unknown.map((v) => `{{${v}}}`).join(", ")}. Elles seront remplacées par la valeur de secours ou laissées vides.</Alert>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>3. Envoi test</h3>
          <div className="field-grid field-grid-2">
            {withSms && (
              <div className="field">
                <label>Votre numéro</label>
                <input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="077 00 00 00" />
              </div>
            )}
            {withEmail && (
              <div className="field">
                <label>Votre adresse e-mail</label>
                <input type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              </div>
            )}
          </div>
          <button className="button-secondary button" onClick={sendTest} disabled={busy !== null}>{busy === "test" ? "Envoi…" : "Envoyer un test"}</button>
          <p className="muted small" style={{ marginBottom: 0 }}>Le test utilise les données du contact choisi dans l&apos;aperçu.</p>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 14 }}>4. Lancement</h3>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, fontSize: 14 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="radio" checked={mode === "now"} onChange={() => setMode("now")} /> Envoyer maintenant
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="radio" checked={mode === "later"} onChange={() => setMode("later")} /> Programmer
            </label>
            {mode === "later" && (
              <div className="field" style={{ margin: 0 }}>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
            )}
          </div>
          <label className="alert alert-info" style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 14, cursor: "pointer" }}>
            <input type="checkbox" style={{ marginTop: 3 }} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>
              Je confirme que les contacts de cette liste ont donné leur accord pour être contactés, conformément à la réglementation gabonaise sur la
              protection des données personnelles.
            </span>
          </label>
          {message && <div style={{ marginTop: 14 }}><Alert tone={message.tone}>{message.text}</Alert></div>}
          <div style={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
            <button className="button-secondary button" onClick={saveDraft} disabled={busy !== null}>{busy === "draft" ? "Enregistrement…" : "Enregistrer le brouillon"}</button>
            <button className="button" onClick={launch} disabled={busy !== null || !consent || !list}>
              {busy === "launch" ? "Lancement…" : mode === "later" ? "Programmer la campagne" : `Lancer vers ${list?.validCount.toLocaleString("fr-FR") ?? 0} contacts`}
            </button>
          </div>
        </div>
      </div>

      <div className="editor-preview">
        <div className="card">
          <h3>Aperçu</h3>
          <div className="field" style={{ marginTop: 12 }}>
            <label>Contact de la liste</label>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              {contacts.length === 0 && <option value="">Aucun contact</option>}
              {contacts.map((c) => <option key={c.id} value={c.id}>{contactLabel(c)}</option>)}
            </select>
          </div>
          {withSms && (
            <div style={{ marginBottom: 16 }}>
              <div className="stat-label" style={{ marginBottom: 6 }}>SMS · {contact?.phone ?? "—"}</div>
              <div className="sms-bubble">{smsPreview || <span className="muted">Le message apparaîtra ici.</span>}</div>
            </div>
          )}
          {withEmail && (
            <div>
              <div className="stat-label" style={{ marginBottom: 6 }}>E-mail · {contact?.email ?? "—"}</div>
              <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", background: "var(--color-surface-alt)", borderBottom: "1px solid var(--color-border)", fontSize: 13 }}>
                  <div className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>De : {emailSender || settings.defaultSender || "expéditeur par défaut"}</div>
                  <strong>{fillVariables(emailSubject, data) || "(sans objet)"}</strong>
                </div>
                <iframe title="Aperçu de l'e-mail" sandbox="" srcDoc={emailPreview} style={{ width: "100%", height: 320, border: 0, background: "white" }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
