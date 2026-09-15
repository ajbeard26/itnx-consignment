import Link from "next/link";
import Shell from "@/components/Shell";
import DealStatusSelect from "@/components/DealStatusSelect";
import DealItemCard from "@/components/DealItemCard";
import DealPayoutCard from "@/components/DealPayoutCard";
import DeleteConsignmentButton from "@/components/DeleteConsignmentButton";
import ShareLink from "@/components/ShareLink";
import DealId from "@/components/DealId";
import DealPhotos from "@/components/DealPhotos";
import { db } from "@/lib/db";
import { money, calc } from "@/lib/money";
import { signUrl, ensureCustomerReference } from "@/lib/customer";
import { googleVerified } from "@/lib/address";
import { methodLabel } from "@/lib/labels";
import { bankLine, mailingLines, payableTo } from "@/lib/payout";
import { notFound } from "next/navigation";
import SendDealLink from "@/components/SendDealLink";
import PayConsignor from "@/components/PayConsignor";
import { shortDate, shortDateTime } from "@/lib/dates";
import { safeHttpUrl } from "@/lib/safe";
import { initials } from "@/lib/initials";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "item", label: "Item" },
  { id: "payout", label: "Payout" },
  { id: "customer", label: "Customer" },
  { id: "acceptance", label: "Acceptance" },
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
    include: { customer: true, images: { orderBy: { createdAt: "asc" } }, events: { orderBy: { createdAt: "desc" } } },
  });
  if (!x) return notFound();
  const customerReference = await ensureCustomerReference(x.customer.id);
  if (customerReference && !x.customer.reference) x.customer.reference = customerReference;
  const split = calc(x.salePriceCents, x.customerPercentBps, x.feeCents);
  const mapsVerified =
    googleVerified(x.customer.payoutAddressVerified, x.customer.payoutAddressVerifiedSource) ||
    googleVerified(x.customer.addressVerified, x.customer.addressVerifiedSource);
  const mail = mailingLines(x.customer);
  const bank = bankLine(x.customer);
  const payee = payableTo(x.customer);
  const sign = signUrl(x.acceptanceToken);
  const photo = x.images[0]?.path;
  const listingHref = safeHttpUrl(x.listingUrl || "");

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
              {item.id === "payout" ? (
                x.paid ? (
                  <span className="nav-tag">Paid</span>
                ) : (
                  <span className="nav-dot" aria-label="Unpaid" />
                )
              ) : null}
            </Link>
          ))}
          <div className="account-nav-foot">
            <DeleteConsignmentButton id={x.id} title={x.title} reference={x.reference} />
          </div>
        </nav>

        <div className="account-main">
          {tab === "overview" ? (
            <div className="account-stack">
              <section className="account-section profile-ident">
                {photo ? (
                  <img src={photo} alt="" className="deal-ident-photo" />
                ) : (
                  <div className="deal-ident-photo placeholder" aria-hidden />
                )}
                <div className="profile-ident-copy">
                  <h2>{x.title}</h2>
                  <p className="profile-meta">
                    <Link className="text-link" href={`/customers/${x.customer.id}`}>
                      {x.customer.name}
                    </Link>
                    {x.platform ? ` · ${x.platform}` : ""}
                  </p>
                </div>
                <div className="profile-ident-aside">
                  <DealId value={x.reference} />
                  <DealStatusSelect id={x.id} status={x.status} />
                </div>
              </section>

              <section className="account-section">
                <div className="fact-block">
                  <h3>Details</h3>
                  <dl className="fact-grid">
                    <div>
                      <dt>Opened</dt>
                      <dd>{shortDate(x.createdAt)}</dd>
                    </div>
                    {x.listedAt ? (
                      <div>
                        <dt>Listed</dt>
                        <dd>{shortDate(x.listedAt)}</dd>
                      </div>
                    ) : null}
                    {x.acceptedAt ? (
                      <div>
                        <dt>Signed</dt>
                        <dd>{shortDate(x.acceptedAt)}</dd>
                      </div>
                    ) : null}
                    {x.completedAt ? (
                      <div>
                        <dt>Completed</dt>
                        <dd>{shortDate(x.completedAt)}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Paid</dt>
                      <dd>
                        {x.paid
                          ? x.payoutReference
                            ? `Check ${x.payoutReference}`
                            : "Paid"
                          : "Unpaid"}
                      </dd>
                    </div>
                    {x.location ? (
                      <div>
                        <dt>Storage</dt>
                        <dd>{x.location}</dd>
                      </div>
                    ) : null}
                    {listingHref ? (
                      <div>
                        <dt>Listing</dt>
                        <dd>
                          <a className="text-link" href={listingHref} target="_blank" rel="noopener noreferrer">
                            Open listing
                          </a>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
                <div className="fact-block">
                  <h3>Split</h3>
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
                </div>
              </section>

              {x.images.length ? (
                <section className="account-section">
                  <div className="account-section-head">
                    <h2>Photos</h2>
                  </div>
                  <DealPhotos id={x.id} images={x.images} />
                </section>
              ) : null}

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
              listingUrl={listingHref}
              listedAt={x.listedAt?.toISOString() || ""}
              createdAt={x.createdAt.toISOString()}
              completedAt={x.completedAt?.toISOString() || ""}
              platform={x.platform || ""}
              description={x.description || ""}
              notes={x.notes || ""}
            />
          ) : null}

          {tab === "payout" ? (
            <div className="account-stack">
              <PayConsignor
                id={x.id}
                amountCents={split.customer}
                method={x.method}
                paid={x.paid}
                payoutReference={x.payoutReference}
                consignor={x.customer}
                finalizedAt={x.acceptedAt}
                completedAt={x.completedAt}
              />
              <section className="account-section">
                <div className="account-section-head">
                  <h2>Split</h2>
                </div>
                <div className="summary pay-split">
                  {x.askingPriceCents && x.askingPriceCents !== x.salePriceCents ? (
                    <div className="row">
                      <span>Asking</span>
                      <b>{money(x.askingPriceCents)}</b>
                    </div>
                  ) : null}
                  <div className="row">
                    <span>Sale{x.platform ? ` · ${x.platform}` : ""}</span>
                    <b>{money(x.salePriceCents)}</b>
                  </div>
                  <div className="row consignor">
                    <span>Consignor ({x.customerPercentBps / 100}%)</span>
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
                  Consignor is paid from the sale. Auction fees come out of ITNX’s commission.{" "}
                  <a className="text-link" href="/consignment-agreement">
                    Agreement
                  </a>
                </p>
              </section>
              <DealPayoutCard
                id={x.id}
                status={x.status}
                platform={x.platform || ""}
                method={x.method}
                salePriceCents={x.salePriceCents}
                askingPriceCents={x.askingPriceCents}
                completedAt={x.completedAt}
              />
              <section className="account-section">
                <div className="account-section-head">
                  <div>
                    <h2>Customer</h2>
                    <p className="profile-meta">
                      <Link className="text-link" href={`/customers/${x.customer.id}`}>
                        {x.customer.name}
                      </Link>
                      {x.customer.reference ? ` · ${x.customer.reference}` : ""}
                    </p>
                    <p className="profile-meta">
                      {x.acceptedAt ? `Signed ${shortDate(x.acceptedAt)}` : "Needs signature"}
                      {" · "}
                      {x.customer.payoutReady ? "Mailing on file" : "Needs mailing"}
                    </p>
                  </div>
                  <Link className="edit-btn" href={`/customers/${x.customer.id}`}>
                    Profile
                  </Link>
                </div>
                <div className="customer-link-actions">
                  <ShareLink href={sign} title="Payout page" bare />
                  <SendDealLink
                    id={x.id}
                    hasEmail={Boolean(x.customer.email || x.customer.payoutEmail)}
                    hasPhone={Boolean(x.customer.phoneE164 || x.customer.phone || x.customer.payoutPhone)}
                    compact
                  />
                </div>
              </section>
            </div>
          ) : null}

          {tab === "customer" ? (
            <div className="account-stack">
              <section className="account-section profile-ident">
                <div className="avatar" aria-hidden>
                  {initials(x.customer.name) || "•"}
                </div>
                <div className="profile-ident-copy">
                  <h2>{x.customer.name}</h2>
                  <p className="profile-meta">
                    {[x.customer.company, x.customer.email, x.customer.phone].filter(Boolean).join(" · ") || "No email or phone"}
                  </p>
                  <div className="profile-pills">
                    <span className={x.customer.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
                      {x.customer.payoutReady ? "Payout on file" : "Needs payout info"}
                    </span>
                    <span className={x.acceptedAt ? "badge badge-ok" : "badge badge-warn"}>
                      {x.acceptedAt ? `Signed ${shortDate(x.acceptedAt)}` : "Needs signature"}
                    </span>
                    <span className={mapsVerified ? "badge badge-ok" : "badge"}>
                      {mapsVerified ? "Address verified" : "Address not verified"}
                    </span>
                  </div>
                </div>
                <div className="profile-ident-aside">
                  <DealId value={x.customer.reference} label="Customer ID" />
                  <Link className="edit-btn" href={`/customers/${x.customer.id}`}>
                    Profile
                  </Link>
                </div>
              </section>
              <section className="account-section">
                <div className="account-section-head">
                  <h2>Payout</h2>
                </div>
                <dl className="fact-grid">
                  <div>
                    <dt>Payout method</dt>
                    <dd>{methodLabel(x.method)}</dd>
                  </div>
                  <div>
                    <dt>{x.method === "CHECK" ? "Pay to the order of" : "Pay to"}</dt>
                    <dd>{payee}</dd>
                  </div>
                  {x.method === "CHECK" ? (
                    <div className="full">
                      <dt>Mail to</dt>
                      <dd>
                        {mail.length
                          ? mail.map((line) => (
                              <span key={line} className="addr-line">
                                {line}
                              </span>
                            ))
                          : "—"}
                      </dd>
                    </div>
                  ) : null}
                  {x.method === "ACH" ? (
                    <div className="full">
                      <dt>Bank</dt>
                      <dd>{bank || "—"}</dd>
                    </div>
                  ) : null}
                  {x.customer.address && x.method !== "CHECK" ? (
                    <div className="full">
                      <dt>Address</dt>
                      <dd>{x.customer.address}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>
            </div>
          ) : null}

          {tab === "acceptance" ? (
            <div className="account-stack">
              <section className="account-section">
                <div className="account-section-head">
                  <div>
                    <h2>Signature record</h2>
                    <p className="muted">Captured when they accept the payout on the private page.</p>
                  </div>
                  <span className={x.acceptedAt ? "badge badge-ok" : "badge badge-warn"}>
                    {x.acceptedAt ? "Signed" : "Waiting"}
                  </span>
                </div>
                {x.acceptedAt ? (
                  <dl className="fact-grid">
                    <div>
                      <dt>Signed name</dt>
                      <dd>{x.acceptedName || "—"}</dd>
                    </div>
                    <div>
                      <dt>Signed at</dt>
                      <dd>{shortDateTime(x.acceptedAt)}</dd>
                    </div>
                    <div>
                      <dt>IP address</dt>
                      <dd>{x.acceptedIp || "—"}</dd>
                    </div>
                    <div>
                      <dt>Country</dt>
                      <dd>{x.acceptedCountry || "—"}</dd>
                    </div>
                    <div className="full">
                      <dt>Device / browser</dt>
                      <dd className="pre">{x.acceptedUserAgent || "—"}</dd>
                    </div>
                    {x.acceptedForwarded && x.acceptedForwarded !== x.acceptedIp ? (
                      <div className="full">
                        <dt>Forwarded-for</dt>
                        <dd className="pre">{x.acceptedForwarded}</dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Payout</dt>
                      <dd>{money(split.customer)}</dd>
                    </div>
                    <div>
                      <dt>Deal ID</dt>
                      <dd>{x.reference}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="muted">No signature yet. Email or text the payout page, then this record fills in when they sign.</p>
                )}
              </section>
              <section className="account-section">
                <div className="account-section-head">
                  <h2>Log</h2>
                </div>
                {x.events.length === 0 ? (
                  <p className="muted">Sends and the signature will show here.</p>
                ) : (
                  <ol className="event-log">
                    {x.events.map((event) => (
                      <li key={event.id}>
                        <strong>
                          {event.kind === "signed" ? "Signed" : event.kind === "email" ? "Email" : event.kind === "sms" ? "Text" : event.kind}
                        </strong>
                        <span>{event.summary}</span>
                        <small>
                          {shortDateTime(event.createdAt)}
                          {event.ip ? ` · ${event.ip}` : ""}
                        </small>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
