"use client";

import { useState } from "react";

function prettyUrl(href: string) {
  try {
    const url = new URL(href);
    const parts = url.pathname.split("/").filter(Boolean);
    const leaf = parts[parts.length - 1] || "";
    const short = leaf.length > 10 ? `${parts.slice(0, -1).join("/")}/…` : parts.join("/");
    return `${url.host}/${short}`.replace(/\/+$/, "");
  } catch {
    return href;
  }
}

export default function ShareLink({
  href,
  title,
  hint,
  bare = false,
}: {
  href: string;
  title: string;
  hint?: string;
  bare?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const actions = (
    <div className="share-link-actions">
      <button className="button ghost" type="button" onClick={copy}>
        {copied ? "Copied" : "Copy link"}
      </button>
      <a className="button ghost" href={href} target="_blank" rel="noreferrer">
        Open
      </a>
    </div>
  );

  if (bare) return actions;

  return (
    <div className="share-link">
      <div className="share-link-copy">
        <strong>{title}</strong>
        <span>{hint || prettyUrl(href)}</span>
      </div>
      {actions}
    </div>
  );
}
