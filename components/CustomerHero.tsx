import type { ReactNode } from "react";
import LegalFooter from "@/components/LegalFooter";

export default function CustomerHero({
  brand,
  legal,
  children,
}: {
  brand: string;
  legal: string;
  children?: ReactNode;
}) {
  return (
    <div className="portal">
      <header className="portal-head">
        <img src="/itnx-logo.png" alt="ITNX" className="portal-logo" />
        <div>
          <strong>{brand}</strong>
          <span>A service of {legal}</span>
        </div>
      </header>
      <div className="portal-body">{children}</div>
      <LegalFooter />
    </div>
  );
}
