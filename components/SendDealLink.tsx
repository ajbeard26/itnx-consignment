"use client";

import { useState } from "react";
import { sendDealInvite } from "@/app/consignments/[id]/actions";

export default function SendDealLink({
  id,
  hasEmail,
  hasPhone,
}: {
  id: string;
  hasEmail: boolean;
  hasPhone: boolean;
}) {
  const [pending, setPending] = useState<"email" | "sms" | "">("");
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");

  async function send(channel: "email" | "sms") {
    setOk("");
    setError("");
    setPending(channel);
    try {
      const result = await sendDealInvite(id, channel);
      if (result.error) setError(result.error);
      else setOk(result.ok || "Sent.");
    } finally {
      setPending("");
    }
  }

  return (
    <div className="send-deal">
      <div className="send-deal-actions">
        <button className="button" type="button" disabled={!hasEmail || Boolean(pending)} onClick={() => send("email")}>
          {pending === "email" ? "Sending…" : "Email link"}
        </button>
        <button className="button ghost" type="button" disabled={!hasPhone || Boolean(pending)} onClick={() => send("sms")}>
          {pending === "sms" ? "Sending…" : "Text link"}
        </button>
      </div>
      {!hasEmail ? <p className="muted">Add an email on the customer profile to email this page.</p> : null}
      {!hasPhone ? <p className="muted">Add a phone number to text this page. Signature texts still need SMS consent.</p> : null}
      {ok ? <p className="form-ok">{ok}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
