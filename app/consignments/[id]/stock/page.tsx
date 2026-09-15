import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import { db } from "@/lib/db";
import { calc, money, moneyWordsLine } from "@/lib/money";
import { checkDateMdY, payableTo } from "@/lib/payout";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({ where: { id }, select: { reference: true } });
  return { title: x ? `Print check · ${x.reference}` : "Print check" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!x) return notFound();
  const split = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const payee = payableTo(x.customer);
  const date = checkDateMdY(x.acceptedAt);
  const amount = money(split.customer).replace("$", "");
  const words = moneyWordsLine(split.customer);
  const memo = x.reference;

  return (
    <div className="ckstock">
      <style>{`@media print { @page { size: letter; margin: 0; } }`}</style>
      <div className="ckstock-bar">
        <Link href={`/consignments/${x.id}?tab=payout`}>Back to deal</Link>
        <div className="slip-toolbar-actions">
          <Link href={`/consignments/${x.id}/envelope`}>Print envelope</Link>
          <PrintButton label="Print this check" />
        </div>
      </div>

      <div className="ckstock-help">
        <p>
          Load <b>one</b> check in the HP, print-side down, top of the check going in first. Then Print this check.
          In that right-hand panel, change only this:
        </p>
        <dl className="ckstock-opts">
          <div>
            <dt>Margins</dt>
            <dd>None</dd>
          </div>
          <div>
            <dt>Paper size</dt>
            <dd>Letter — leave it</dd>
          </div>
          <div>
            <dt>Scale</dt>
            <dd>Default — leave it</dd>
          </div>
          <div>
            <dt>Headers and footers</dt>
            <dd>Off</dd>
          </div>
        </dl>
        <p>
          {payee || "no payee"} · ${amount} · {date} · {memo}. Enter that check number when you mark paid.
        </p>
      </div>

      <div className="ckstock-page">
        <section className="ckstock-slot fill">
          <span className="ck-stub-date">{date}</span>
          <span className="ck-stub-amt">{amount}</span>
          <span className="ck-stub-payee">{payee}</span>
          <span className="ck-date">{date}</span>
          <span className="ck-payee">{payee}</span>
          <span className="ck-amt">{amount}</span>
          <span className="ck-words">{words}</span>
          <span className="ck-memo">{memo}</span>
        </section>
      </div>
    </div>
  );
}
