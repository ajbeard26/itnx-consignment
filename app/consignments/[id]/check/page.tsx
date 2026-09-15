import Link from "next/link";
import { notFound } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import PrintButton from "@/components/PrintButton";
import { db } from "@/lib/db";
import { publicBrand } from "@/lib/brand";
import { calc, money } from "@/lib/money";
import { bankLine, mailingLines, mailingReady, checkRunLabelForSale, payableTo } from "@/lib/payout";
import { prettyPhone } from "@/lib/phone";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({ where: { id }, select: { reference: true, method: true } });
  const kind = x?.method === "CHECK" ? "Payment statement" : "Payout slip";
  return { title: x ? `${kind} · ${x.reference}` : kind };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!x) return notFound();
  const brand = await publicBrand();
  const admin = await db.admin.findUnique({ where: { id: "staff" }, select: { email: true } });
  const split = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const how = x.method === "ACH" || x.method === "CASH" ? x.method : "CHECK";
  const payee = payableTo(x.customer);
  const mail = mailingLines(x.customer);
  const bank = bankLine(x.customer);
  const mailOk = mailingReady(x.customer);
  const phone = prettyPhone(x.customer.payoutPhone || x.customer.phone);
  const today = new Date().toLocaleDateString("en-US", { timeZone: "America/Detroit", year: "numeric", month: "long", day: "numeric" });
  const mailOn = checkRunLabelForSale(x.acceptedAt);
  const check = how === "CHECK";

  return (
    <div className="slip">
      <div className="slip-toolbar">
        <Link href={`/consignments/${x.id}?tab=payout`}>Back to deal</Link>
        <div className="slip-toolbar-actions">
          {check ? <Link href={`/consignments/${x.id}/stock`}>Print check</Link> : null}
          {check ? <Link href={`/consignments/${x.id}/envelope`}>Print envelope</Link> : null}
          <PrintButton label={check ? "Print statement" : "Print / save PDF"} />
        </div>
      </div>

      <article className="slip-sheet">
        <header className="slip-head">
          <BrandLogo size={48} className="slip-logo" priority />
          <div>
            <strong>{brand.brand}</strong>
            <span>A service of {brand.legal}</span>
            {brand.address ? <span>{brand.address}</span> : null}
            {brand.contactPhone || brand.contactEmail ? (
              <span>{[brand.contactPhone, brand.contactEmail].filter(Boolean).join(" · ")}</span>
            ) : null}
          </div>
        </header>

        {check && !mailOk ? (
          <p className="slip-warn">Mailing address is incomplete. Do not mail the check until the address is confirmed.</p>
        ) : null}
        {how === "ACH" && !bank ? (
          <p className="slip-warn">Bank details are incomplete. Do not send the transfer until the last four are on file.</p>
        ) : null}

        <p className="slip-kicker">{check ? "Payment statement" : "Payout record"}</p>
        <h1>{check ? payee || "Consignor" : how === "ACH" ? "Bank transfer" : "Cash payout"}</h1>
        {how !== "CHECK" ? (
          <p className="slip-lead">
            {how === "ACH"
              ? `Record of the bank transfer to ${payee || "the consignor"}.`
              : `Record of cash paid to ${payee || "the consignor"}.`}
          </p>
        ) : null}

        <div className="slip-amount">
          <span>{check ? "Check amount" : how === "ACH" ? "Transfer amount" : "Cash amount"}</span>
          <b>{money(split.customer)}</b>
        </div>

        <dl className="slip-facts four">
          <div>
            <dt>Deal ID</dt>
            <dd>{x.reference}</dd>
          </div>
          <div>
            <dt>Item</dt>
            <dd>{x.title}</dd>
          </div>
          <div>
            <dt>{check ? "Payment date" : "Date"}</dt>
            <dd>{check ? mailOn : today}</dd>
          </div>
          {check ? (
            <div>
              <dt>Check number</dt>
              <dd>{x.payoutReference || "—"}</dd>
            </div>
          ) : (
            <div>
              <dt>Method</dt>
              <dd>{how === "ACH" ? "ACH / bank" : "Cash"}</dd>
            </div>
          )}
        </dl>

        <section className="slip-record">
          <h2>Breakdown</h2>
          <div className="row">
            <span>Sale price</span>
            <b>{money(x.salePriceCents)}</b>
          </div>
          <div className="row">
            <span>ITNX commission</span>
            <b>{money(split.gross)}</b>
          </div>
          <div className="row">
            <span>Auction / platform fee (ITNX pays)</span>
            <b>{money(x.feeCents)}</b>
          </div>
          <div className="row big">
            <span>Your {check ? "check" : how === "ACH" ? "transfer" : "cash"} ({x.customerPercentBps / 100}%)</span>
            <b>{money(split.customer)}</b>
          </div>
        </section>

        <section className="slip-payee">
          <div>
            <h2>{check ? "Check payable to" : "Pay to"}</h2>
            <p className="slip-name">{payee || "—"}</p>
          </div>
          {check ? (
            <div>
              <h2>Mailed to</h2>
              {mail.length ? (
                <p>
                  {mail.map((line) => (
                    <span key={line}>
                      {line}
                      <br />
                    </span>
                  ))}
                  {phone ? <>Phone: {phone}</> : null}
                </p>
              ) : (
                <p>—</p>
              )}
            </div>
          ) : null}
          {how === "ACH" ? (
            <>
              <h2>Bank</h2>
              <p>{bank || "—"}</p>
              <p className="slip-note">Account last 4 only. No routing number on this form.</p>
            </>
          ) : null}
          {how === "CASH" ? (
            <p className="slip-note">Paid in person. No check is mailed.</p>
          ) : null}
        </section>

        <p className="slip-memo">
          Memo / reference: {x.reference}
          {x.payoutReference ? ` · ${x.payoutReference}` : ""}
        </p>

        <div className={`slip-sign${how === "CASH" ? " three" : ""}`}>
          <div>
            <span>{check ? "Issued by" : "Prepared by"}</span>
            <b>{brand.legal}</b>
            <small>{[brand.brand, brand.contactEmail || admin?.email].filter(Boolean).join(" · ")}</small>
          </div>
          <div>
            <span>Statement date</span>
            <b>{today}</b>
          </div>
          {how === "CASH" ? (
            <div>
              <span>Received by (consignor)</span>
              <b>{payee}</b>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
