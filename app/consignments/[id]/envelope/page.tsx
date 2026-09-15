import Link from "next/link";
import { notFound } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import PrintButton from "@/components/PrintButton";
import { db } from "@/lib/db";
import { publicBrand, senderAddressLines } from "@/lib/brand";
import { mailingLines, mailingReady, payableTo } from "@/lib/payout";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({ where: { id }, select: { reference: true } });
  return { title: x ? `Print envelope · ${x.reference}` : "Print envelope" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!x) return notFound();
  const brand = await publicBrand();
  const payee = payableTo(x.customer);
  const mail = mailingLines(x.customer);
  const mailOk = mailingReady(x.customer);
  const returnLines = senderAddressLines(brand.address);

  return (
    <div className="envelope-print">
      <style>{`@media print { @page { size: 9.5in 4.125in; margin: 0; } }`}</style>
      <div className="ckstock-bar">
        <Link href={`/consignments/${x.id}?tab=payout`}>Back to deal</Link>
        <PrintButton label="Print envelope" />
      </div>

      <div className="ckstock-help">
        <p>
          Load a standard <b>#10</b> business envelope in the HP (4⅛ × 9½ in), print side as your printer
          shows for envelopes, flap to the left or as the tray diagram says. Then Print envelope.
        </p>
        <dl className="ckstock-opts">
          <div>
            <dt>Paper size</dt>
            <dd>Envelope #10</dd>
          </div>
          <div>
            <dt>Layout</dt>
            <dd>Landscape</dd>
          </div>
          <div>
            <dt>Margins</dt>
            <dd>None</dd>
          </div>
          <div>
            <dt>Headers and footers</dt>
            <dd>Off</dd>
          </div>
        </dl>
        {!mailOk ? (
          <p className="slip-warn">Mailing address is incomplete. Confirm the payee address before you print.</p>
        ) : (
          <p>
            {payee || "no payee"} · {mail.join(", ") || "no address"} · {x.reference}
          </p>
        )}
      </div>

      <div className="envelope-sheet" aria-label="Number 10 envelope">
        <div className="envelope-return">
          <BrandLogo size={36} className="envelope-logo" priority />
          <div>
            <strong>{brand.legal}</strong>
            <span>{brand.brand}</span>
            {returnLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
        <div className="envelope-to">
          <b>{payee || "—"}</b>
          {mail.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
