import type { InvoiceKind } from "@prisma/client";
import type Stripe from "stripe";
import { db } from "@/lib/db";
import { money } from "@/lib/money";
import { logDealEvent } from "@/lib/events";
import { validEmailAddress } from "@/lib/safe";
import { INVOICE_KIND_LABEL } from "@/lib/invoice-shared";
import { stripeClient } from "@/lib/stripe";

const INVOICE_ID_PREFIX = "IN-ITNX";

export function formatInvoiceId(year: number, seq: number) {
  return `${INVOICE_ID_PREFIX}:${String(year).slice(-2)}-${String(seq).padStart(4, "0")}`;
}

async function sequenceForYear(year: number) {
  const prefix = `${INVOICE_ID_PREFIX}:${String(year).slice(-2)}-`;
  const latest = await db.invoice.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const fromLatest = latest?.reference ? Number(latest.reference.slice(prefix.length)) + 1 : 1;
  return Number.isFinite(fromLatest) && fromLatest > 0 ? fromLatest : 1;
}

export async function allocateInvoiceId(year = new Date().getFullYear()) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const reference = formatInvoiceId(year, (await sequenceForYear(year)) + attempt);
    const exists = await db.invoice.findUnique({ where: { reference }, select: { id: true } });
    if (!exists) return reference;
  }
  throw new Error("Could not assign an invoice number. Try again.");
}

function lineDescription(kind: InvoiceKind, description: string) {
  const label = INVOICE_KIND_LABEL[kind];
  if (!description || description.toLowerCase() === label.toLowerCase()) return label;
  if (description.toLowerCase().startsWith(label.toLowerCase())) return description;
  return `${label} — ${description}`;
}

function isMissing(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "resource_missing";
}

function mapStatus(status: string | null | undefined) {
  if (status === "paid") return "PAID" as const;
  if (status === "void") return "VOID" as const;
  if (status === "uncollectible") return "UNCOLLECTIBLE" as const;
  if (status === "open") return "OPEN" as const;
  return "DRAFT" as const;
}

function unixDate(seconds: number | null | undefined) {
  if (!seconds) return null;
  return new Date(seconds * 1000);
}

type BillTo = {
  id: string;
  name: string;
  reference: string | null;
  phoneE164: string | null;
  stripeCustomerId: string | null;
  street: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  payoutAddress: string | null;
  payoutCity: string | null;
  payoutState: string | null;
  payoutZip: string | null;
};

function stripeAddress(customer: BillTo): Stripe.AddressParam | undefined {
  const line1 = customer.street || customer.payoutAddress;
  if (!line1) return undefined;
  return {
    line1,
    city: customer.city || customer.payoutCity || undefined,
    state: customer.state || customer.payoutState || undefined,
    postal_code: customer.zip || customer.payoutZip || undefined,
    country: "US",
  };
}

