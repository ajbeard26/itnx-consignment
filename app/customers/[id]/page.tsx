import Link from "next/link";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import AddressFields from "@/components/AddressFields";
import SmsPanel from "@/components/SmsPanel";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { ensureInfoToken, infoUrl } from "@/lib/customer";
import { telnyxConfigured } from "@/lib/telnyx";
import { notFound } from "next/navigation";
import { updateCustomer } from "../actions";
import DeleteCustomerButton from "@/components/DeleteCustomerButton";
import { googleVerified } from "@/lib/address";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name || "Customer" };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      consignments: {
        include: { images: { take: 1, orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 12 },
    },
  });
  if (!c) return notFound();
  const mapsVerified = googleVerified(c.addressVerified, c.addressVerifiedSource) || googleVerified(c.payoutAddressVerified, c.payoutAddressVerifiedSource);
  const token = await ensureInfoToken(c.id);
  const payoutLink = infoUrl(token);
  const settings = await db.settings.findUnique({ where: { id: 1 } });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Customer</p>
          <h1>{c.name}</h1>
          <p className="muted">
            {c.company || "Individual"}
            {c.email ? ` · ${c.email}` : ""}
            {c.phone ? ` · ${c.phone}` : ""}
          </p>
        </div>
        <div className="head-badges">
          <span className={c.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
            {c.payoutReady ? "Payout info received" : "Waiting on payout info"}
          </span>
          <span className={mapsVerified ? "badge badge-ok" : "badge"}>
            {mapsVerified ? "Google address verified" : "Address not verified"}
          </span>
          <DeleteCustomerButton id={c.id} name={c.name} deals={c.consignments.length} />
        </div>
      </div>

      <div className="detail-grid">
        <form action={updateCustomer.bind(null, c.id)} className="card panel">
          <h2>Contact</h2>
          <div className="form">
            <div className="field">
              <label>Full name</label>
              <input name="name" required defaultValue={c.name} />
            </div>
            <div className="field">
              <label>Company</label>
              <input name="company" defaultValue={c.company || ""} />
            </div>
            <div className="field">
              <label>Email</label>
              <input name="email" type="email" defaultValue={c.email || ""} />
            </div>
            <div className="field">
              <label>Phone</label>
              <input name="phone" defaultValue={c.phone || ""} />
            </div>
          </div>
          <h3>Address</h3>
          <AddressFields
            street={c.street || ""}
            city={c.city || ""}
            state={c.state || ""}
            zip={c.zip || ""}
            alreadyVerified={googleVerified(c.addressVerified, c.addressVerifiedSource)}
            required={false}
          />
          <div className="form-actions" style={{ marginTop: 16 }}>
            <button className="button" type="submit">
              Save contact
            </button>
          </div>
        </form>

        <div className="stack">
          <div className="card panel">
            <h2>Payout details</h2>
            <p className="muted">Send this private link so they can enter mailing and payout information.</p>
            <input className="copy-input" readOnly value={payoutLink} />
            {c.payoutReady ? (
              <dl className="facts">
                <div>
                  <dt>Payable to</dt>
                  <dd>{c.checkPayableTo || c.payoutName || c.name}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{c.payoutEmail || "—"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{c.payoutPhone || "—"}</dd>
                </div>
                <div>
                  <dt>Mailing</dt>
                  <dd>
                    {[c.payoutAddress, c.payoutCity, c.payoutState, c.payoutZip].filter(Boolean).join(", ") || "—"}
                  </dd>
                </div>
                <div>
                  <dt>Bank</dt>
                  <dd>{c.bankName ? `${c.bankName}${c.accountLast4 ? ` · ••••${c.accountLast4}` : ""}` : "—"}</dd>
                </div>
              </dl>
            ) : (
              <p className="muted">They have not submitted payout info yet.</p>
            )}
          </div>
          <div className="card panel">
            <h2>Text messages</h2>
            <p className="muted">Ask for SMS consent, then send the payout or signature link from Telnyx.</p>
            <SmsPanel
              customerId={c.id}
              phone={c.phone || c.payoutPhone || ""}
              consent={c.smsConsent}
              optedOut={c.smsOptOut}
              configured={Boolean(settings && telnyxConfigured(settings))}
              messages={c.messages.map((m) => ({
                id: m.id,
                direction: m.direction,
                body: m.body,
                status: m.status,
                createdAt: m.createdAt.toISOString(),
              }))}
            />
          </div>
        </div>
      </div>

      <section className="card panel" style={{ marginTop: 16 }}>
        <div className="section-head">
          <h2>Consignments</h2>
          <Link className="text-link" href={`/consignments/new`}>
            New deal
          </Link>
        </div>
        {c.consignments.length === 0 ? (
          <p className="muted">No consignments for this customer yet.</p>
        ) : (
          <div className="deal-list compact">
            {c.consignments.map((x) => (
              <Link key={x.id} href={`/consignments/${x.id}`} className="deal">
                {x.images[0] ? (
                  <img src={x.images[0].path} alt="" className="deal-thumb" />
                ) : (
                  <div className="deal-thumb placeholder">No photo</div>
                )}
                <div>
                  <div className="deal-title">{x.title}</div>
                  <div className="muted">{x.reference}</div>
                </div>
                <div className="deal-meta">
                  <b>{money(x.salePriceCents || x.askingPriceCents)}</b>
                  <StatusBadge status={x.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </Shell>
  );
}