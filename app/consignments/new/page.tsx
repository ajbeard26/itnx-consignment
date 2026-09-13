import Shell from "@/components/Shell";
import ConsignmentForm from "@/components/ConsignmentForm";
import { db } from "@/lib/db";

export const metadata = { title: "New consignment" };

export default async function Page() {
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const customers = await db.customer.findMany({
    orderBy: { name: "asc" },
    take: 20,
    select: { id: true, name: true, email: true, phone: true, company: true, address: true },
  });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Deals</p>
          <h1>New consignment</h1>
          <p className="muted">Pull a GovDeals listing, pick a customer, then confirm sale, commission tier, and payout.</p>
        </div>
      </div>
      <ConsignmentForm
        customers={customers}
        percent={s.defaultCustomerPercentBps / 100}
        method={s.defaultMethod}
        platform={s.defaultPlatform || ""}
      />
    </Shell>
  );
}