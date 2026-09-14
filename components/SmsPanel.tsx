"use client";

import { useState } from "react";
import { sendCustomerSms } from "@/app/customers/actions";
import { shortDateTime } from "@/lib/dates";

export default function SmsPanel({
  customerId,
  phone,
  consent,
  optedOut,
  configured,
  messages,
}: {
  customerId: string;
  phone: string;
  consent: boolean;
  optedOut: boolean;
  configured: boolean;
  messages: Array<{ id: string; direction: string; body: string; createdAt: string; status: string | null }>;
}) {
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState("");

  async function send(kind: "consent" | "payout" | "accept") {
    setError("");
    setOk("");
    setPending(kind);
    try {
      const result = await sendCustomerSms(customerId, kind);
      if (result.error) setError(result.error);
      else setOk(result.ok || "Sent.");
    } finally {
      setPending("");
    }
  }

  return (
    <div className="sms-panel">
      <div className="sms-status">
        {optedOut ? (
          <span className="badge badge-warn">Opted out</span>
        ) : consent ? (
          <span className="badge badge-ok">Text consent on file</span>
        ) : (
          <span className="badge">No SMS consent yet</span>
        )}
        <span className="muted">{phone || "Add a phone number first"}</span>
      </div>
      {!configured ? (
        <p className="muted">Add Telnyx in Settings to text this customer.</p>
      ) : (
        <div className="form-actions wrap">
          <button className="button ghost" type="button" disabled={Boolean(pending) || optedOut} onClick={() => send("consent")}>
            {pending === "consent" ? "Sending…" : "Ask for consent"}
          </button>
          <button className="button ghost" type="button" disabled={Boolean(pending) || optedOut || !phone} onClick={() => send("payout")}>
            {pending === "payout" ? "Sending…" : "Send payout link"}
          </button>
          <button className="button" type="button" disabled={Boolean(pending) || optedOut || !consent} onClick={() => send("accept")}>
            {pending === "accept" ? "Sending…" : "Send sign link"}
          </button>
        </div>
      )}
      {error ? <p className="form-error">{error}</p> : null}
      {ok ? <p className="form-ok">{ok}</p> : null}
      {messages.length ? (
        <div className="sms-log">
          {messages.map((m) => (
            <div key={m.id} className={`sms-bubble ${m.direction === "IN" ? "in" : "out"}`}>
              <span>{m.body}</span>
              <small>
                {m.direction === "IN" ? "In" : "Out"} · {shortDateTime(m.createdAt)}
              </small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No texts yet.</p>
      )}
    </div>
  );
}