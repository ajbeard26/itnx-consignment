import Link from "next/link";
import Shell from "@/components/Shell";
import StatusBadge from "@/components/StatusBadge";
import SmsPanel from "@/components/SmsPanel";
import EmailPanel from "@/components/EmailPanel";
import CustomerProfile from "@/components/CustomerProfile";
import ShareLink from "@/components/ShareLink";
import DeleteCustomerButton from "@/components/DeleteCustomerButton";
import Pager from "@/components/Pager";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { ensureInfoToken, infoUrl } from "@/lib/customer";
import { methodLabel } from "@/lib/labels";
import { telnyxConfigured } from "@/lib/telnyx";
import { emailConfigured } from "@/lib/email";
import { notFound } from "next/navigation";
import { googleVerified } from "@/lib/address";
import { isArchivedStatus } from "@/lib/deals";
import { pageNumber, paginate } from "@/lib/paging";

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
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab, page: rawPage } = await searchParams;
  const tab = customerTab(rawTab);
  const c = await db.customer.findUnique({
    where: { id },
    include: {
      _count: { select: { consignments: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 12 },
      emails: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!c) return notFound();
  const [latestDeal, unsignedDeal] = await Promise.all([
    db.consignment.findFirst({
      where: { customerId: c.id },
      orderBy: { createdAt: "desc" },
      select: { method: true },
    }),
    db.consignment.findFirst({
      where: { customerId: c.id, acceptedAt: null },
      select: { id: true },
    }),
  ]);
  const dealPager = paginate(c._count.consignments, pageNumber(rawPage));
  const consignments =
    tab === "deals"
      ? await db.consignment.findMany({
          where: { customerId: c.id },
          include: { images: { take: 1, orderBy: { createdAt: "asc" } } },
          orderBy: { createdAt: "desc" },
          skip: dealPager.skip,
          take: dealPager.take,
        })
      : [];
  const mapsVerified =
    googleVerified(c.addressVerified, c.addressVerifiedSource) ||
    googleVerified(c.payoutAddressVerified, c.payoutAddressVerifiedSource);
  const token = await ensureInfoToken(c.id);
  const payoutLink = infoUrl(token);
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const mailing = [c.payoutAddress, c.payoutCity, c.payoutState, c.payoutZip].filter(Boolean).join(", ");

  return (
    <Shell>
      <p className="crumb">
        <Link href="/customers">Customers</Link>
      </p>
      <div className="account-shell">
        <nav className="account-nav" aria-label="Customer sections">
          {TABS.map((item) => (
            <Link key={item.id} href={`/customers/${c.id}?tab=${item.id}`} className={tab === item.id ? "on" : undefined}>
              {item.label}
              {item.id === "deals" && c._count.consignments ? <span className="nav-count">{c._count.consignments}</span> : null}
              {item.id === "payout" && !c.payoutReady ? <span className="nav-dot" /> : null}
            </Link>
          ))}
          <DeleteCustomerButton variant="nav" id={c.id} name={c.name} deals={c._count.consignments} />
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
                    <p className="muted">Send this private page so they can add mailing and payout details.</p>
                  </div>
                  <span className={c.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
                    {c.payoutReady ? "Received" : "Waiting"}
                  </span>
                </div>
                <ShareLink href={payoutLink} title="Mailing page" />
              </section>
              <section className="account-section">
                <div className="account-section-head">
                  <h2>On file</h2>
                </div>
                {c.payoutReady ? (
                  <dl className="fact-grid">
                    <div>
                      <dt>How we pay</dt>
                      <dd>{methodLabel(latestDeal?.method)}</dd>
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
                canSign={Boolean(unsignedDeal)}
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
              {consignments.length === 0 ? (
                <p className="muted">No consignments for this customer yet.</p>
              ) : (
                <>
                <div className="deal-list compact">
                  {consignments.map((x) => (
                    <Link key={x.id} href={`/consignments/${x.id}`} className="deal">
                      {x.images[0] ? (
                        <img src={x.images[0].path} alt="" className="deal-thumb" />
                      ) : (
                        <div className="deal-thumb placeholder">No photo</div>
                      )}
                      <div>
                        <div className="deal-id-line">{x.reference}</div>
                        <div className="deal-title">{x.title}</div>
                      </div>
                      <div className="deal-meta">
                        <b>{money(x.salePriceCents || x.askingPriceCents)}</b>
                        {isArchivedStatus(x.status) ? (
                          <span className="badge">Archived</span>
                        ) : (
                          <StatusBadge status={x.status} />
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
                <Pager
                  page={dealPager.current}
                  pages={dealPager.pages}
                  total={dealPager.total}
                  hrefFor={(p) => `/customers/${c.id}?tab=deals${p > 1 ? `&page=${p}` : ""}`}
                />
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}
