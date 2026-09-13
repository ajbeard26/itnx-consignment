import Link from "next/link";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { DEAL_VIEWS, dealView, isArchivedStatus, matchesDealView } from "@/lib/deals";
import { dealSearchNeedles } from "@/lib/reference";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Consignments" };

function hrefFor(view: string, q: string) {
  const params = new URLSearchParams();
  if (view && view !== "active") params.set("view", view);
  if (q.trim()) params.set("q", q.trim());
  const query = params.toString();
  return query ? `/consignments?${query}` : "/consignments";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; status?: string }>;
}) {
  const { q = "", view: rawView, status } = await searchParams;
  const view = status === "COMPLETED" || status === "PAID" ? "archived" : dealView(rawView);
  const where: Prisma.ConsignmentWhereInput = {};
  if (q.trim()) {
    const needles = dealSearchNeedles(q);
    where.OR = [
      { title: { contains: q.trim(), mode: "insensitive" } },
      { serialNumber: { contains: q.trim(), mode: "insensitive" } },
      { customer: { name: { contains: q.trim(), mode: "insensitive" } } },
      ...needles.map((n) => ({ reference: { contains: n, mode: "insensitive" as const } })),
    ];
  }

  const rows = await db.consignment.findMany({
    where,
    include: { customer: true, images: { take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });

  const counts = {
    active: rows.filter((x) => matchesDealView("active", x.status, x.paid)).length,
    payout: rows.filter((x) => matchesDealView("payout", x.status, x.paid)).length,
    archived: rows.filter((x) => matchesDealView("archived", x.status, x.paid)).length,
    all: rows.length,
  };
  const xs = rows.filter((x) => matchesDealView(view, x.status, x.paid));

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Deals</p>
          <h1>Consignments</h1>
          <p className="muted">
            {view === "archived"
              ? "Finished sales are archived after payout."
              : `${counts.active} active deal${counts.active === 1 ? "" : "s"}.`}
          </p>
        </div>
        <Link className="button" href="/consignments/new">
          + New
        </Link>
      </div>

      <div className="filter-bar">
        <form method="get">
          {view !== "active" ? <input type="hidden" name="view" value={view} /> : null}
          <input className="filter-search" name="q" defaultValue={q} placeholder="Search ID, customer, or serial" />
        </form>
        <div className="filter-pills" aria-label="Deal filters">
          {DEAL_VIEWS.map((item) => (
            <Link key={item.id} href={hrefFor(item.id, q)} className={view === item.id ? "on" : undefined}>
              {item.label}
              <span>{counts[item.id]}</span>
            </Link>
          ))}
        </div>
      </div>

      {xs.length === 0 ? (
        <div className="card">
          <EmptyState
            title={q || view !== "active" ? "No matching deals" : "No consignments yet"}
            body={
              q || view !== "active"
                ? "Try another search or pick a different filter."
                : "Create a deal with customer details, photos, and payout split."
            }
            href="/consignments/new"
            action="+ New consignment"
          />
        </div>
      ) : (
        <div className="card deal-board">
          <div className="deal-list compact">
            {xs.map((x) => (
              <Link key={x.id} href={`/consignments/${x.id}`} className="deal">
                {x.images[0] ? (
                  <img src={x.images[0].path} alt="" className="deal-thumb" />
                ) : (
                  <div className="deal-thumb placeholder">No photo</div>
                )}
                <div>
                  <div className="deal-id-line">{x.reference}</div>
                  <div className="deal-title">{x.title}</div>
                  <div className="muted">{x.customer.name}</div>
                </div>
                <div className="deal-meta">
                  <b>{money(x.salePriceCents || x.askingPriceCents)}</b>
                  {isArchivedStatus(x.status) ? <span className="badge">Archived</span> : <StatusBadge status={x.status} />}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </Shell>
  );
}
