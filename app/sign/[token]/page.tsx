import { db } from "@/lib/db";
import { calc, money } from "@/lib/money";
import { notFound } from "next/navigation";
import { accept } from "./actions";
import PayoutMethodFields from "@/components/PayoutMethodFields";
import PayoutDone from "@/components/PayoutDone";
import CustomerHero from "@/components/CustomerHero";
import { googleVerified } from "@/lib/address";
import { METHOD_HINT } from "@/lib/labels";
import { checkRunLabelForSale, isPayoutLinkExpired, PAYOUT_LINK_DAYS } from "@/lib/payout";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ signed?: string; error?: string }>;
}) {
  const { token } = await params;
  const q = await searchParams;
  const x = await db.consignment.findUnique({
    where: { acceptanceToken: token },
    include: { customer: true, images: { take: 3, orderBy: { createdAt: "asc" } } },
  });
  if (!x) return notFound();
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const brand = settings?.brandName || "ITNX Consignment";
  const legal = settings?.legalName || "NXRENT LLC";

  if (isPayoutLinkExpired(x.completedAt)) {
    return (
      <CustomerHero brand={brand} legal={legal}>
        <div className="portal-card portal-expired">
          <div className="portal-title">
            <div>
              <p className="kicker">Payout</p>
              <h1>This link has expired</h1>
            </div>
            {x.reference ? <span className="portal-id">ID# {x.reference}</span> : null}
          </div>
          <p className="portal-lead">
            The payout page for this consignment is only available for {PAYOUT_LINK_DAYS} days after the deal is
            completed. This link can no longer be opened.
          </p>
          {settings?.contactEmail ? (
            <p className="muted portal-note">
              If you need a copy of your payout details, contact us at{" "}
              <a href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>.
            </p>
          ) : (
            <p className="muted portal-note">If you need a copy of your payout details, contact ITNX.</p>
          )}
        </div>
      </CustomerHero>
    );
  }

  const split = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const person = x.customer;
  const done = Boolean(q.signed || x.acceptedAt);

  return (
    <CustomerHero brand={brand} legal={legal}>
      <div className="portal-card">
        {q.error ? <p className="form-error">{q.error}</p> : null}
        {done ? (
          <PayoutDone
            reference={x.reference}
            title={x.title}
            method={x.method}
            paid={x.paid}
            payoutReference={x.payoutReference}
            acceptedAt={x.acceptedAt}
            acceptedName={x.acceptedName}
            amountCents={split.customer}
            consignor={person}
          />
        ) : (
          <>
            <div className="portal-title">
              <div>
                <p className="kicker">Payout</p>
                <h1>Review and sign</h1>
              </div>
              <span className="portal-id">ID# {x.reference}</span>
            </div>
            <p className="portal-lead">
              Hello <b>{person.name}</b>. {METHOD_HINT[x.method]}
            </p>

            <div className="payout-receipt">
              {x.images[0] ? <img src={x.images[0].path} alt="" /> : <div className="payout-receipt-photo">Item</div>}
              <div className="payout-receipt-copy">
                <strong>{x.title}</strong>
                <span>
                  Sale {money(x.salePriceCents)} · Your share {x.customerPercentBps / 100}%
                </span>
              </div>
              <div className="payout-receive">
                <span>You receive</span>
                <b>{money(split.customer)}</b>
              </div>
            </div>

            <p className="muted portal-note">
              Auction and processing fees are paid by {legal} from its commission, not from your{" "}
              {money(split.customer)} share.{" "}
              <a href="/consignment-agreement">Read the agreement</a>.
            </p>
            {settings?.payoutNotes ? <p className="muted">{settings.payoutNotes}</p> : null}
            {x.method === "CHECK" ? (
              <p className="muted">
                Checks are normally processed on the 1st and 15th after the sale is complete and buyer funds have
                cleared. Yours is scheduled for {checkRunLabelForSale(x.acceptedAt)}. Delivery can move for weekends, holidays, or
                delays.
              </p>
            ) : null}

            <form action={accept.bind(null, token)} className="portal-form">
              <h2>Your details</h2>
              <div className="form">
                <div className="field">
                  <label>Legal name</label>
                  <input name="payoutName" required defaultValue={person.payoutName || person.name} />
                </div>
                <div className="field">
                  <label>Email</label>
                  <input name="payoutEmail" type="email" defaultValue={person.payoutEmail || person.email || ""} />
                </div>
                <div className="field full">
                  <label>Phone</label>
                  <input name="payoutPhone" defaultValue={person.payoutPhone || person.phone || ""} />
                </div>
              </div>

              <PayoutMethodFields
                method={x.method}
                checkPayableTo={person.checkPayableTo || person.payoutName || person.name}
                bankName={person.bankName || ""}
                accountLast4={person.accountLast4 || ""}
                street={person.payoutAddress || person.street || ""}
                city={person.payoutCity || person.city || ""}
                state={person.payoutState || person.state || ""}
                zip={person.payoutZip || person.zip || ""}
                alreadyVerified={
                  googleVerified(person.payoutAddressVerified, person.payoutAddressVerifiedSource) ||
                  googleVerified(person.addressVerified, person.addressVerifiedSource)
                }
              />

              <h2>Sign</h2>
              <p className="muted">
                By signing, I acknowledge the sale and this payout of <b>{money(split.customer)}</b> (
                {x.customerPercentBps / 100}% of the final sale). Third-party selling fees do not reduce my share.
              </p>
              <div className="field">
                <label>Type your full legal name as your signature</label>
                <input name="name" required defaultValue={person.payoutName || person.name} />
              </div>
              <div className="portal-agree">
                <label className="check-line">
                  <input name="agreePayout" type="checkbox" value="yes" required /> I agree to the payout above.
                </label>
                <label className="check-line">
                  <input name="agreeTerms" type="checkbox" value="yes" required /> I agree to the{" "}
                  <a href="/consignment-agreement" target="_blank" rel="noreferrer">
                    Consignment Agreement
                  </a>{" "}
                  and{" "}
                  <a href="/terms" target="_blank" rel="noreferrer">
                    Terms of Service
                  </a>
                  .
                </label>
                <label className="check-line">
                  <input name="smsConsent" type="checkbox" value="yes" defaultChecked={person.smsConsent && !person.smsOptOut} />
                  Text me about this payout. Reply STOP anytime.
                </label>
              </div>
              <button className="button portal-submit" type="submit">
                Accept &amp; sign
              </button>
            </form>
          </>
        )}
      </div>
    </CustomerHero>
  );
}
