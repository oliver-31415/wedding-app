/**
 * The one email layout. Messages, RSVP confirmations and co-host invites all
 * render through `renderEmail`, so every email the couple's guests get looks
 * the same. Body is host-written plain text (blank line = new paragraph).
 */

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type EmailContent = {
  /** Shown above the body, e.g. "Alex & Sam". */
  heading?: string | null;
  body: string;
  button?: { label: string; url: string } | null;
  /** Small print at the bottom, e.g. "Alex & Sam · 13 March 2027". */
  footer?: string | null;
  accentColor?: string;
};

export function renderEmail(c: EmailContent): { html: string; text: string } {
  const accent = /^#[0-9a-f]{6}$/i.test(c.accentColor ?? "") ? c.accentColor! : "#7c5c3e";
  const paragraphs = c.body.trim().split(/\n\s*\n/).filter(Boolean);
  const button = c.button && /^https?:\/\//i.test(c.button.url) ? c.button : null;
  const html = `<!doctype html><html><body style="margin:0;background:#faf8f5;font-family:Helvetica,Arial,sans-serif;color:#1f1b16">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;padding:32px 16px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e6e1d9;border-radius:14px">
<tr><td style="padding:36px 32px">
${c.heading ? `<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:26px;text-align:center;color:${accent}">${escapeHtml(c.heading)}</p>` : ""}
${paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("\n")}
${button ? `<p style="margin:28px 0 8px;text-align:center"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:${accent};color:#ffffff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px">${escapeHtml(button.label)}</a></p>` : ""}
</td></tr></table>
${c.footer ? `<p style="margin:16px 0 0;font-size:12px;color:#9a9086">${escapeHtml(c.footer)}</p>` : ""}
</td></tr></table></body></html>`;
  const text = [c.heading, c.body.trim(), button ? `${button.label}: ${button.url}` : null, c.footer]
    .filter(Boolean)
    .join("\n\n");
  return { html, text };
}

/** Absolute base URL for links in emails (APP_URL, e.g. https://ourwedding.com.au). */
export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
