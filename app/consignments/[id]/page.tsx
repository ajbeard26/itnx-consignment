import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import { db } from "@/lib/db";
import { money, calc } from "@/lib/money";
import { notFound } from "next/navigation";
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
  const url = `${process.env.NEXT_PUBLIC_APP_URL || ""}/sign/${x.acceptanceToken}`;

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
          <p className="detail-name">{x.customer.name}</p>
          {x.customer.company ? <p>{x.customer.company}</p> : null}
          <p className="muted">
            {x.customer.email || "No email"}
            <br />
            {x.customer.phone || "No phone"}
          </p>
          {x.customer.address ? <p>{x.customer.address}</p> : null}
          <dl className="facts">
            <div>
              <dt>Platform</dt>
              <dd>{x.platform || "—"}</dd>
            </div>
            <div>
              <dt>Payout</dt>
              <dd>{x.method}</dd>
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
            <div className="row">
              <span>Sale</span>
              <b>{money(x.salePriceCents)}</b>
            </div>
            <div className="row">
              <span>Customer ({x.customerPercentBps / 100}%)</span>
              <b>{money(c.customer)}</b>
            </div>
            <div className="row">
              <span>ITNX gross</span>
              <b>{money(c.gross)}</b>
            </div>
            <div className="row">
              <span>Fee</span>
              <b>-{money(x.feeCents)}</b>
            </div>
            <div className="row big">
              <span>ITNX net</span>
              <span>{money(c.net)}</span>
            </div>
          </div>
          <h3>Pay customer {money(c.customer)}</h3>
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
