"use client";

import { useState } from "react";

export default function DealId({
  value,
  label = "ID",
}: {
  value?: string | null;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const id = value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <span className="deal-id">
      <span className="deal-id-label">{label}#</span>
      <code>{value}</code>
      <button type="button" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
    </span>
  );
}
