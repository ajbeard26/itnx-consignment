"use client";

import { useEffect, useRef, useState } from "react";
import { suggestAddressAction, verifyAddressAction, zipLookupAction } from "@/app/address/actions";
import type { AddressResult } from "@/lib/address";

type Names = {
  street: string;
  city: string;
  state: string;
  zip: string;
  verified: string;
};

const DEFAULT_NAMES: Names = {
  street: "street",
  city: "city",
  state: "state",
  zip: "zip",
  verified: "addressVerified",
};

export default function AddressFields({
  names = DEFAULT_NAMES,
  street = "",
  city = "",
  state = "",
  zip = "",
  alreadyVerified = false,
  required = true,
  hint,
}: {
  names?: Partial<Names>;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  alreadyVerified?: boolean;
  required?: boolean;
  hint?: string;
}) {
  const n = { ...DEFAULT_NAMES, ...names };
  const [values, setValues] = useState({ street, city, state, zip });
  const [status, setStatus] = useState<AddressResult | null>(null);
  const [pending, setPending] = useState(false);
  const [hints, setHints] = useState<Array<{ street: string; city: string; state: string; zip: string; label: string; confirm?: boolean }>>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setField<K extends keyof typeof values>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  }

  async function verify() {
    setPending(true);
    try {
      const result = await verifyAddressAction(values);
      setStatus(result);
      if (result.ok) {
        setValues({
          street: result.street,
          city: result.city,
          state: result.state,
          zip: result.zip,
        });
      }
    } finally {
      setPending(false);
    }
  }

  function useSuggestion() {
    if (!status?.suggestion) return;
    setValues(status.suggestion);
    setStatus(null);
  }

  async function onZip(value: string) {
    setField("zip", value);
    const z = value.replace(/\D/g, "");
    if (z.length !== 5) return;
    const place = await zipLookupAction(z);
    if (place?.city) {
      setValues((prev) => ({
        ...prev,
        zip: value,
        city: prev.city || place.city,
        state: prev.state || place.state,
      }));
    }
  }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (values.street.trim().length < 5) {
      setHints([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setHints(await suggestAddressAction(values.street, values.city, values.state, values.zip));
    }, 320);
  }, [values.street, values.city, values.state, values.zip]);

  const verified = Boolean(status?.ok);

  return (
    <div className="address-box">
      <div className="field full suggest-wrap">
        <label>Street</label>
        <input
          name={n.street}
          required={required}
          value={values.street}
          onChange={(e) => setField("street", e.target.value)}
          placeholder="Street address"
          autoComplete="street-address"
        />
        {hints.length ? (
          <div className="suggest">
            {hints.map((h) => (
              <button
                key={h.label}
                type="button"
                onClick={() => {
                  const next = { street: h.street, city: h.city, state: h.state, zip: h.zip };
                  setValues(next);
                  setHints([]);
                  if (h.confirm) {
                    setStatus({
                      ok: true,
                      confidence: "MATCHED",
                      ...next,
                      formatted: h.label,
                      message: "Confirmed this mailing address.",
                      source: "census",
                    });
                  } else {
                    setStatus(null);
                  }
                }}
              >
                {h.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="form three">
        <div className="field">
          <label>City</label>
          <input
            name={n.city}
            required={required}
            value={values.city}
            onChange={(e) => setField("city", e.target.value)}
            placeholder="City"
            autoComplete="address-level2"
          />
        </div>
        <div className="field">
          <label>State</label>
          <input
            name={n.state}
            required={required}
            maxLength={2}
            value={values.state}
            onChange={(e) => setField("state", e.target.value.toUpperCase())}
            placeholder="MI"
            autoComplete="address-level1"
          />
        </div>
        <div className="field">
          <label>ZIP</label>
          <input
            name={n.zip}
            required={required}
            value={values.zip}
            onChange={(e) => onZip(e.target.value)}
            placeholder="12345"
            autoComplete="postal-code"
          />
        </div>
      </div>
      <input type="hidden" name={n.verified} value={verified ? "1" : ""} />
      <div className="address-actions">
        <button className="button ghost" type="button" onClick={verify} disabled={pending}>
          {pending ? "Checking…" : "Verify address"}
        </button>
        {status?.ok ? <span className="badge badge-ok">Verified</span> : null}
        {status && !status.ok ? <span className="badge badge-warn">Not confirmed</span> : null}
        {!status && alreadyVerified ? <span className="badge">Needs re-check</span> : null}
      </div>
      {status ? <p className={status.ok ? "form-ok" : "form-error"}>{status.message}</p> : (
        <p className="muted">
          {hint
            ? hint
            : alreadyVerified
              ? "This was marked verified before. Check it again so the building number and city are exact."
              : "We confirm the house number, city, and state. Rural Michigan roads are included."}
        </p>
      )}
      {status?.suggestion && !status.ok ? (
        <button className="button ghost" type="button" onClick={useSuggestion}>
          Use this match: {status.suggestion.street}, {status.suggestion.city}, {status.suggestion.state} {status.suggestion.zip}
        </button>
      ) : null}
    </div>
  );
}