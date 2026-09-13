import Shell from "@/components/Shell";
import ConsignmentForm from "@/components/ConsignmentForm";
import DealId from "@/components/DealId";
import { db } from "@/lib/db";
import { peekDealId } from "@/lib/reference";

export const metadata = { title: "New consignment" };

export default async function Page() {
  const [s, customers, nextId] = await Promise.all([
    db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
    db.customer.findMany({
      orderBy: { name: "asc" },
      take: 20,
      select: { id: true, name: true, email: true, phone: true, company: true, address: true },
    }),
    peekDealId(),
  ]);

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Deals</p>
          <h1>New consignment</h1>
          <p className="muted">Customer, item, and payout. The deal ID is for lookup on yard tags, texts, and search.</p>
        </div>
        <DealId value={nextId} />
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
