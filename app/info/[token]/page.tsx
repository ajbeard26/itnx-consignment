import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { saveInfo } from "./actions";
import AddressFields from "@/components/AddressFields";

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

  return (
    <div className="customer">
      <div className="customer-hero">
        <h1>{brand}</h1>
        <div className="muted">A service of {legal}</div>
      </div>
      <div className="card">
        <h2>Your payout information</h2>
        {q.error ? <p className="form-error">{q.error}</p> : null}
        {q.saved || c.payoutReady ? (
          <p className="form-ok">Thanks. We have your payout details on file.</p>
        ) : null}
        <p>
          Hello <b>{c.name}</b>. Please confirm how we should send payment when a consignment is sold.
        </p>
        {c.consignments[0] ? (
          <p className="muted">Latest item on file: {c.consignments[0].title}</p>
        ) : null}
        <form action={saveInfo.bind(null, token)} className="stack-form">
          <div className="field">
            <label>Legal name</label>
            <input name="payoutName" required defaultValue={c.payoutName || c.name} />
          </div>
          <div className="field">
            <label>Name on check / payable to</label>
            <input name="checkPayableTo" defaultValue={c.checkPayableTo || c.payoutName || c.name} />
          </div>
          <div className="field">
            <label>Email</label>
            <input name="payoutEmail" type="email" defaultValue={c.payoutEmail || c.email || ""} />
          </div>
          <div className="field">
            <label>Mobile phone</label>
            <input name="payoutPhone" defaultValue={c.payoutPhone || c.phone || ""} placeholder="(555) 555-5555" />
          </div>
          <h3>Mailing address</h3>
          <AddressFields
            names={{
              street: "payoutAddress",
              city: "payoutCity",
              state: "payoutState",
              zip: "payoutZip",
              verified: "payoutVerified",
            }}
            street={c.payoutAddress || c.street || ""}
            city={c.payoutCity || c.city || ""}
            state={c.payoutState || c.state || ""}
            zip={c.payoutZip || c.zip || ""}
            alreadyVerified={c.payoutAddressVerified || c.addressVerified}
          />
          <div className="field">
            <label>Bank name (if ACH)</label>
            <input name="bankName" defaultValue={c.bankName || ""} placeholder="Optional" />
          </div>
          <div className="field">
            <label>Account last 4 (if ACH)</label>
            <input
              name="accountLast4"
              inputMode="numeric"
              maxLength={4}
              pattern="[0-9]{4}"
              defaultValue={c.accountLast4 || ""}
              placeholder="1234"
            />
            <small className="muted">Never enter a full routing or account number here.</small>
          </div>
          <label className="check-line">
            <input name="smsConsent" type="checkbox" value="yes" defaultChecked={c.smsConsent && !c.smsOptOut} />
            Text me about this payout. Reply STOP anytime. Msg & data rates may apply.
          </label>
          {settings?.payoutNotes ? <p className="muted">{settings.payoutNotes}</p> : null}
          <button className="button" type="submit">
            Save payout information
          </button>
        </form>
      </div>
    </div>
  );
}