import Link from "next/link";
import Shell from "@/components/Shell";
import EmptyState from "@/components/EmptyState";
import Pager from "@/components/Pager";
import InvoiceTable from "@/components/InvoiceTable";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { pageNumber, paginate } from "@/lib/paging";
import { INVOICE_STATUS_LABEL } from "@/lib/invoice-shared";
import type { InvoiceStatus } from "@prisma/client";

export const metadata = { title: "Invoices" };

const STATUSES: InvoiceStatus[] = ["DRAFT", "OPEN", "PAID", "VOID", "UNCOLLECTIBLE"];

function statusFilter(value?: string | null): InvoiceStatus | undefined {
  return STATUSES.includes(value as InvoiceStatus) ? (value as InvoiceStatus) : undefined;
}

function hrefFor(q: string, status: string, page?: number) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (status) params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/invoices?${query}` : "/invoices";
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q = "", status: rawStatus, page: rawPage } = await searchParams;
  const status = statusFilter(rawStatus);
  const where = {
    ...(status ? { status } : {}),
    ...(q.trim()
      ? {
          OR: [
            { reference: { contains: q.trim(), mode: "insensitive" as const } },
            { stripeNumber: { contains: q.trim(), mode: "insensitive" as const } },
            { customer: { name: { contains: q.trim(), mode: "insensitive" as const } } },
            { consignment: { reference: { contains: q.trim(), mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };
  const [total, open] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.aggregate({ where: { status: "OPEN" }, _count: true, _sum: { totalCents: true } }),
  ]);
  const pager = paginate(total, pageNumber(rawPage));
  const invoices = await db.invoice.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true } },
      consignment: { select: { id: true, reference: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    skip: pager.skip,
    take: pager.take,
  });

  return (
    <Shell>
      <div className="page-head">
        <div>
          <p className="kicker">Billing</p>
          <h1>Invoices</h1>
          <p className="muted">
            {open._count
              ? `${open._count} awaiting payment · ${money(open._sum.totalCents || 0)}`
              : "Charge customers for shipping, handling, and other services."}
          </p>
        </div>
        <Link className="button" href="/invoices/new">
          + New invoice
        </Link>
      </div>
      <form className="filters" method="get">
        <input name="q" defaultValue={q} placeholder="Search invoice, customer, or consignment" />
        <select name="status" defaultValue={status || ""}>
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>
              {INVOICE_STATUS_LABEL[item]}
            </option>
          ))}
        </select>
        <button className="button ghost" type="submit">
          Search
        </button>
      </form>
      {invoices.length === 0 ? (
        <div className="card">
          <EmptyState
            title={q || status ? "No matching invoices" : "No invoices yet"}
            body={q || status ? "Try a different search." : "Create an invoice when a customer owes shipping, handling, or another service charge."}
            href="/invoices/new"
            action="+ New invoice"
          />
        </div>
      ) : (
        <div className="card">
          <InvoiceTable rows={invoices} />
          <Pager page={pager.current} pages={pager.pages} total={pager.total} size={pager.take} hrefFor={(p) => hrefFor(q, status || "", p)} />
        </div>
      )}
    </Shell>
  );
}
