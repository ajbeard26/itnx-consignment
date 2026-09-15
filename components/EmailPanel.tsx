"use client";

import { useState } from "react";
import { sendCustomerEmail } from "@/app/customers/actions";
import { shortDateTime } from "@/lib/dates";
import { emailKindLabel } from "@/lib/email-html";

export default function EmailPanel({
  customerId,
  email,
  configured,
  canSign,
  messages,
}: {
  customerId: string;
  email: string;
  configured: boolean;
  canSign: boolean;
  messages: Array<{
    id: string;
    to: string;
    subject: string;
    status: string | null;
    createdAt: string;
    error: string | null;
    kind: string | null;
  }>;
}) {
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState("");
  const [subject, setSubject] = useState("A note from ITNX Consignment");
  const [message, setMessage] = useState("");
  const [include, setInclude] = useState<"none" | "payout" | "sign">("none");

  async function send(kind: "payout" | "accept" | "custom") {
    setError("");
    setOk("");
    setPending(kind);
    try {
      const result = await sendCustomerEmail(
        customerId,
        kind,
        kind === "custom" ? { subject, message, include } : undefined
      );
      if (result.error) setError(result.error);
      else {
        setOk(result.ok || "Sent.");
        if (kind === "custom") setMessage("");
      }
    } finally {
      setPending("");
    }
  }

  return (
    <div className="mail-panel">
      <div className="mail-to">
        <span className={email ? "badge badge-ok" : "badge badge-warn"}>{email || "Add an email on Profile"}</span>
      </div>

      {!configured ? (
        <p className="muted">Add SMTP in Settings → Email to send from here.</p>
      ) : (
        <>
          <div className="mail-quick">
            <button className="button" type="button" disabled={Boolean(pending) || !email} onClick={() => send("payout")}>
              {pending === "payout" ? "Sending…" : "Mailing link"}
            </button>
            <button className="button ghost" type="button" disabled={Boolean(pending) || !email || !canSign} onClick={() => send("accept")}>
              {pending === "accept" ? "Sending…" : "Sign link"}
            </button>
            {!canSign ? <span className="muted">Need a deal to send a sign link.</span> : null}
          </div>

          <div className="mail-compose">
            <div className="field">
              <label>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="field">
              <label>Note</label>
              <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hello — writing with an update on your consignment…" />
            </div>
            <div className="mail-compose-foot">
              <select value={include} onChange={(e) => setInclude(e.target.value as "none" | "payout" | "sign")}>
                <option value="none">No link</option>
                <option value="payout">Attach mailing link</option>
                <option value="sign" disabled={!canSign}>
                  Attach sign link
                </option>
              </select>
              <button className="button ghost" type="button" disabled={Boolean(pending) || !email || !message.trim()} onClick={() => send("custom")}>
                {pending === "custom" ? "Sending…" : "Send note"}
              </button>
            </div>
          </div>
        </>
      )}

      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-ok">{ok}</p> : null}

      <div className="mail-log">
        <div className="mail-log-head">
          <span>Sent</span>
          <span>Kind</span>
          <span>Subject</span>
          <span className="end">Status</span>
        </div>
        {messages.length ? (
          messages.map((m) => (
            <div key={m.id} className="mail-log-row">
              <span className="when">{shortDateTime(m.createdAt)}</span>
              <span>{emailKindLabel(m.kind)}</span>
              <span className="mail-log-subject" title={m.subject}>
                {m.subject}
              </span>
              <span className="end">
                <span className={m.status === "failed" ? "badge badge-warn" : "badge badge-ok"}>{m.status === "failed" ? "Failed" : "Sent"}</span>
              </span>
              {m.error ? <span className="mail-log-error">{m.error}</span> : null}
            </div>
          ))
        ) : (
          <p className="muted">No emails yet.</p>
        )}
      </div>
    </div>
  );
}
