// E-mail content: body, mandatory unsubscribe link, open-tracking pixel
function escapeHtml(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function linkify(t: string) {
  return t.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#0f4c45">$1</a>');
}

export type EmailContent = { html: string; text: string };

export function buildEmail(body: string, options: { unsubscribeUrl: string; pixelUrl?: string | null }): EmailContent {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px">${linkify(escapeHtml(p)).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f4f7f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#172321">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;padding:28px 24px;font-size:15px;line-height:1.55">${paragraphs}</div>
<div style="max-width:600px;margin:12px auto 0;text-align:center;font-size:12px;color:#64706d">
Vous ne souhaitez plus recevoir nos messages ? <a href="${options.unsubscribeUrl}" style="color:#64706d">Se désinscrire</a>
</div>${options.pixelUrl ? `<img src="${options.pixelUrl}" width="1" height="1" alt="" style="display:block;border:0">` : ""}
</body></html>`;
  const text = `${body.trim()}\n\n--\nSe désinscrire : ${options.unsubscribeUrl}`;
  return { html, text };
}

/** Public address of the app: APP_URL, else the Vercel production domain. */
export function appUrl() {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return (process.env.APP_URL || (vercel ? `https://${vercel}` : "http://localhost:3000")).replace(/\/+$/, "");
}
