"use client";

import { useState } from "react";
import { verifyAddressAction } from "@/app/address/actions";

export default function GoogleAddressTest() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState<boolean | null>(null);
  const [values, setValues] = useState({ street: "", city: "", state: "", zip: "" });

  return (
    <div className="stack-form">
      <div className="form">
        <div className="field full">
          <label>Street</label>
          <input
            value={values.street}
            onChange={(e) => setValues((v) => ({ ...v, street: e.target.value }))}
            placeholder="2090 Ridge Rd"
          />
        </div>
        <div className="field">
          <label>City</label>
          <input
            value={values.city}
            onChange={(e) => setValues((v) => ({ ...v, city: e.target.value }))}
            placeholder="Carsonville"
          />
        </div>
        <div className="field">
          <label>State</label>
          <input
            value={values.state}
            maxLength={2}
            onChange={(e) => setValues((v) => ({ ...v, state: e.target.value.toUpperCase() }))}
            placeholder="MI"
          />
        </div>
        <div className="field">
          <label>ZIP</label>
          <input
            value={values.zip}
            onChange={(e) => setValues((v) => ({ ...v, zip: e.target.value }))}
            placeholder="48419"
          />
        </div>
      </div>
      <button
        className="button ghost"
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setMessage("");
          setOk(null);
          try {
            const result = await verifyAddressAction(values);
            setOk(result.ok);
            setMessage(result.ok ? `Confirmed: ${result.formatted}` : result.message);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Checking…" : "Test address"}
      </button>
      {message ? <p className={ok ? "form-ok" : "form-error"}>{message}</p> : null}
    </div>
  );
}