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
    <CustomerHero brand={brand} legal={legal}>
      <article className="portal-card legal-doc">
        <p className="kicker">Legal</p>
        <h1>{title}</h1>
        <p className="muted">Last updated {updated}</p>
        {children}
      </article>
    </CustomerHero>
  );
}
