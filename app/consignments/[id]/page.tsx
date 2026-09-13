import Link from "next/link";
import Shell from "@/components/Shell";
import DealStatusSelect from "@/components/DealStatusSelect";
import DealItemCard from "@/components/DealItemCard";
import DealPayoutCard from "@/components/DealPayoutCard";
import DeleteConsignmentButton from "@/components/DeleteConsignmentButton";
import CopyField from "@/components/CopyField";
import { db } from "@/lib/db";
import { money, calc } from "@/lib/money";
import { ensureInfoToken, infoUrl, signUrl } from "@/lib/customer";
import { googleVerified } from "@/lib/address";
import { methodLabel } from "@/lib/labels";
import { isArchivedStatus } from "@/lib/deals";
import { notFound } from "next/navigation";
import { paid } from "./actions";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "item", label: "Item" },
  { id: "payout", label: "Payout" },
  { id: "customer", label: "Customer" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function dealTab(value?: string | null): Tab {
  return TABS.some((tab) => tab.id === value) ? (value as Tab) : "overview";
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const x = await db.consignment.findUnique({ where: { id }, select: { reference: true, title: true } });
  return { title: x?.title || x?.reference || "Consignment" };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = dealTab(rawTab);
  const x = await db.consignment.findUnique({
    where: { id },
    include: { customer: true, images: { orderBy: { createdAt: "asc" } } },
  });
  if (!x) return notFound();
  const split = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const mapsVerified =
    googleVerified(x.customer.payoutAddressVerified, x.customer.payoutAddressVerifiedSource) ||
    googleVerified(x.customer.addressVerified, x.customer.addressVerifiedSource);
  const sign = signUrl(x.acceptanceToken);
  const payoutLink = infoUrl(await ensureInfoToken(x.customerId));
  const photo = x.images[0]?.path;

  return (
    <Shell>
      <p className="crumb">
        <Link href="/consignments">Consignments</Link>
        <span> / {x.reference}</span>
      </p>

      <div className="account-shell">
        <nav className="account-nav" aria-label="Deal sections">
          {TABS.map((item) => (
            <Link key={item.id} href={`/consignments/${x.id}?tab=${item.id}`} className={tab === item.id ? "on" : undefined}>
              {item.label}
            </Link>
          ))}
          <DeleteConsignmentButton id={x.id} title={x.title} reference={x.reference} />
        </nav>

        <div className="account-main">
          {tab === "overview" ? (
            <div className="account-stack">
              <section className="account-section profile-ident">
                {photo ? (
                  <img src={photo} alt="" className="deal-ident-photo" />
                ) : (
                  <div className="deal-ident-photo placeholder">No photo</div>
                )}
                <div className="profile-ident-copy">
                  <h2>{x.title}</h2>
                  <p>
                    <Link className="text-link" href={`/customers/${x.customer.id}`}>
                      {x.customer.name}
                    </Link>
                    {x.platform ? ` · ${x.platform}` : ""}
                  </p>
                  <p className="muted">{x.reference}</p>
                </div>
                <DealStatusSelect id={x.id} status={x.status} />
              </section>

              {x.images.length > 1 ? (
                <div className="gallery deal-gallery">
                  {x.images.map((img) => (
                    <img key={img.id} src={img.path} alt="" />
                  ))}
                </div>
              ) : null}

              <section className="account-section">
                <div className="account-section-head">
                  <h2>Split</h2>
                </div>
                <dl className="fact-grid">
                  <div>
                    <dt>Sale</dt>
                    <dd>{money(x.salePriceCents)}</dd>
                  </div>
                  <div>
                    <dt>Consignor ({x.customerPercentBps / 100}%)</dt>
                    <dd>{money(split.customer)}</dd>
                  </div>
                  <div>
                    <dt>ITNX commission</dt>
                    <dd>{money(split.gross)}</dd>
                  </div>
                  <div>
                    <dt>ITNX net</dt>
                    <dd>{money(split.net)}</dd>
                  </div>
                </dl>
              </section>
            </div>
          ) : null}

          {tab === "item" ? (
            <DealItemCard
              id={x.id}
              title={x.title}
              category={x.category || ""}
              condition={x.condition || ""}
              serial={x.serialNumber || ""}
              location={x.location || ""}
              listingUrl={x.listingUrl || ""}
              description={x.description || ""}
              notes={x.notes || ""}
            />
          ) : null}

          {tab === "payout" ? (
            <div className="account-stack">
              <DealPayoutCard
                id={x.id}
                status={x.status}
                platform={x.platform || ""}
                method={x.method}
                salePriceCents={x.salePriceCents}
                askingPriceCents={x.askingPriceCents}
              />
              <section className="account-section">
                <div className="account-section-head">
                  <h2>Breakdown</h2>
                </div>
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
                    <b>{money(split.customer)}</b>
                  </div>
                  <div className="row">
                    <span>ITNX commission</span>
                    <b>{money(split.gross)}</b>
                  </div>
                  <div className="row">
                    <span>Auction fee (ITNX pays)</span>
                    <b>-{money(x.feeCents)}</b>
                  </div>
                  <div className="row big">
                    <span>ITNX net</span>
                    <span>{money(split.net)}</span>
                  </div>
                </div>
                <p className="muted">
                  The consignor is paid from the final sale. Fees come out of ITNX’s commission.{" "}
                  <a className="text-link" href="/consignment-agreement">
                    Agreement
                  </a>
                </p>
                <h3>Pay consignor {money(split.customer)}</h3>
                {!x.paid ? (
                  <form action={paid.bind(null, x.id)}>
                    <div className="field">
                      <label>Check / ACH / cash reference</label>
                      <input name="ref" placeholder="Check #, ACH id, or cash note" />
                    </div>
                    <div className="form-actions">
                      <button className="button" type="submit">
                        Mark paid
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="muted">
                    Paid{x.payoutReference ? ` · ${x.payoutReference}` : ""}. This deal is archived.
                    Change the status to move it back to Active.
                  </p>
                )}
              </section>
              <section className="account-section">
                <div className="account-section-head">
                  <h2>Customer links</h2>
                </div>
                <div className="field">
                  <label>Payout info</label>
                  <CopyField value={payoutLink} />
                </div>
                <div className="field" style={{ marginTop: 12 }}>
                  <label>Sign payout</label>
                  <CopyField value={sign} />
                </div>
                {x.acceptedAt ? (
                  <p className="muted">
                    Signed by {x.acceptedName} on {x.acceptedAt.toLocaleString()}
                  </p>
                ) : null}
              </section>
            </div>
          ) : null}

          {tab === "customer" ? (
            <div className="account-stack">
              <section className="account-section">
                <div className="account-section-head">
                  <h2>{x.customer.name}</h2>
                  <Link className="edit-btn" href={`/customers/${x.customer.id}`}>
                    Open profile
                  </Link>
                </div>
                <dl className="fact-grid">
                  <div>
                    <dt>Email</dt>
                    <dd>{x.customer.email || "—"}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{x.customer.phone || "—"}</dd>
                  </div>
                  <div className="full">
                    <dt>Address</dt>
                    <dd>{x.customer.address || "—"}</dd>
                  </div>
                  <div>
                    <dt>Payout method</dt>
                    <dd>{methodLabel(x.method)}</dd>
                  </div>
                  <div>
                    <dt>Payable to</dt>
                    <dd>{x.customer.checkPayableTo || x.customer.payoutName || x.customer.name}</dd>
                  </div>
                </dl>
                <div className="head-badges" style={{ justifyContent: "flex-start", marginTop: 14 }}>
                  <span className={x.customer.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
                    {x.customer.payoutReady ? "Payout info received" : "Needs payout info"}
                  </span>
                  <span className={mapsVerified ? "badge badge-ok" : "badge"}>
                    {mapsVerified ? "Address verified" : "Address not verified"}
                  </span>
                  <span className={x.customer.smsOptOut ? "badge badge-warn" : x.customer.smsConsent ? "badge badge-ok" : "badge"}>
                    {x.customer.smsOptOut ? "SMS opted out" : x.customer.smsConsent ? "SMS consent" : "No SMS consent"}
                  </span>
                  {isArchivedStatus(x.status) ? <span className="badge">Archived deal</span> : null}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
