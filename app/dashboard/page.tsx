import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { db } from "@/lib/db";
import { money, calc } from "@/lib/money";
import Link from "next/link";

export const metadata = { title: "Dashboard" };

export default async function Page() {
  const xs = await db.consignment.findMany({
    include: { customer: true, images: { take: 1, orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  let sales = 0,
    due = 0,
    net = 0,
    unpaid = 0;
  xs.forEach((x) => {
    sales += x.salePriceCents;
    const c = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
    if (!x.paid) {
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
          + New consignment
        </Link>
      </div>
      <div className="stats">
        <div className="card stat">
          <span className="muted">Consignments</span>
          <div className="metric">{xs.length}</div>
        </div>
        <div className="card stat">
          <span className="muted">Gross sales</span>
          <div className="metric">{money(sales)}</div>
        </div>
        <div className="card stat">
          <span className="muted">Payouts due</span>
          <div className="metric">{money(due)}</div>
          <span className="muted">{unpaid} unpaid</span>
        </div>
        <div className="card stat">
          <span className="muted">ITNX net</span>
          <div className="metric">{money(net)}</div>
        </div>
      </div>
      <section className="card">
        <div className="section-head">
          <h2>Recent</h2>
          <Link href="/consignments" className="text-link">
            View all
          </Link>
        </div>
        {xs.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body="Start with a consignment: customer, photos, sale price, and split."
            href="/consignments/new"
            action="+ New consignment"
          />
        ) : (
          <div className="deal-list compact">
            {xs.slice(0, 8).map((x) => (
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
                  </div>
                </div>
                <div className="deal-meta">
                  <b>{money(x.salePriceCents || x.askingPriceCents)}</b>
                  <StatusBadge status={x.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}
