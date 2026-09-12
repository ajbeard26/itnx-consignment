import { db } from "@/lib/db";
import { calc, money } from "@/lib/money";
import { notFound } from "next/navigation";
import { accept } from "./actions";
import AddressFields from "@/components/AddressFields";

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
      <div className="customer-hero">
        <h1>{brand}</h1>
        <div className="muted">A service of {legal}</div>
      </div>
      <div className="card">
        <h2>Payout authorization</h2>
        {q.error ? <p className="form-error">{q.error}</p> : null}
        {q.signed || x.acceptedAt ? (
          <>
            <h2>Accepted</h2>
            <p>Your acceptance has been recorded.</p>
            <p className="big">
              {money(c.customer)} via {x.method}
            </p>
          </>
        ) : (
          <>
            <p>
              Hello <b>{person.name}</b>. Please review your consignment payout and confirm how we should pay you.
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
                <span>Sale price</span>
                <b>{money(x.salePriceCents)}</b>
              </div>
              <div className="row">
                <span>Your share</span>
                <b>{x.customerPercentBps / 100}%</b>
              </div>
              <div className="row big">
                <span>Your payout</span>
                <span>{money(c.customer)}</span>
              </div>
              <div className="row">
                <span>Method</span>
                <b>{x.method}</b>
              </div>
            </div>
            {settings?.payoutNotes ? <p className="muted">{settings.payoutNotes}</p> : null}
            <form action={accept.bind(null, token)} className="stack-form">
              <h3>How should we pay you?</h3>
              <div className="field">
                <label>Legal name</label>
                <input name="payoutName" required defaultValue={person.payoutName || person.name} />
              </div>
              <div className="field">
                <label>Name on check / payable to</label>
                <input name="checkPayableTo" defaultValue={person.checkPayableTo || person.payoutName || person.name} />
              </div>
              <div className="field">
                <label>Email</label>
                <input name="payoutEmail" type="email" defaultValue={person.payoutEmail || person.email || ""} />
              </div>
              <div className="field">
                <label>Phone</label>
                <input name="payoutPhone" defaultValue={person.payoutPhone || person.phone || ""} />
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
                street={person.payoutAddress || person.street || ""}
                city={person.payoutCity || person.city || ""}
                state={person.payoutState || person.state || ""}
                zip={person.payoutZip || person.zip || ""}
                alreadyVerified={person.payoutAddressVerified || person.addressVerified}
              />
              {x.method === "ACH" ? (
                <>
                  <div className="field">
                    <label>Bank name</label>
                    <input name="bankName" defaultValue={person.bankName || ""} />
                  </div>
                  <div className="field">
                    <label>Account last 4</label>
                    <input
                      name="accountLast4"
                      inputMode="numeric"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      defaultValue={person.accountLast4 || ""}
                    />
                    <small className="muted">Never enter a full routing or account number here.</small>
                  </div>
                </>
              ) : null}
              <p>
                By signing, I acknowledge the sale information and agree that my payout is{" "}
                <b>{money(c.customer)}</b>.
              </p>
              <div className="field">
                <label>Type your full legal name as your signature</label>
                <input name="name" required defaultValue={person.payoutName || person.name} />
              </div>
              <label className="check-line">
                <input type="checkbox" required /> I agree to the payout above.
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