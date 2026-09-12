import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import { db } from "@/lib/db";

export const metadata = { title: "Customers" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const customers = await db.customer.findMany({
    where: q.trim()
      ? {
          OR: [
            { name: { contains: q.trim(), mode: "insensitive" } },
            { email: { contains: q.trim(), mode: "insensitive" } },
            { phone: { contains: q.trim(), mode: "insensitive" } },
            { company: { contains: q.trim(), mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { consignments: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">People</p>
          <h1>Customers</h1>
          <p className="muted">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
            {q ? " match this search" : ""}.
          </p>
        </div>
        <Link className="button" href="/customers/new">
          + New customer
        </Link>
      </div>
      <form className="filters" method="get">
        <input name="q" defaultValue={q} placeholder="Search name, email, phone, or company" />
        <button className="button ghost" type="submit">
          Search
        </button>
      </form>
      {customers.length === 0 ? (
        <div className="card">
          <EmptyState
            title={q ? "No matching customers" : "No customers yet"}
            body={q ? "Try a different name or phone number." : "Add a customer, or create one when you start a consignment."}
            href="/customers/new"
            action="+ New customer"
          />
        </div>
      ) : (
        <div className="deal-list">
          {customers.map((c) => (
            <Link key={c.id} href={`/customers/${c.id}`} className="deal customer-deal">
              <div className="deal-thumb placeholder">{initials(c.name)}</div>
              <div>
                <div className="deal-title">{c.name}</div>
                <div className="muted">
                  {[c.company, c.email, c.phone].filter(Boolean).join(" · ") || "No contact yet"}
                </div>
              </div>
              <div className="deal-meta">
                <b>
                  {c._count.consignments} deal{c._count.consignments === 1 ? "" : "s"}
                </b>
                <span className={c.payoutReady ? "badge badge-ok" : "badge"}>
                  {c.payoutReady ? "Payout info in" : "Needs payout info"}
                </span>
                <span className={c.addressVerified || c.payoutAddressVerified ? "badge badge-ok" : "badge"}>
                  {c.addressVerified || c.payoutAddressVerified ? "Address OK" : "Address"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}