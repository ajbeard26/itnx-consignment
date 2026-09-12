"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import { logout } from "@/app/login/actions";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/consignments", label: "Consignments", icon: Package },
  { href: "/consignments/new", label: "New consignment", icon: PlusCircle },
  { href: "/settings", label: "Settings", icon: Settings },
];

function active(href: string, pathname: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/consignments/new") return pathname.startsWith("/consignments/new");
  if (href === "/consignments") {
    return pathname === "/consignments" || /^\/consignments\/(?!new(?:\/|$))/.test(pathname);
  }
  return pathname.startsWith(href);
}

export default function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="shell">
      <header className="topbar">
        <button
          className="topbar-btn"
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <Link href="/dashboard" className="topbar-brand">
          <BrandLogo size={32} className="side-logo" />
          <span>ITNX</span>
        </Link>
        <Link className="topbar-add" href="/consignments/new" aria-label="New consignment">
          <PlusCircle size={20} />
        </Link>
      </header>
      {open ? <button className="side-mask" type="button" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
      <aside className={`side${open ? " open" : ""}`}>
        <Link href="/dashboard" className="side-brand">
          <BrandLogo size={40} className="side-logo" priority />
          <span>
            <span className="brand">ITNX</span>
            <span className="sub">Consignment</span>
          </span>
        </Link>
        <nav className="nav">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={active(item.href, pathname) ? "active" : undefined}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="side-out">
          <button type="submit">
            <LogOut size={16} />
            Sign out
          </button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
