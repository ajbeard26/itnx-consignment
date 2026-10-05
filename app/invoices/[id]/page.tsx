import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/Shell";
import InvoiceForm from "@/components/InvoiceForm";
import ShareLink from "@/components/ShareLink";
import DealId from "@/components/DealId";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { shortDate, shortDateTime } from "@/lib/dates";
import { safeHttpUrl } from "@/lib/safe";
import { INVOICE_KIND_LABEL, INVOICE_STATUS_LABEL, invoiceStatusClass } from "@/lib/invoice-shared";
import { billingSettings } from "@/lib/stripe";
import { deleteDraft, refreshInvoice, sendInvoice, updateInvoice, voidInvoice } from "../actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await db.invoice.findUnique({ where: { id }, select: { reference: true } });
  return { title: invoice?.reference || "Invoice" };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; sent?: string; saved?: string; refreshed?: string; voided?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sort: "asc" } },
      customer: true,
      consignment: { select: { id: true, reference: true, title: true } },
    },
  });
  if (!invoice) return notFound();
  const settings = await billingSettings();
  const payLink = safeHttpUrl(invoice.hostedInvoiceUrl || "");
  const pdf = safeHttpUrl(invoice.invoicePdf || "");
  const email = invoice.customer.email || invoice.customer.payoutEmail || "";
  const deals =
    invoice.status === "DRAFT"
      ? await db.consignment.findMany({
          where: { customerId: invoice.customerId },
          orderBy: { createdAt: "desc" },
          take: 40,
          select: { id: true, reference: true, title: true },
        })
      : [];

  return (
    <Shell>
      <p className="crumb">
        <Link href="/invoices">Invoices</Link>
        <span> / {invoice.reference}</span>
      </p>
      <div className="page-head">
        <div>
          <p className="kicker">Billing</p>
          <h1>{invoice.reference}</h1>
          <p className="muted">
            <Link className="text-link" href={`/customers/${invoice.customer.id}?tab=invoices`}>
              {invoice.customer.name}
            </Link>
            {invoice.consignment ? (
              <>
                {" · "}
                <Link className="text-link" href={`/consignments/${invoice.consignment.id}?tab=charges`}>
                  {invoice.consignment.reference}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <span className={invoiceStatusClass(invoice.status)}>{INVOICE_STATUS_LABEL[invoice.status]}</span>
      </div>

      {query.error ? <p className="form-error">{query.error}</p> : null}
      {query.saved ? <p className="form-ok">Draft saved.</p> : null}
      {query.sent ? (
        <p className="form-ok">
          {settings.mode === "test"
            ? "Invoice finalized in Stripe test mode. Stripe does not email test invoices — send the customer the payment link."
            : `Stripe emailed ${email || "the customer"} a link to pay ${money(invoice.totalCents)}.`}
        </p>
      ) : null}
      {query.refreshed ? <p className="form-ok">Status refreshed from Stripe.</p> : null}
      {query.voided ? <p className="form-ok">Invoice voided. The customer can no longer pay it.</p> : null}
      {invoice.lastError && !query.error ? <p className="form-error">{invoice.lastError}</p> : null}

      {invoice.status === "DRAFT" ? (
        <div className="stack">
          <InvoiceForm
            action={updateInvoice}
            invoiceId={invoice.id}
            customer={{
              id: invoice.customer.id,
              reference: invoice.customer.reference,
              name: invoice.customer.name,
              email: invoice.customer.email || invoice.customer.payoutEmail,
              phone: invoice.customer.phone,
              company: invoice.customer.company,
            }}
            deals={deals}
            consignmentId={invoice.consignmentId || ""}
            memo={invoice.memo || ""}
            daysUntilDue={invoice.daysUntilDue}
            lines={invoice.lines}
            submitLabel="Save draft"
            cancelHref="/invoices"
          />
          <section className="card panel">
            <h2>Send</h2>
            <p className="muted">
              {settings.configured
                ? settings.mode === "test"
                  ? "Test mode creates a real Stripe invoice and a payment link. Stripe will not email it."
                  : "Stripe emails the customer a hosted invoice they can pay by card."
                : "Add a Stripe secret key in Settings → Payments before sending."}
            </p>
            {!email ? <p className="form-error">This customer needs an email address before the invoice can be sent.</p> : null}
            <div className="form-actions">
              <form action={sendInvoice}>
                <input type="hidden" name="id" value={invoice.id} />
                <button className="button" type="submit" disabled={!settings.configured || !email}>
                  Send invoice
                </button>
              </form>
              <form action={deleteDraft}>
                <input type="hidden" name="id" value={invoice.id} />
                <button className="button danger" type="submit">
                  Delete draft
                </button>
              </form>
            </div>
          </section>
        </div>
      ) : (
        <div className="stack">
          <section className="card panel">
            <div className="account-section-head">
              <div>
                <h2>{money(invoice.totalCents)}</h2>
                <p className="muted">
                  {invoice.stripeNumber ? `Stripe ${invoice.stripeNumber}` : "Stripe invoice"}
                  {invoice.sentAt ? ` · sent ${shortDateTime(invoice.sentAt)}` : ""}
                  {invoice.paidAt ? ` · paid ${shortDateTime(invoice.paidAt)}` : ""}
                  {invoice.dueAt && invoice.status === "OPEN" ? ` · due ${shortDate(invoice.dueAt)}` : ""}
                </p>
              </div>
              <DealId value={invoice.reference} label="Invoice" />
            </div>
            {invoice.memo ? <p>{invoice.memo}</p> : null}
            <div className="deal-table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Each</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td>{INVOICE_KIND_LABEL[line.kind]}</td>
                      <td>{line.description}</td>
                      <td>{line.quantity}</td>
                      <td>{money(line.unitAmountCents)}</td>
                      <td>{money(line.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {invoice.amountPaidCents > 0 && invoice.status !== "PAID" ? (
              <p className="muted">Paid so far {money(invoice.amountPaidCents)}.</p>
            ) : null}
          </section>

          {payLink ? (
            <section className="card panel">
              <h2>Payment link</h2>
              <ShareLink href={payLink} title="Customer pay page" hint="This opens Stripe’s hosted invoice." />
              {pdf ? (
                <p>
                  <a className="text-link" href={pdf} target="_blank" rel="noopener noreferrer">
                    Download PDF
                  </a>
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="card panel">
            <h2>Stripe</h2>
            <div className="form-actions">
              {invoice.stripeInvoiceId ? (
                <form action={refreshInvoice}>
                  <input type="hidden" name="id" value={invoice.id} />
                  <button className="button ghost" type="submit">
                    Refresh status
                  </button>
                </form>
              ) : null}
              {invoice.status === "OPEN" ? (
                <form action={voidInvoice}>
                  <input type="hidden" name="id" value={invoice.id} />
                  <button className="button danger" type="submit">
                    Void invoice
                  </button>
                </form>
              ) : null}
            </div>
            {invoice.status === "OPEN" ? (
              <p className="muted">Voiding cancels the Stripe invoice. The customer will not be able to pay it.</p>
            ) : null}
          </section>
        </div>
      )}
    </Shell>
  );
}
