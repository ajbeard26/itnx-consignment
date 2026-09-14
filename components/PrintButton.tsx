"use client";

export default function PrintButton({ label = "Print / save PDF" }: { label?: string }) {
  return (
    <button className="button" type="button" onClick={() => window.print()}>
      {label}
    </button>
  );
}
