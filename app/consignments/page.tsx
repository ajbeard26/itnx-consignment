import Link from "next/link";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { STATUS_LABEL } from "@/lib/labels";
import type { Prisma, Status } from "@prisma/client";

export const metadata = { title: "Consignments" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q = "", status = "" } = await searchParams;
  const where: Prisma.ConsignmentWhereInput = {};
  if (q.trim()) {
    where.OR = [
      { title: { contains: q.trim(), mode: "insensitive" } },
      { reference: { contains: q.trim(), mode: "insensitive" } },
      { customer: { name: { contains: q.trim(), mode: "insensitive" } } },
    ];
  }
  if (status && status in STATUS_LABEL) where.status = status as Status;

  const xs = await db.consignment.findMany({
    where,
    include: { customer: true, images: { take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Deals</p>
          <h1>Consignments</h1>
          <p className="muted">{xs.length} deal{xs.length === 1 ? "" : "s"}{q || status ? " match this filter" : ""}.</p>
        </div>
        <Link className="button" href="/consignments/new">
          + New
        </Link>
      </div>
      <form className="filters" method="get">
        <input name="q" defaultValue={q} placeholder="Search ref, item, or customer" />
        <select name="status" defaultValue={status}>
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button className="button ghost" type="submit">
          Filter
        </button>
      </form>
      {xs.length === 0 ? (
        <div className="card">
          <EmptyState
            title={q || status ? "No matching deals" : "No consignments yet"}
            body={
              q || status
                ? "Try a different search or clear the status filter."
                : "Create a deal with customer details, photos, and payout split."
            }
            href="/consignments/new"
            action="+ New consignment"
          />
        </div>
      ) : (
        <div className="deal-list">
          {xs.map((x) => (
            <Link key={x.id} href={`/consignments/${x.id}`} className="deal">
              {x.images[0] ? (
                <img src={x.images[0].path} alt="" className="deal-thumb" />
              ) : (
                <div className="deal-thumb placeholder">No photo</div>
              )}
              <div>
                <div className="deal-title">{x.title}</div>
                <div className="muted">
                  {x.reference} · {x.customer.name}
                  {x.category ? ` · ${x.category}` : ""}
                </div>
              </div>
              <div className="deal-meta">
                <b>{money(x.salePriceCents)}</b>
                <span className="muted">{x.customerPercentBps / 100}% customer</span>
                <StatusBadge status={x.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