async function ensureStripeCustomer(stripe: Stripe, customer: BillTo, email: string) {
  const payload: Stripe.CustomerCreateParams = {
    name: customer.name,
    email,
    phone: customer.phoneE164 || undefined,
    metadata: { customerId: customer.id, reference: customer.reference || "" },
    address: stripeAddress(customer),
  };
  if (customer.stripeCustomerId) {
    try {
      await stripe.customers.update(customer.stripeCustomerId, payload);
      return customer.stripeCustomerId;
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }
  const created = await stripe.customers.create(payload);
  await db.customer.update({ where: { id: customer.id }, data: { stripeCustomerId: created.id } });
  return created.id;
}

export async function applyRemoteInvoice(remote: Stripe.Invoice, failure?: string | null) {
  const localId = remote.metadata?.invoiceId || "";
  const invoice = await db.invoice.findFirst({
    where: {
      OR: [{ stripeInvoiceId: remote.id }, ...(localId ? [{ id: localId }] : [])],
    },
  });
  if (!invoice) return null;
  const status = mapStatus(remote.status);
  const updated = await db.invoice.update({
    where: { id: invoice.id },
    data: {
      status,
      stripeInvoiceId: remote.id,
      stripeNumber: remote.number,
      hostedInvoiceUrl: remote.hosted_invoice_url,
      invoicePdf: remote.invoice_pdf,
      amountPaidCents: remote.amount_paid || 0,
      totalCents: typeof remote.total === "number" ? remote.total : invoice.totalCents,
      paidAt: unixDate(remote.status_transitions?.paid_at) || (status === "PAID" ? invoice.paidAt || new Date() : null),
      voidedAt: unixDate(remote.status_transitions?.voided_at),
      dueAt: unixDate(remote.due_date) || invoice.dueAt,
      lastError: failure === undefined ? (status === "PAID" ? null : invoice.lastError) : failure,
    },
  });
  if (invoice.consignmentId && invoice.status !== "PAID" && status === "PAID") {
    await logDealEvent({
      consignmentId: invoice.consignmentId,
      kind: "invoice",
      summary: `${invoice.reference} paid ${money(remote.amount_paid || invoice.totalCents)}.`,
    });
  }
  return updated;
}

export async function deliverInvoice(id: string) {
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: {
      lines: { orderBy: { sort: "asc" } },
      customer: true,
      consignment: { select: { id: true, reference: true, title: true } },
    },
  });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status === "PAID") throw new Error("This invoice is already paid.");
  if (invoice.status === "VOID") throw new Error("This invoice was voided.");
  if (invoice.status !== "DRAFT") throw new Error("Only a draft can be sent.");
  if (!invoice.lines.length) throw new Error("Add at least one charge.");

  const email = validEmailAddress(invoice.customer.email || invoice.customer.payoutEmail || "");
  if (!email) throw new Error("Add an email address on the customer before sending.");

  const stripe = await stripeClient();
  const settings = await db.settings.findUnique({ where: { id: 1 } });

  if (invoice.stripeInvoiceId) {
    let existing: Stripe.Invoice | null = null;
    try {
      existing = await stripe.invoices.retrieve(invoice.stripeInvoiceId);
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
    if (existing?.status === "draft") {
      await stripe.invoices.del(invoice.stripeInvoiceId);
      await db.invoice.update({ where: { id }, data: { stripeInvoiceId: null } });
    } else if (existing?.status === "open") {
      const sent = await stripe.invoices.sendInvoice(existing.id);
      await applyRemoteInvoice(sent);
      await db.invoice.update({
        where: { id },
        data: { status: "OPEN", sentAt: invoice.sentAt || new Date(), lastError: null },
      });
      if (invoice.consignmentId && !invoice.sentAt) {
        await logDealEvent({
          consignmentId: invoice.consignmentId,
          kind: "invoice",
          summary: `${invoice.reference} sent for ${money(invoice.totalCents)}.`,
        });
      }
      return;
    } else if (existing) {
      await applyRemoteInvoice(existing);
      if (existing.status === "paid") throw new Error("This invoice is already paid.");
      if (existing.status === "void") throw new Error("This invoice was voided in Stripe.");
      if (existing.status === "uncollectible") throw new Error("This invoice is uncollectible in Stripe.");
      throw new Error("This invoice already exists in Stripe. Refresh it and try again.");
    } else {
      await db.invoice.update({ where: { id }, data: { stripeInvoiceId: null } });
    }
  }

  const stripeCustomerId = await ensureStripeCustomer(stripe, invoice.customer, email);
  const memo = [invoice.memo?.trim(), invoice.consignment ? `Consignment ${invoice.consignment.reference}` : ""]
    .filter(Boolean)
    .join("\n")
    .slice(0, 500);

  const created = await stripe.invoices.create({
    customer: stripeCustomerId,
    collection_method: "send_invoice",
    days_until_due: invoice.daysUntilDue,
    auto_advance: false,
    currency: "usd",
    description: memo || undefined,
    footer: settings?.invoiceFooter?.trim().slice(0, 500) || undefined,
    pending_invoice_items_behavior: "exclude",
    metadata: {
      invoiceId: invoice.id,
      reference: invoice.reference,
      ...(invoice.consignmentId ? { consignmentId: invoice.consignmentId } : {}),
    },
    ...(invoice.consignment
      ? { custom_fields: [{ name: "Consignment", value: invoice.consignment.reference.slice(0, 140) }] }
      : {}),
  });

  await db.invoice.update({
    where: { id },
    data: { stripeInvoiceId: created.id, stripeCustomerId },
  });

  for (const line of invoice.lines) {
    const label = lineDescription(line.kind, line.description);
    const description =
      line.quantity > 1 ? `${label} (${line.quantity} × ${money(line.unitAmountCents)})` : label;
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      invoice: created.id,
      currency: "usd",
      description: description.slice(0, 500),
      amount: line.amountCents,
    });
  }

  await stripe.invoices.finalizeInvoice(created.id);
  const sent = await stripe.invoices.sendInvoice(created.id);
  await applyRemoteInvoice(sent);
  await db.invoice.update({
    where: { id },
    data: { status: "OPEN", sentAt: new Date(), lastError: null },
  });

  if (invoice.consignmentId) {
    await logDealEvent({
      consignmentId: invoice.consignmentId,
      kind: "invoice",
      summary: `${invoice.reference} sent for ${money(invoice.totalCents)}.`,
    });
  }
}

export async function pullInvoice(id: string) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice?.stripeInvoiceId) throw new Error("This invoice has not been sent to Stripe yet.");
  const stripe = await stripeClient();
  const remote = await stripe.invoices.retrieve(invoice.stripeInvoiceId);
  await applyRemoteInvoice(remote);
}

export async function voidRemoteInvoice(id: string) {
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) throw new Error("Invoice not found.");
  if (invoice.status !== "OPEN" || !invoice.stripeInvoiceId) {
    throw new Error("Only an open Stripe invoice can be voided.");
  }
  const stripe = await stripeClient();
  const remote = await stripe.invoices.voidInvoice(invoice.stripeInvoiceId);
  await applyRemoteInvoice(remote);
  if (invoice.consignmentId) {
    await logDealEvent({
      consignmentId: invoice.consignmentId,
      kind: "invoice",
      summary: `${invoice.reference} voided.`,
    });
  }
}

export async function discardStripeDraft(stripeInvoiceId: string) {
  const stripe = await stripeClient();
  try {
    const remote = await stripe.invoices.retrieve(stripeInvoiceId);
    if (remote.status === "draft") await stripe.invoices.del(stripeInvoiceId);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
}
