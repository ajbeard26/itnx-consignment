import type { ReactNode } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { logout } from "@/app/login/actions";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="shell">
      <aside className="side">
        <Link href="/dashboard" className="side-brand">
          <BrandLogo size={44} className="side-logo" />
          <span>
            <span className="brand">ITNX</span>
            <span className="sub">Consignment</span>
          </span>
        </Link>
        <nav className="nav">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/consignments">Consignments</Link>
          <Link href="/consignments/new">New Consignment</Link>
          <Link href="/settings">Settings</Link>
        </nav>
        <form action={logout} className="side-out">
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
