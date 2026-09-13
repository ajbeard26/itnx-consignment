import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import { db } from "@/lib/db";
import { money, calc } from "@/lib/money";
import { ensureInfoToken, infoUrl, signUrl } from "@/lib/customer";
import { googleVerified } from "@/lib/address";
import { methodLabel } from "@/lib/labels";
import { notFound } from "next/navigation";
import Link from "next/link";
import { paid } from "./actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({ where: { id }, select: { reference: true } });
  return { title: x?.reference || "Consignment" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({
    where: { id },
    include: { customer: true, images: { orderBy: { createdAt: "asc" } } },
  });
  if (!x) return notFound();
  const c = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const mapsVerified =
    googleVerified(x.customer.payoutAddressVerified, x.customer.payoutAddressVerifiedSource) ||
    googleVerified(x.customer.addressVerified, x.customer.addressVerifiedSource);
  const url = signUrl(x.acceptanceToken);
  const payoutLink = infoUrl(await ensureInfoToken(x.customerId));

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">{x.reference}</p>
          <h1>{x.title}</h1>
          <p className="muted">
            {x.category || "Item"}
            {x.condition ? ` · ${x.condition}` : ""}
            {x.location ? ` · ${x.location}` : ""}
          </p>
        </div>
        <StatusBadge status={x.status} />
      </div>

      {x.images.length ? (
        <div className="gallery">
          {x.images.map((img) => (
            <img key={img.id} src={img.path} alt={x.title} />
          ))}
        </div>
      ) : null}

      <div className="detail-grid">
        <div className="card panel">
          <h2>Customer</h2>
          <p className="detail-name">
            <Link className="text-link" href={`/customers/${x.customer.id}`}>
              {x.customer.name}
            </Link>
          </p>
          {x.customer.company ? <p>{x.customer.company}</p> : null}
          <p className="muted">
            {x.customer.email || "No email"}
            <br />
            {x.customer.phone || "No phone"}
          </p>
          {x.customer.address ? <p>{x.customer.address}</p> : null}
          <p>
            <span className={x.customer.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
              {x.customer.payoutReady ? "Payout info received" : "Needs payout info"}
            </span>{" "}
            <span className={mapsVerified ? "badge badge-ok" : "badge"}>
              {mapsVerified ? "Address verified" : "Address not verified"}
            </span>{" "}
            <span className={x.customer.smsOptOut ? "badge badge-warn" : x.customer.smsConsent ? "badge badge-ok" : "badge"}>
              {x.customer.smsOptOut ? "SMS opted out" : x.customer.smsConsent ? "SMS consent" : "No SMS consent"}
            </span>
          </p>
          {x.customer.payoutReady ? (
            <dl className="facts">
              <div>
                <dt>Payable to</dt>
                <dd>{x.customer.checkPayableTo || x.customer.payoutName || x.customer.name}</dd>
              </div>
              <div>
                <dt>Mailing</dt>
                <dd>
                  {[x.customer.payoutAddress, x.customer.payoutCity, x.customer.payoutState, x.customer.payoutZip]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
              {x.customer.bankName || x.customer.accountLast4 ? (
                <div>
                  <dt>Bank</dt>
                  <dd>
                    {x.customer.bankName || "Bank"}
                    {x.customer.accountLast4 ? ` · ••••${x.customer.accountLast4}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <dl className="facts">
            <div>
              <dt>Platform</dt>
              <dd>{x.platform || "—"}</dd>
            </div>
            <div>
              <dt>Payout</dt>
              <dd>{methodLabel(x.method)}</dd>
            </div>
            {x.serialNumber ? (
              <div>
                <dt>Serial / VIN</dt>
                <dd>{x.serialNumber}</dd>
              </div>
            ) : null}
          </dl>
          {x.description ? (
            <>
              <h3>Description</h3>
              <p className="pre">{x.description}</p>
            </>
          ) : null}
          {x.notes ? (
            <>
              <h3>Internal notes</h3>
              <p className="pre">{x.notes}</p>
            </>
          ) : null}
          {x.listingUrl ? (
            <p>
              <a className="text-link" href={x.listingUrl} target="_blank" rel="noreferrer">
                Open listing
              </a>
            </p>
          ) : null}
          <h3>Customer payout info link</h3>
          <input className="copy-input" readOnly value={payoutLink} />
          <p className="muted">They can enter mailing address and how to get paid.</p>
          <h3>Digital acceptance</h3>
          <input className="copy-input" readOnly value={url} />
          <p className="muted">Send this link by text or email.</p>
          {x.acceptedAt ? (
            <p className="muted">
              Signed by {x.acceptedName} on {x.acceptedAt.toLocaleString()}
            </p>
          ) : null}
        </div>
        <div className="card panel">
          <h2>Payout breakdown</h2>
          <div className="summary">
            {x.askingPriceCents ? (
              <div className="row">
                <span>Asking</span>
                <b>{money(x.askingPriceCents)}</b>
              </div>
            ) : null}
            <div className="row">
              <span>Sale</span>
              <b>{money(x.salePriceCents)}</b>
            </div>
            <div className="row">
              <span>Consignor ({x.customerPercentBps / 100}% of sale)</span>
              <b>{money(c.customer)}</b>
            </div>
            <div className="row">
              <span>ITNX commission ({100 - x.customerPercentBps / 100}%)</span>
              <b>{money(c.gross)}</b>
            </div>
            <div className="row">
              <span>Auction fee (ITNX pays)</span>
              <b>-{money(x.feeCents)}</b>
            </div>
            <div className="row big">
              <span>ITNX net</span>
              <span>{money(c.net)}</span>
            </div>
          </div>
          <p className="muted">
            The consignor is paid from the final sale. Fees come out of ITNX’s commission.{" "}
            <a className="text-link" href="/consignment-agreement">
              Agreement
            </a>
          </p>
          <h3>Pay consignor {money(c.customer)}</h3>
          {!x.paid ? (
            <form action={paid.bind(null, x.id)}>
              <div className="field">
                <label>Check / ACH / cash reference</label>
                <input name="ref" placeholder="Check #, ACH id, or cash note" />
              </div>
              <br />
              <button className="button">Mark paid</button>
            </form>
          ) : (
            <p>
              <b>Paid</b> {x.payoutReference}
            </p>
          )}
        </div>
      </div>
    </Shell>
  );
}
