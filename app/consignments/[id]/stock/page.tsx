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
      <style>{`@media print { @page { size: 8.5in 2.75in; margin: 0; } }`}</style>
      <div className="ckstock-bar">
        <Link href={`/consignments/${x.id}?tab=payout`}>Back to deal</Link>
        <PrintButton label="Print this check" />
      </div>
      <p className="ckstock-help">
        Tear off one blank and load that single check in the HP OfficeJet — print-side down, top of the check going
        in first. In the print dialog: <b>1 copy</b>, <b>100%</b>, no “fit to page,” headers off. Paper size: custom{" "}
        <b>8.5 × 2.75 in</b> (one check, not Letter). Then enter that check number when you mark paid.
      </p>
      <p className="ckstock-help facts">
        {payee || "no payee"} · ${amount} · {date} · {memo}
      </p>

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
