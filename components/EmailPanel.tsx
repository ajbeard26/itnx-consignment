"use client";

import { useState } from "react";
import { sendCustomerEmail } from "@/app/customers/actions";

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

  function kindLabel(kind: string | null) {
    if (kind === "payout") return "Mailing";
    if (kind === "accept") return "Sign";
    if (kind === "custom") return "Note";
    return "Email";
  }

  return (
    <div className="sms-panel">
      <div className="sms-status">
        <span className={email ? "badge badge-ok" : "badge"}>{email || "Add an email first"}</span>
      </div>
      {!configured ? (
        <p className="muted">Add SMTP in Settings → Email to send from here.</p>
      ) : (
        <>
          <div className="email-cards">
            <div className="email-card">
              <h3>Mailing info</h3>
              <p>Ask them to add the name on the check and where to mail it. This is not a signature.</p>
              <button className="button ghost" type="button" disabled={Boolean(pending) || !email} onClick={() => send("payout")}>
                {pending === "payout" ? "Sending…" : "Email mailing link"}
              </button>
            </div>
            <div className="email-card">
              <h3>Sign payout</h3>
              <p>Ask them to review the sale and sign. Uses a different page than mailing info.</p>
              <button className="button ghost" type="button" disabled={Boolean(pending) || !email || !canSign} onClick={() => send("accept")}>
                {pending === "accept" ? "Sending…" : "Email sign link"}
              </button>
              {!canSign ? <small className="muted">Add a consignment first.</small> : null}
            </div>
          </div>

          <div className="email-compose">
            <h3>Custom note</h3>
            <p className="muted">Write the message they should receive. Optionally attach a mailing or sign link.</p>
            <div className="field">
              <label>Subject</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Hello — writing with an update on your consignment…" />
            </div>
            <div className="field">
              <label>Attach a link</label>
              <select value={include} onChange={(e) => setInclude(e.target.value as "none" | "payout" | "sign")}>
                <option value="none">No link</option>
                <option value="payout">Mailing-info link</option>
                <option value="sign" disabled={!canSign}>
                  Sign-payout link
                </option>
              </select>
            </div>
            <button className="button ghost" type="button" disabled={Boolean(pending) || !email || !message.trim()} onClick={() => send("custom")}>
              {pending === "custom" ? "Sending…" : "Send custom email"}
            </button>
          </div>
        </>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-ok">{ok}</p> : null}
      {messages.length ? (
        <div className="sms-log">
          {messages.map((m) => (
            <div key={m.id} className={`sms-bubble ${m.status === "failed" ? "in" : "out"}`}>
              <span>
                <b>{kindLabel(m.kind)}</b> · {m.subject}
              </span>
              <small>
                {m.status || "sent"} · {m.to} · {new Date(m.createdAt).toLocaleString()}
                {m.error ? ` · ${m.error}` : ""}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No emails yet.</p>
      )}
    </div>
  );
}
