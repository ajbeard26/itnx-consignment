import Link from "next/link";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import SmsPanel from "@/components/SmsPanel";
import EmailPanel from "@/components/EmailPanel";
import CustomerProfile from "@/components/CustomerProfile";
import CopyField from "@/components/CopyField";
import DeleteCustomerButton from "@/components/DeleteCustomerButton";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { ensureInfoToken, infoUrl } from "@/lib/customer";
import { methodLabel } from "@/lib/labels";
import { telnyxConfigured } from "@/lib/telnyx";
import { emailConfigured } from "@/lib/email";
import { notFound } from "next/navigation";
import { googleVerified } from "@/lib/address";

const TABS = [
  { id: "profile", label: "Profile" },
  { id: "payout", label: "Payout" },
  { id: "email", label: "Email" },
  { id: "sms", label: "Text messages" },
  { id: "deals", label: "Consignments" },
] as const;

type Tab = (typeof TABS)[number]["id"];

function customerTab(value?: string | null): Tab {
  return TABS.some((tab) => tab.id === value) ? (value as Tab) : "profile";
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id }, select: { name: true } });
  return { title: c?.name || "Customer" };
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
  const tab = customerTab(rawTab);
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      consignments: {
        include: { images: { take: 1, orderBy: { createdAt: "asc" } } },
        orderBy: { createdAt: "desc" },
      },
      messages: { orderBy: { createdAt: "desc" }, take: 12 },
      emails: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!c) return notFound();
  const mapsVerified =
    googleVerified(c.addressVerified, c.addressVerifiedSource) ||
    googleVerified(c.payoutAddressVerified, c.payoutAddressVerifiedSource);
  const token = await ensureInfoToken(c.id);
  const payoutLink = infoUrl(token);
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const mailing = [c.payoutAddress, c.payoutCity, c.payoutState, c.payoutZip].filter(Boolean).join(", ");

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Customer</p>
          <h1>{c.name}</h1>
          <p className="muted">{c.company || "Individual"}</p>
        </div>
      </div>

      <div className="account-shell">
        <nav className="account-nav" aria-label="Customer sections">
          {TABS.map((item) => (
            <Link key={item.id} href={`/customers/${c.id}?tab=${item.id}`} className={tab === item.id ? "on" : undefined}>
              {item.label}
              {item.id === "deals" && c.consignments.length ? <span className="nav-count">{c.consignments.length}</span> : null}
              {item.id === "payout" && !c.payoutReady ? <span className="nav-dot" /> : null}
            </Link>
          ))}
          <DeleteCustomerButton variant="nav" id={c.id} name={c.name} deals={c.consignments.length} />
        </nav>

        <div className="account-main">
          {tab === "profile" ? (
            <CustomerProfile
              id={c.id}
              name={c.name}
              company={c.company || ""}
              email={c.email || ""}
              phone={c.phone || ""}
              street={c.street || ""}
              city={c.city || ""}
              state={c.state || ""}
              zip={c.zip || ""}
              alreadyVerified={googleVerified(c.addressVerified, c.addressVerifiedSource)}
              payoutReady={c.payoutReady}
              mapsVerified={mapsVerified}
            />
          ) : null}

          {tab === "payout" ? (
            <div className="account-stack">
              <section className="account-section">
                <div className="account-section-head">
                  <div>
                    <h2>Payout details</h2>
                    <p className="muted">Send this private link so they can enter mailing and payout information.</p>
                  </div>
                  <span className={c.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
                    {c.payoutReady ? "Received" : "Waiting"}
                  </span>
                </div>
                <CopyField value={payoutLink} />
              </section>
              <section className="account-section">
                <div className="account-section-head">
                  <h2>On file</h2>
                </div>
                {c.payoutReady ? (
                  <dl className="fact-grid">
                    <div>
                      <dt>How we pay</dt>
                      <dd>{methodLabel(c.consignments[0]?.method)}</dd>
                    </div>
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
                    <div className="full">
                      <dt>Mailing</dt>
                      <dd>{mailing || "—"}</dd>
                    </div>
                    {c.bankName || c.accountLast4 ? (
                      <div className="full">
                        <dt>Bank</dt>
                        <dd>
                          {c.bankName ? `${c.bankName}${c.accountLast4 ? ` · ••••${c.accountLast4}` : ""}` : `••••${c.accountLast4}`}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                ) : (
                  <p className="muted">They have not submitted payout info yet.</p>
                )}
              </section>
            </div>
          ) : null}

          {tab === "email" ? (
            <section className="account-section">
              <div className="account-section-head">
                <div>
                  <h2>Email</h2>
                  <p className="muted">Mailing-info and sign emails are different pages. Custom notes need a written message.</p>
                </div>
              </div>
              <EmailPanel
                customerId={c.id}
                email={c.email || c.payoutEmail || ""}
                configured={Boolean(settings && emailConfigured(settings))}
                canSign={c.consignments.some((x) => Boolean(x.acceptanceToken))}
                messages={c.emails.map((m) => ({
                  id: m.id,
                  to: m.to,
                  subject: m.subject,
                  status: m.status,
                  error: m.error,
                  kind: m.kind,
                  createdAt: m.createdAt.toISOString(),
                }))}
              />
            </section>
          ) : null}

          {tab === "sms" ? (
            <section className="account-section">
              <div className="account-section-head">
                <div>
                  <h2>Text messages</h2>
                  <p className="muted">Send a payout info link anytime. Signature links still need SMS consent.</p>
                </div>
              </div>
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
            </section>
          ) : null}

          {tab === "deals" ? (
            <section className="account-section">
              <div className="account-section-head">
                <h2>Consignments</h2>
                <Link className="edit-btn" href="/consignments/new">
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
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
