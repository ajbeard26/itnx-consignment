import Link from "next/link";
import Shell from "@/components/Shell";
import ConsignmentForm from "@/components/ConsignmentForm";
import DealId from "@/components/DealId";
import Pager from "@/components/Pager";
import EmptyState from "@/components/EmptyState";
import AddressFields from "@/components/AddressFields";
import { db } from "@/lib/db";
import { peekDealId, customerSearchNeedles, dealSearchNeedles } from "@/lib/reference";
import { backfillCustomerIds } from "@/lib/customer";
import { pageNumber, paginate } from "@/lib/paging";
import { initials } from "@/lib/initials";
import { createCustomerForDeal } from "./actions";
import type { Prisma } from "@prisma/client";

export const metadata = { title: "New consignment" };

const PICK_SIZE = 15;
const FILTERS = [
  { id: "all", label: "All" },
  { id: "ready", label: "Payout ready" },
  { id: "needs", label: "Needs payout" },
  { id: "deals", label: "Has deals" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

function dealFilter(value?: string | null): Filter {
  return FILTERS.some((item) => item.id === value) ? (value as Filter) : "all";
}

function hrefFor({
  q = "",
  filter = "all",
  page,
  add,
}: {
  q?: string;
  filter?: string;
  page?: number;
  add?: boolean;
}) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (filter && filter !== "all") params.set("filter", filter);
  if (page && page > 1) params.set("page", String(page));
  if (add) params.set("new", "1");
  const query = params.toString();
  return query ? `/consignments/new?${query}` : "/consignments/new";
}

function searchWhere(q: string): Prisma.CustomerWhereInput {
  const term = q.trim();
  if (!term) return {};
  const customerNeedles = customerSearchNeedles(term);
  const dealNeedles = dealSearchNeedles(term);
  return {
    OR: [
      { name: { contains: term, mode: "insensitive" } },
      { email: { contains: term, mode: "insensitive" } },
      { phone: { contains: term, mode: "insensitive" } },
      { company: { contains: term, mode: "insensitive" } },
      ...customerNeedles.map((n) => ({ reference: { contains: n, mode: "insensitive" as const } })),
      ...dealNeedles.map((n) => ({
        consignments: { some: { reference: { contains: n, mode: "insensitive" as const } } },
      })),
    ],
  };
}

function filterWhere(filter: Filter): Prisma.CustomerWhereInput {
  if (filter === "ready") return { payoutReady: true };
  if (filter === "needs") return { payoutReady: false };
  if (filter === "deals") return { consignments: { some: {} } };
  return {};
}

function andWhere(...parts: Prisma.CustomerWhereInput[]): Prisma.CustomerWhereInput | undefined {
  const xs = parts.filter((part) => Object.keys(part).length > 0);
  if (!xs.length) return undefined;
  if (xs.length === 1) return xs[0];
  return { AND: xs };
}

function Steps({ step }: { step: 1 | 2 }) {
  return (
    <ol className="deal-steps" aria-label="New consignment steps">
      <li className={step === 1 ? "on" : "done"}>
        <span>1</span>
        {step === 2 ? <Link href="/consignments/new">Customer</Link> : "Customer"}
      </li>
      <li className={step === 2 ? "on" : undefined} aria-current={step === 2 ? "step" : undefined}>
        <span>2</span>
        Listing
      </li>
    </ol>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; filter?: string; customer?: string; new?: string }>;
}) {
  const { q = "", page: rawPage, filter: rawFilter, customer: customerId, new: rawNew } = await searchParams;
  const adding = rawNew === "1" || rawNew === "true";
  await backfillCustomerIds();

  const selected = customerId
    ? await db.customer.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          reference: true,
          name: true,
          email: true,
          phone: true,
          company: true,
        },
      })
    : null;

  if (selected) {
    const [s, nextId] = await Promise.all([
      db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
      peekDealId(),
    ]);
    return (
      <Shell>
        <p className="crumb">
          <Link href="/consignments">Consignments</Link>
          <span> / New</span>
        </p>
        <div className="page-head">
          <div>
            <p className="kicker">New consignment</p>
            <h1>Auction listing</h1>
            <p className="muted">Pull a listing or enter the item, then save the deal.</p>
          </div>
          <DealId value={nextId} />
        </div>
        <Steps step={2} />
        <ConsignmentForm
          customer={selected}
          percent={s.defaultCustomerPercentBps / 100}
          method={s.defaultMethod}
          platform={s.defaultPlatform || ""}
        />
      </Shell>
    );
  }

  const filter = dealFilter(rawFilter);
  const query = searchWhere(q);
  const scoped = andWhere(query, filterWhere(filter));
  const [all, ready, needs, deals, total] = await Promise.all([
    db.customer.count({ where: andWhere(query) }),
    db.customer.count({ where: andWhere(query, { payoutReady: true }) }),
    db.customer.count({ where: andWhere(query, { payoutReady: false }) }),
    db.customer.count({ where: andWhere(query, { consignments: { some: {} } }) }),
    db.customer.count({ where: scoped }),
  ]);
  const counts = { all, ready, needs, deals };
  const pager = paginate(total, pageNumber(rawPage), PICK_SIZE);
  const customers = adding
    ? []
    : await db.customer.findMany({
        where: scoped,
        include: { _count: { select: { consignments: true } } },
        orderBy: { name: "asc" },
        skip: pager.skip,
        take: pager.take,
      });

  return (
    <Shell>
      <p className="crumb">
        <Link href="/consignments">Consignments</Link>
        <span> / New</span>
      </p>
      <div className="page-head">
        <div>
          <p className="kicker">New consignment</p>
          <h1>{adding ? "New customer" : "Choose a customer"}</h1>
          <p className="muted">
            {adding
              ? "Save the consignor, then add the auction listing."
              : "Pick who this deal belongs to. Auction details come next."}
          </p>
        </div>
        {adding ? (
          <Link className="button ghost" href={hrefFor({ q, filter })}>
            Back to list
          </Link>
        ) : (
          <Link className="button" href={hrefFor({ q, filter, add: true })}>
            + New customer
          </Link>
        )}
      </div>
      <Steps step={1} />

      {adding ? (
        <form action={createCustomerForDeal} className="compose">
          <section className="compose-section">
            <div className="compose-head">
              <div>
                <h2>Contact</h2>
                <p className="muted">Name is required. Address can wait for their payout page.</p>
              </div>
            </div>
            <div className="form">
              <div className="field">
                <label>Full name</label>
                <input name="name" required placeholder="Jane Smith" autoFocus />
              </div>
              <div className="field">
                <label>Company</label>
                <input name="company" placeholder="Optional" />
              </div>
              <div className="field">
                <label>Email</label>
                <input name="email" type="email" placeholder="name@email.com" />
              </div>
              <div className="field">
                <label>Phone</label>
                <input name="phone" placeholder="(555) 555-5555" />
              </div>
            </div>
            <div className="compose-block">
              <h3>Mailing address</h3>
              <AddressFields required={false} />
            </div>
          </section>
          <div className="compose-foot">
            <Link className="text-link" href={hrefFor({ q, filter })}>
              Cancel
            </Link>
            <button className="button" type="submit">
              Save and continue
            </button>
          </div>
        </form>
      ) : (
        <div className="compose">
          <section className="compose-section">
            <form method="get" className="deal-toolbar">
              <div className="deal-toolbar-top">
                <div className="deal-search">
                  {filter !== "all" ? <input type="hidden" name="filter" value={filter} /> : null}
                  <input
                    className="filter-search"
                    name="q"
                    defaultValue={q}
                    placeholder="Search name, phone, customer ID, or deal ID"
                    autoComplete="off"
                    autoFocus
                  />
                  <button className="button ghost" type="submit">
                    Search
                  </button>
                </div>
                <div className="filter-pills" aria-label="Customer filters">
                  {FILTERS.map((item) => (
                    <Link
                      key={item.id}
                      href={hrefFor({ q, filter: item.id, page: 1 })}
                      className={filter === item.id ? "on" : undefined}
                    >
                      {item.label}
                      <span>{counts[item.id]}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </form>

            {customers.length === 0 ? (
              <EmptyState
                title={q || filter !== "all" ? "No matching customers" : "No customers yet"}
                body={
                  q || filter !== "all"
                    ? "Try a different search, or add this person as a new customer."
                    : "Add a customer to start this consignment."
                }
                href={hrefFor({ q, filter, add: true })}
                action="+ New customer"
              />
            ) : (
              <>
                <div className="deal-list compact">
                  {customers.map((c) => (
                    <Link key={c.id} href={`/consignments/new?customer=${c.id}`} className="deal customer-deal pick-customer">
                      <div className="deal-thumb placeholder" aria-hidden>
                        {initials(c.name) || "•"}
                      </div>
                      <div>
                        {c.reference ? <div className="deal-id-line">{c.reference}</div> : null}
                        <div className="deal-title">{c.name}</div>
                        <div className="muted">
                          {[c.company, c.email, c.phone].filter(Boolean).join(" · ") || "No contact yet"}
                        </div>
                      </div>
                      <div className="deal-meta">
                        <b>
                          {c._count.consignments} deal{c._count.consignments === 1 ? "" : "s"}
                        </b>
                        <span className={c.payoutReady ? "badge badge-ok" : "badge badge-warn"}>
                          {c.payoutReady ? "Payout on file" : "Needs payout info"}
                        </span>
                        <span className="pick-go">Continue</span>
                      </div>
                    </Link>
                  ))}
                </div>
                <Pager
                  page={pager.current}
                  pages={pager.pages}
                  total={pager.total}
                  size={pager.take}
                  hrefFor={(p) => hrefFor({ q, filter, page: p })}
                />
              </>
            )}
          </section>
        </div>
      )}
    </Shell>
  );
}
