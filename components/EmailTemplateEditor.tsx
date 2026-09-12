"use client";

import { useMemo, useRef, useState } from "react";
import { EMAIL_PLACEHOLDERS, fillPlaceholders, wrapEmailHtml } from "@/lib/email-html";

type Kind = "payout" | "accept" | "custom";

const KINDS: Array<{ id: Kind; label: string }> = [
  { id: "payout", label: "Payout link" },
  { id: "accept", label: "Signature" },
  { id: "custom", label: "Custom" },
];

const SNIPPETS = [
  { label: "Paragraph", html: "<p>Your message here.</p>\n" },
  { label: "Bold", html: "<b>important</b>" },
  { label: "Button", html: `<p style="text-align:center;margin:28px 0;">\n  <a class="btn" href="{link}">Open link</a>\n</p>\n` },
  { label: "Divider", html: `<hr style="border:0;border-top:1px solid #e6eaf0;margin:24px 0;">\n` },
];

export default function EmailTemplateEditor({
  brand,
  legal,
  website,
  payoutSubject,
  payoutHtml,
  acceptSubject,
  acceptHtml,
  customSubject,
  customHtml,
}: {
  brand: string;
  legal: string;
  website: string;
  payoutSubject: string;
  payoutHtml: string;
  acceptSubject: string;
  acceptHtml: string;
  customSubject: string;
  customHtml: string;
}) {
  const [kind, setKind] = useState<Kind>("payout");
  const [values, setValues] = useState({
    payoutSubject,
    payoutHtml,
    acceptSubject,
    acceptHtml,
    customSubject,
    customHtml,
  });
  const area = useRef<HTMLTextAreaElement>(null);

  const subjectKey = `${kind}Subject` as const;
  const htmlKey = `${kind}Html` as const;
  const sample = useMemo(
    () => ({
      brand,
      legal,
      name: "Antonio Beard",
      link: "https://co.itnx.tech/info/example",
      email: "customer@email.com",
    }),
    [brand, legal]
  );
  const preview = wrapEmailHtml(fillPlaceholders(values[htmlKey], sample), { brand, legal, website });
  const previewSubject = fillPlaceholders(values[subjectKey], sample);

  function insert(text: string) {
    const el = area.current;
    if (!el) {
      setValues((prev) => ({ ...prev, [htmlKey]: prev[htmlKey] + text }));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = values[htmlKey].slice(0, start) + text + values[htmlKey].slice(end);
    setValues((prev) => ({ ...prev, [htmlKey]: next }));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="email-editor">
      <textarea hidden readOnly name="emailPayoutSubject" value={values.payoutSubject} />
      <textarea hidden readOnly name="emailPayoutHtml" value={values.payoutHtml} />
      <textarea hidden readOnly name="emailAcceptSubject" value={values.acceptSubject} />
      <textarea hidden readOnly name="emailAcceptHtml" value={values.acceptHtml} />
      <textarea hidden readOnly name="emailCustomSubject" value={values.customSubject} />
      <textarea hidden readOnly name="emailCustomHtml" value={values.customHtml} />

      <div className="seg" role="tablist">
        {KINDS.map((item) => (
          <button key={item.id} type="button" className={kind === item.id ? "on" : undefined} onClick={() => setKind(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="field">
        <label>Subject</label>
        <input
          value={values[subjectKey]}
          onChange={(e) => setValues((prev) => ({ ...prev, [subjectKey]: e.target.value }))}
        />
      </div>

      <div className="email-tools">
        {SNIPPETS.map((item) => (
          <button key={item.label} type="button" className="chip" onClick={() => insert(item.html)}>
            {item.label}
          </button>
        ))}
        {EMAIL_PLACEHOLDERS.map((token) => (
          <button key={token} type="button" className="chip" onClick={() => insert(token)}>
            {token}
          </button>
        ))}
      </div>

      <div className="email-split">
        <div className="field">
          <label>HTML body</label>
          <textarea
            ref={area}
            rows={14}
            className="html-source"
            value={values[htmlKey]}
            onChange={(e) => setValues((prev) => ({ ...prev, [htmlKey]: e.target.value }))}
            spellCheck={false}
          />
          <small className="muted">The branded header and footer wrap this automatically.</small>
        </div>
        <div className="email-preview-wrap">
          <label>Preview</label>
          <div className="email-preview-subject">{previewSubject || "Subject"}</div>
          <iframe title="Email preview" className="email-preview" sandbox="" srcDoc={preview} />
        </div>
      </div>
    </div>
  );
}
