import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { saveInfo } from "./actions";
import PayoutMethodFields from "@/components/PayoutMethodFields";
import CustomerHero from "@/components/CustomerHero";
import { googleVerified } from "@/lib/address";
import { METHOD_HINT, methodLabel } from "@/lib/labels";
import { bankLine, mailingLines, nextCheckRunLabel, payableTo } from "@/lib/payout";
import { prettyPhone } from "@/lib/phone";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { token } = await params;
  const q = await searchParams;
  const c = await db.customer.findUnique({
    where: { infoToken: token },
    include: { consignments: { orderBy: { createdAt: "desc" }, take: 3 } },
  });
  if (!c) return notFound();
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const brand = settings?.brandName || "ITNX Consignment";
  const legal = settings?.legalName || "NXRENT LLC";
  const method = c.consignments[0]?.method || settings?.defaultMethod || "CHECK";
  const latest = c.consignments[0];
  const how = method === "ACH" || method === "CASH" ? method : "CHECK";
  const done = Boolean(q.saved || c.payoutReady);
  const first = (c.payoutName || c.name).trim().split(/\s+/)[0] || c.name;
  const payee = payableTo(c);
  const mail = mailingLines(c);
  const bank = bankLine(c);
  const phone = prettyPhone(c.payoutPhone || c.phone);
  const email = c.payoutEmail || c.email;
  const verified =
    googleVerified(c.payoutAddressVerified, c.payoutAddressVerifiedSource) ||
    googleVerified(c.addressVerified, c.addressVerifiedSource);

  const form = (
    <form action={saveInfo.bind(null, token)} className="portal-form">
      <h2>Your details</h2>
      <div className="form">
        <div className="field">
          <label>Legal name</label>
          <input name="payoutName" required defaultValue={c.payoutName || c.name} />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="payoutEmail" type="email" defaultValue={c.payoutEmail || c.email || ""} />
        </div>
        <div className="field full">
          <label>Mobile phone</label>
          <input name="payoutPhone" defaultValue={c.payoutPhone || c.phone || ""} placeholder="(555) 555-5555" />
        </div>
      </div>
      <PayoutMethodFields
        method={method}
        checkPayableTo={c.checkPayableTo || c.payoutName || c.name}
        bankName={c.bankName || ""}
        accountLast4={c.accountLast4 || ""}
        street={c.payoutAddress || c.street || ""}
        city={c.payoutCity || c.city || ""}
        state={c.payoutState || c.state || ""}
        zip={c.payoutZip || c.zip || ""}
        alreadyVerified={verified}
      />
      <label className="check-line">
        <input name="smsConsent" type="checkbox" value="yes" defaultChecked={c.smsConsent && !c.smsOptOut} />
        Text me about this payout. Reply STOP anytime. Msg & data rates may apply.
      </label>
      {settings?.payoutNotes ? <p className="muted">{settings.payoutNotes}</p> : null}
      {how === "CHECK" && !latest?.paid ? (
        <p className="muted">
          Checks are normally processed on the 1st and 15th after the sale is complete and buyer funds have
          cleared. Yours is scheduled for {nextCheckRunLabel()}. Delivery can move for weekends, holidays, or
          delays.
        </p>
      ) : null}
      <p className="muted">
        Your check is based on the agreed share of the final sale. Auction fees are paid by {legal}. See the{" "}
        <a href="/consignment-agreement">consignment agreement</a>.
      </p>
      <button className="button portal-submit" type="submit">
        {done ? "Update details" : "Save payout information"}
      </button>
    </form>
  );

  return (
    <CustomerHero brand={brand} legal={legal}>
      <div className="portal-card">
        {q.error ? <p className="form-error">{q.error}</p> : null}

        {done ? (
          <div className="portal-done">
            <div className="portal-title">
              <div>
                <p className="kicker">All set</p>
                <h1>You’re all set</h1>
              </div>
              {latest?.reference ? <span className="portal-id">ID# {latest.reference}</span> : null}
            </div>
            <p className="portal-lead">
              Thanks, {first}. We have your {how === "CHECK" ? "mailing" : how === "ACH" ? "bank" : "payout"} details
              on file
              {latest?.paid && how === "CHECK"
                ? ", and your check is on the way"
                : latest?.paid && how === "ACH"
                  ? ", and your transfer is on the way"
                  : ""}
              .
            </p>

            {latest ? <p className="payout-item">{latest.title}</p> : null}

            {how === "CHECK" && (payee || mail.length) ? (
              <p className="payout-mail">
                <strong>Mail to</strong>
                {payee}
                {mail.map((line) => (
                  <span key={line}>{line}</span>
                ))}
                {phone ? <span>{phone}</span> : null}
                {email ? <span>{email}</span> : null}
              </p>
            ) : null}

            {how === "ACH" ? (
              <p className="payout-mail">
                <strong>Bank</strong>
                {payee}
                <span>{bank || "On file"}</span>
                {email ? <span>{email}</span> : null}
              </p>
            ) : null}

            {how === "CASH" ? (
              <p className="payout-mail">
                <strong>Payout</strong>
                {payee}
                <span>Cash, in person</span>
              </p>
            ) : null}

            {how === "CHECK" && !latest?.paid ? (
              <p className="muted portal-note">
                Checks are normally processed on the 1st and 15th. Yours is scheduled for {nextCheckRunLabel()}.
              </p>
            ) : null}

            {latest?.paid ? (
              <p className="muted portal-note">
                These details are locked because this payout has already been sent.
              </p>
            ) : (
              <details className="portal-update">
                <summary>Need to update these details?</summary>
                {form}
              </details>
            )}
          </div>
        ) : (
          <>
            <div className="portal-title">
              <div>
                <p className="kicker">Payout</p>
                <h1>Payout information</h1>
              </div>
              {latest?.reference ? <span className="portal-id">ID# {latest.reference}</span> : null}
            </div>
            <p className="portal-lead">
              Hello <b>{c.name}</b>. {METHOD_HINT[method]}
            </p>
            {latest ? (
              <div className="payout-receipt compact">
                <div className="payout-receipt-copy">
                  <strong>{latest.title}</strong>
                  <span>{methodLabel(method)}</span>
                </div>
              </div>
            ) : (
              <p className="muted">{methodLabel(method)}</p>
            )}
            {form}
          </>
        )}
      </div>
    </CustomerHero>
  );
}
