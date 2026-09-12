"use client";

import { useState } from "react";
import { sendCustomerEmail } from "@/app/customers/actions";

export default function EmailPanel({
  customerId,
  email,
  configured,
  messages,
}: {
  customerId: string;
  email: string;
  configured: boolean;
  messages: Array<{ id: string; to: string; subject: string; status: string | null; createdAt: string; error: string | null }>;
}) {
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState("");

  async function send(kind: "payout" | "accept" | "custom") {
    setError("");
    setOk("");
    setPending(kind);
    try {
      const result = await sendCustomerEmail(customerId, kind);
      if (result.error) setError(result.error);
      else setOk(result.ok || "Sent.");
    } finally {
      setPending("");
    }
  }

  return (
    <div className="sms-panel">
      <div className="sms-status">
        <span className={email ? "badge badge-ok" : "badge"}>{email || "Add an email first"}</span>
      </div>
      {!configured ? (
        <p className="muted">Add SMTP in Settings → Email to send from here.</p>
      ) : (
        <div className="form-actions wrap">
          <button className="button ghost" type="button" disabled={Boolean(pending) || !email} onClick={() => send("payout")}>
            {pending === "payout" ? "Sending…" : "Email payout link"}
          </button>
          <button className="button ghost" type="button" disabled={Boolean(pending) || !email} onClick={() => send("accept")}>
            {pending === "accept" ? "Sending…" : "Email sign link"}
          </button>
          <button className="button" type="button" disabled={Boolean(pending) || !email} onClick={() => send("custom")}>
            {pending === "custom" ? "Sending…" : "Send custom email"}
          </button>
        </div>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-ok">{ok}</p> : null}
      {messages.length ? (
        <div className="sms-log">
          {messages.map((m) => (
            <div key={m.id} className={`sms-bubble ${m.status === "failed" ? "in" : "out"}`}>
              <span>{m.subject}</span>
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
