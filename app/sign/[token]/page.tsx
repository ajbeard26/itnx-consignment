import { db } from "@/lib/db";
import { calc, money } from "@/lib/money";
import { notFound } from "next/navigation";
import { accept } from "./actions";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ signed?: string }>;
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

  return (
    <div className="customer">
      <div className="customer-hero">
        <h1>{brand}</h1>
        <div className="muted">A service of {legal}</div>
      </div>
      <div className="card">
        <h2>Payout authorization</h2>
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
              Hello <b>{x.customer.name}</b>. Please review your consignment payout.
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
            <p>
              By signing, I acknowledge the sale information and agree that my payout is{" "}
              <b>{money(c.customer)}</b>.
            </p>
            <form action={accept.bind(null, token)}>
              <div className="field">
                <label>Type your full legal name as your signature</label>
                <input name="name" required />
              </div>
              <br />
              <label className="check-line">
                <input type="checkbox" required /> I agree to the payout above.
              </label>
              <br />
              <br />
              <button className="button">Accept & Sign</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
