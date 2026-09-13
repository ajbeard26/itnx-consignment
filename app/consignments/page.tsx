import Link from "next/link";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import Pager from "@/components/Pager";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { DEAL_VIEWS, dealView, dealViewWhere, isArchivedStatus } from "@/lib/deals";
import { dealSearchNeedles } from "@/lib/reference";
import { pageNumber, paginate } from "@/lib/paging";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Consignments" };

function hrefFor(view: string, q: string, page?: number) {
  const params = new URLSearchParams();
  if (view && view !== "active") params.set("view", view);
  if (q.trim()) params.set("q", q.trim());
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/consignments?${query}` : "/consignments";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; status?: string; page?: string }>;
}) {
  const { q = "", view: rawView, status, page: rawPage } = await searchParams;
  const view = status === "COMPLETED" || status === "PAID" ? "archived" : dealView(rawView);
  const search: Prisma.ConsignmentWhereInput = q.trim()
    ? {
        OR: [
          { title: { contains: q.trim(), mode: "insensitive" } },
          { serialNumber: { contains: q.trim(), mode: "insensitive" } },
          { customer: { name: { contains: q.trim(), mode: "insensitive" } } },
          ...dealSearchNeedles(q).map((n) => ({ reference: { contains: n, mode: "insensitive" as const } })),
        ],
      }
    : {};
  const [active, payout, archived, all] = await Promise.all([
    db.consignment.count({ where: { AND: [search, dealViewWhere("active")] } }),
    db.consignment.count({ where: { AND: [search, dealViewWhere("payout")] } }),
    db.consignment.count({ where: { AND: [search, dealViewWhere("archived")] } }),
    db.consignment.count({ where: search }),
  ]);
  const counts = { active, payout, archived, all };
  const pager = paginate(counts[view], pageNumber(rawPage));
  const xs = await db.consignment.findMany({
    where: { AND: [search, dealViewWhere(view)] },
    include: { customer: true, images: { take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    skip: pager.skip,
    take: pager.take,
  });

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
          <Pager page={pager.current} pages={pager.pages} total={pager.total} hrefFor={(p) => hrefFor(view, q, p)} />
        </div>
      )}
    </Shell>
  );
}
