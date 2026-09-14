import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import Pager from "@/components/Pager";
import DealTable, { toDealRow } from "@/components/DealTable";
import { db } from "@/lib/db";
import {
  DATE_FILTERS,
  DEAL_VIEWS,
  dateFilter,
  dateFilterOrder,
  dateFilterWhere,
  dealView,
  dealViewWhere,
} from "@/lib/deals";
import { dealSearchNeedles } from "@/lib/reference";
import { pageNumber, paginate } from "@/lib/paging";
import { daysAgoInput, monthStartInput, todayInput } from "@/lib/dates";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "Consignments" };

type Query = {
  view: string;
  q: string;
  when: string;
  from: string;
  to: string;
  page?: number;
};

function hrefFor({ view, q, when, from, to, page }: Query) {
  const params = new URLSearchParams();
  if (view && view !== "active") params.set("view", view);
  if (q.trim()) params.set("q", q.trim());
  if (when) params.set("when", when);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/consignments?${query}` : "/consignments";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; status?: string; page?: string; when?: string; from?: string; to?: string }>;
}) {
  const { q = "", view: rawView, status, page: rawPage, when: rawWhen, from = "", to = "" } = await searchParams;
  const view = status === "COMPLETED" || status === "PAID" ? "archived" : dealView(rawView);
  const when = dateFilter(rawWhen, view);
  const dates = dateFilterWhere(when, from, to);
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
  const scoped = { AND: [search, dates] };
  const [active, payout, archived, all] = await Promise.all([
    db.consignment.count({ where: { AND: [scoped, dealViewWhere("active")] } }),
    db.consignment.count({ where: { AND: [scoped, dealViewWhere("payout")] } }),
    db.consignment.count({ where: { AND: [scoped, dealViewWhere("archived")] } }),
    db.consignment.count({ where: scoped }),
  ]);
  const counts = { active, payout, archived, all };
  const pager = paginate(counts[view], pageNumber(rawPage));
  const xs = await db.consignment.findMany({
    where: { AND: [scoped, dealViewWhere(view)] },
    include: { customer: true, images: { take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: dateFilterOrder(when),
    skip: pager.skip,
    take: pager.take,
  });

  const query = { view, q, when: rawWhen || "", from, to };
  const formWhen = when;
  const filtered = Boolean(q.trim() || from || to);
  const hasOtherDeals = !filtered && view === "active" && counts.all > 0;
  const today = todayInput();
  const month = monthStartInput();
  const last30 = daysAgoInput(30);

  const subtitle =
    view === "archived"
      ? `${counts.archived} completed deal${counts.archived === 1 ? "" : "s"}`
      : view === "payout"
        ? `${counts.payout} waiting on consignor payment`
        : view === "all"
          ? `${counts.all} deal${counts.all === 1 ? "" : "s"}`
          : counts.active
            ? `${counts.active} open deal${counts.active === 1 ? "" : "s"}`
            : counts.archived
              ? `None open · ${counts.archived} archived`
              : "No deals yet";

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Deals</p>
          <h1>Consignments</h1>
          <p className="muted">{subtitle}</p>
        </div>
        <Link className="button" href="/consignments/new">
          + New
        </Link>
      </div>

      <div className="card deal-board">
        <div className="deal-toolbar">
          <div className="deal-toolbar-top">
            <form method="get" className="deal-search">
              {view !== "active" ? <input type="hidden" name="view" value={view} /> : null}
              <input type="hidden" name="when" value={formWhen} />
              {from ? <input type="hidden" name="from" value={from} /> : null}
              {to ? <input type="hidden" name="to" value={to} /> : null}
              <input className="filter-search" name="q" defaultValue={q} placeholder="Search ID, customer, or serial" />
            </form>
            <div className="filter-pills" aria-label="Deal filters">
              {DEAL_VIEWS.map((item) => (
                <Link key={item.id} href={hrefFor({ ...query, view: item.id, page: 1 })} className={view === item.id ? "on" : undefined}>
                  {item.label}
                  <span>{counts[item.id]}</span>
                </Link>
              ))}
            </div>
          </div>
          <form method="get" className="deal-dates-filter">
            {view !== "active" ? <input type="hidden" name="view" value={view} /> : null}
            {q.trim() ? <input type="hidden" name="q" value={q.trim()} /> : null}
            <label>
              <span>Date</span>
              <select name="when" defaultValue={formWhen}>
                {DATE_FILTERS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>From</span>
              <input type="date" name="from" defaultValue={from} />
            </label>
            <label>
              <span>To</span>
              <input type="date" name="to" defaultValue={to} />
            </label>
            <button className="button ghost" type="submit">
              Apply
            </button>
            <div className="date-presets">
              <Link href={hrefFor({ ...query, when: formWhen, from: month, to: today, page: 1 })}>This month</Link>
              <Link href={hrefFor({ ...query, when: formWhen, from: last30, to: today, page: 1 })}>Last 30 days</Link>
              {from || to ? <Link href={hrefFor({ ...query, when: formWhen, from: "", to: "", page: 1 })}>Clear dates</Link> : null}
            </div>
          </form>
        </div>

        {xs.length === 0 ? (
          <EmptyState
            title={
              filtered
                ? "No matching deals"
                : hasOtherDeals
                  ? "No active deals"
                  : view !== "active"
                    ? "No matching deals"
                    : "No consignments yet"
            }
            body={
              filtered
                ? "Try another search, date range, or filter."
                : hasOtherDeals
                  ? "Finished sales are in Archived after payout."
                  : view !== "active"
                    ? "Try another filter or date range."
                    : "Create a deal with customer details, photos, and payout split."
            }
            href={hasOtherDeals ? "/consignments?view=archived" : "/consignments/new"}
            action={hasOtherDeals ? "View archived" : "+ New consignment"}
          />
        ) : (
          <DealTable rows={xs.map(toDealRow)} />
        )}
        <Pager page={pager.current} pages={pager.pages} total={pager.total} size={pager.take} hrefFor={(p) => hrefFor({ ...query, page: p })} />
      </div>
    </Shell>
  );
}
