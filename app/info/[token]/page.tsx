import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { saveInfo } from "./actions";
import PayoutMethodFields from "@/components/PayoutMethodFields";
import CustomerHero from "@/components/CustomerHero";
import { googleVerified } from "@/lib/address";
import { METHOD_HINT, methodLabel } from "@/lib/labels";

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

  return (
    <CustomerHero brand={brand} legal={legal}>
      <div className="portal-card">
        <div className="portal-title">
          <div>
            <p className="kicker">Payout</p>
            <h1>Payout information</h1>
          </div>
          {latest?.reference ? <span className="portal-id">ID# {latest.reference}</span> : null}
        </div>
        {q.error ? <p className="form-error">{q.error}</p> : null}
        {q.saved || c.payoutReady ? <p className="form-ok">Thanks. We have your payout details on file.</p> : null}
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
            alreadyVerified={
              googleVerified(c.payoutAddressVerified, c.payoutAddressVerifiedSource) ||
              googleVerified(c.addressVerified, c.addressVerifiedSource)
            }
          />
          <label className="check-line">
            <input name="smsConsent" type="checkbox" value="yes" defaultChecked={c.smsConsent && !c.smsOptOut} />
            Text me about this payout. Reply STOP anytime. Msg & data rates may apply.
          </label>
          {settings?.payoutNotes ? <p className="muted">{settings.payoutNotes}</p> : null}
          <p className="muted">
            Your check is based on the agreed share of the final sale. Auction fees are paid by {legal}. See the{" "}
            <a href="/consignment-agreement">consignment agreement</a>.
          </p>
          <button className="button portal-submit" type="submit">
            Save payout information
          </button>
        </form>
      </div>
    </CustomerHero>
  );
}
