import { db } from "@/lib/db";
import { calc, money } from "@/lib/money";
import { notFound } from "next/navigation";
import { accept } from "./actions";
import PayoutMethodFields from "@/components/PayoutMethodFields";
import CustomerHero from "@/components/CustomerHero";
import { googleVerified } from "@/lib/address";
import { METHOD_HINT, methodLabel } from "@/lib/labels";

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
  const c = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const brand = settings?.brandName || "ITNX Consignment";
  const legal = settings?.legalName || "NXRENT LLC";
  const person = x.customer;

  return (
    <div className="customer">
      <CustomerHero brand={brand} legal={legal} />
      <div className="card">
        <h2>Payout authorization</h2>
        {q.error ? <p className="form-error">{q.error}</p> : null}
        {q.signed || x.acceptedAt ? (
          <>
            <h2>Accepted</h2>
            <p>Your acceptance has been recorded.</p>
            <p className="big">
              {money(c.customer)} via {methodLabel(x.method)}
            </p>
          </>
        ) : (
          <>
            <p>
              Hello <b>{person.name}</b>. Please review this payout. {METHOD_HINT[x.method]}
            </p>
            {x.images.length ? (
              <div className="photo-grid">
                {x.images.map((img) => (
                  <img key={img.id} src={img.path} alt={x.title} />
                ))}
              </div>
            ) : null}
            <div className="summary">
              <div className="row">
                <span>Item</span>
                <b>{x.title}</b>
              </div>
              <div className="row">
                <span>Final sale price</span>
                <b>{money(x.salePriceCents)}</b>
              </div>
              <div className="row">
                <span>Your share of the sale</span>
                <b>{x.customerPercentBps / 100}%</b>
              </div>
              <div className="row big">
                <span>You receive</span>
                <span>{money(c.customer)}</span>
              </div>
              <div className="row">
                <span>Method</span>
                <b>{methodLabel(x.method)}</b>
              </div>
            </div>
            <p className="muted">
              Auction, marketplace, and processing fees are paid by {legal} from its commission. They are not taken
              from your {money(c.customer)} share.{" "}
              <a href="/consignment-agreement">Read the consignment agreement</a>.
            </p>
            {settings?.payoutNotes ? <p className="muted">{settings.payoutNotes}</p> : null}
            <form action={accept.bind(null, token)} className="stack-form">
              <h3>Your details</h3>
              <div className="field">
                <label>Legal name</label>
                <input name="payoutName" required defaultValue={person.payoutName || person.name} />
              </div>
              <div className="field">
                <label>Email</label>
                <input name="payoutEmail" type="email" defaultValue={person.payoutEmail || person.email || ""} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input name="payoutPhone" defaultValue={person.payoutPhone || person.phone || ""} />
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
              <p>
                By signing, I acknowledge the sale, this payout of <b>{money(c.customer)}</b> ({x.customerPercentBps / 100}% of
                the final sale price), and that third-party selling fees do not reduce my share.
              </p>
              <div className="field">
                <label>Type your full legal name as your signature</label>
                <input name="name" required defaultValue={person.payoutName || person.name} />
              </div>
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
              <button className="button" type="submit">
                Accept & Sign
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}