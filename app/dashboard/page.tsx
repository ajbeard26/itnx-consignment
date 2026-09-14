import Shell from "@/components/Shell";
import DealTable, { toDealRow } from "@/components/DealTable";
import EmptyState from "@/components/EmptyState";
import { db } from "@/lib/db";
import { money, calc } from "@/lib/money";
import { isArchivedStatus } from "@/lib/deals";
import { nextCheckRunLabel } from "@/lib/payout";
import { backfillCustomerIds } from "@/lib/customer";
import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Boxes, CircleDollarSign, HandCoins, Plus } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function Page() {
  await backfillCustomerIds();
  const [totals, recent] = await Promise.all([
    db.consignment.findMany({
      select: { salePriceCents: true, customerPercentBps: true, feeCents: true, paid: true, status: true },
    }),
    db.consignment.findMany({
      where: { NOT: { status: { in: ["PAID", "COMPLETED"] } } },
      include: { customer: true, images: { take: 1, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);
  const active = totals.filter((x) => !isArchivedStatus(x.status));
  let sales = 0,
    due = 0,
    net = 0,
    unpaid = 0;
  totals.forEach((x) => {
    sales += x.salePriceCents;
    const c = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
    if (!x.paid && !isArchivedStatus(x.status)) {
      due += c.customer;
      unpaid += 1;
    }
    net += c.net;
  });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Overview</p>
          <h1>Administration Center</h1>
          <p className="muted">Consignments, sales, and payouts in one place.</p>
        </div>
        <Link className="button" href="/consignments/new">
          <Plus size={17} /> New consignment
        </Link>
      </div>
      <div className="stats">
        <div className="card stat stat-blue">
          <div className="stat-top"><span className="stat-icon"><Boxes size={19} /></span><span className="stat-note">Live</span></div>
          <span className="stat-label">Active deals</span>
          <div className="metric">{active.length}</div>
          <span className="stat-foot">Currently in progress</span>
        </div>
        <div className="card stat stat-violet">
          <div className="stat-top"><span className="stat-icon"><CircleDollarSign size={19} /></span><span className="stat-note">All time</span></div>
          <span className="stat-label">Gross sales</span>
          <div className="metric">{money(sales)}</div>
          <span className="stat-foot">Total closed value</span>
        </div>
        <div className="card stat stat-amber">
          <div className="stat-top"><span className="stat-icon"><HandCoins size={19} /></span><span className="stat-note">Action</span></div>
          <span className="stat-label">Payouts due</span>
          <div className="metric">{money(due)}</div>
          <span className="stat-foot">
            {unpaid} unpaid consignor{unpaid === 1 ? "" : "s"}
            {unpaid ? ` · next process day ${nextCheckRunLabel()}` : ""}
          </span>
        </div>
        <div className="card stat stat-green">
          <div className="stat-top"><span className="stat-icon"><BadgeDollarSign size={19} /></span><span className="stat-note">Net</span></div>
          <span className="stat-label">ITNX net</span>
          <div className="metric">{money(net)}</div>
          <span className="stat-foot">After auction fees</span>
        </div>
      </div>
      <section className="card recent-card">
        <div className="section-head">
          <div>
            <h2>Recent consignments</h2>
            <p className="section-sub">Your latest active inventory and sales</p>
          </div>
          <Link href="/consignments" className="text-link">
            View all <ArrowRight size={15} />
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title={totals.length ? "No active deals" : "Nothing here yet"}
            body={
              totals.length
                ? "Finished sales move to Consignments → Archived after payout."
                : "Start with a consignment: customer, photos, sale price, and split."
            }
            href={totals.length ? "/consignments?view=archived" : "/consignments/new"}
            action={totals.length ? "View archived" : "+ New consignment"}
          />
        ) : (
          <DealTable rows={recent.map(toDealRow)} />
        )}
      </section>
    </Shell>
  );
}
