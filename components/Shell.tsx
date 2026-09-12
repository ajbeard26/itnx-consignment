import type { ReactNode } from "react";
import Link from "next/link";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">ITNX Consignment</div>
        <div className="sub">A service of NXRENT LLC</div>
        <nav className="nav">
          <Link href="/">Dashboard</Link>
          <Link href="/consignments">Consignments</Link>
          <Link href="/consignments/new">New Consignment</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
