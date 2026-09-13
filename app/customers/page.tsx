import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import Pager from "@/components/Pager";
import { db } from "@/lib/db";
import { googleVerified } from "@/lib/address";
import { initials } from "@/lib/initials";
import { pageNumber, paginate } from "@/lib/paging";

export const metadata = { title: "Customers" };

function hrefFor(q: string, page?: number) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q = "", page: rawPage } = await searchParams;
  const where = q.trim()
    ? {
        OR: [
          { name: { contains: q.trim(), mode: "insensitive" as const } },
          { email: { contains: q.trim(), mode: "insensitive" as const } },
          { phone: { contains: q.trim(), mode: "insensitive" as const } },
          { company: { contains: q.trim(), mode: "insensitive" as const } },
        ],
      }
    : undefined;
  const total = await db.customer.count({ where });
  const pager = paginate(total, pageNumber(rawPage));
  const customers = await db.customer.findMany({
    where,
    include: { _count: { select: { consignments: true } } },
    orderBy: { name: "asc" },
    skip: pager.skip,
    take: pager.take,
  });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">People</p>
          <h1>Customers</h1>
          <p className="muted">
            {total} customer{total === 1 ? "" : "s"}
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
        <div className="card">
          <div className="deal-list">
            {customers.map((c) => {
              const addressOk =
                googleVerified(c.addressVerified, c.addressVerifiedSource) ||
                googleVerified(c.payoutAddressVerified, c.payoutAddressVerifiedSource);
              return (
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
                    <span className={addressOk ? "badge badge-ok" : "badge"}>
                      {addressOk ? "Address OK" : "Address"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
          <Pager page={pager.current} pages={pager.pages} total={pager.total} size={pager.take} hrefFor={(p) => hrefFor(q, p)} />
        </div>
      )}
    </Shell>
  );
}
