import type { ReactNode } from "react";
import CustomerHero from "@/components/CustomerHero";

export default function LegalShell({
  brand,
  legal,
  title,
  updated,
  children,
}: {
  brand: string;
  legal: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="customer legal-page">
      <CustomerHero brand={brand} legal={legal} />
      <article className="card legal-doc">
        <p className="kicker">Legal</p>
        <h2>{title}</h2>
        <p className="muted">Last updated {updated}</p>
        {children}
      </article>
    </div>
  );
}
