import Link from "next/link";
import { notFound } from "next/navigation";
import BrandLogo from "@/components/BrandLogo";
import PrintButton from "@/components/PrintButton";
import { db } from "@/lib/db";
import { publicBrand } from "@/lib/brand";
import { calc, money, moneyWords } from "@/lib/money";
import { METHOD_LABEL } from "@/lib/labels";
import { bankLine, mailingLines, mailingReady, payableTo } from "@/lib/payout";
import { prettyPhone } from "@/lib/phone";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({ where: { id }, select: { reference: true, method: true } });
  const kind = x?.method === "CHECK" ? "Check request" : "Payout slip";
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
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="slip">
      <div className="slip-toolbar">
        <Link href={`/consignments/${x.id}?tab=payout`}>Back to deal</Link>
        <PrintButton />
      </div>

      <article className="slip-sheet">
        <header className="slip-head">
          <BrandLogo size={56} className="slip-logo" priority />
          <div>
            <strong>{brand.brand}</strong>
            <span>A service of {brand.legal}</span>
            {brand.address ? <span>{brand.address}</span> : null}
            {brand.contactPhone || brand.contactEmail ? (
              <span>{[brand.contactPhone, brand.contactEmail].filter(Boolean).join(" · ")}</span>
            ) : null}
          </div>
        </header>

        {how === "CHECK" && !mailOk ? (
          <p className="slip-warn">Mailing address is incomplete. Do not issue the check until the address is confirmed.</p>
        ) : null}
        {how === "ACH" && !bank ? (
          <p className="slip-warn">Bank details are incomplete. Do not send the transfer until the last four are on file.</p>
        ) : null}

        <dl className="slip-facts">
          <div>
            <dt>Date</dt>
            <dd>{today}</dd>
          </div>
          <div>
            <dt>Deal ID</dt>
            <dd>{x.reference}</dd>
          </div>
          <div>
            <dt>Method</dt>
            <dd>{METHOD_LABEL[how]}</dd>
          </div>
          <div>
            <dt>Item</dt>
            <dd>{x.title}</dd>
          </div>
        </dl>

        <div className="slip-amount">
          <span>Amount</span>
          <b>{money(split.customer)}</b>
          <small>{moneyWords(split.customer)}</small>
        </div>

        <section className="slip-payee">
          <h2>{how === "CHECK" ? "Pay to the order of" : "Pay to"}</h2>
          <p className="slip-name">{payee || "—"}</p>
          {how === "CHECK" ? (
            <>
              <h2>Mail to</h2>
              {mail.length ? (
                <p>
                  {payee ? (
                    <>
                      {payee}
                      <br />
                    </>
                  ) : null}
                  {mail.map((line) => (
                    <span key={line}>
                      {line}
                      <br />
                    </span>
                  ))}
                  {phone ? (
                    <>
                      Phone: {phone}
                      <br />
                    </>
                  ) : null}
                </p>
              ) : (
                <p>—</p>
              )}
            </>
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
            <span>Requested by</span>
            <b>{brand.legal}</b>
            <small>{[brand.brand, brand.contactEmail || admin?.email].filter(Boolean).join(" · ")}</small>
          </div>
          <div>
            <span>Date</span>
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
