import Link from "next/link";
import Shell from "@/components/Shell";
import InvoiceForm from "@/components/InvoiceForm";
import { db } from "@/lib/db";
import { billingSettings } from "@/lib/stripe";
import { createInvoice } from "../actions";

export const metadata = { title: "New invoice" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string; deal?: string; error?: string }>;
}) {
  const { customer: customerId, deal, error } = await searchParams;
  const settings = await billingSettings();
  let customer: {
    id: string;
    reference: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
  } | null = null;
  let consignmentId = "";

  if (deal) {
    const row = await db.consignment.findUnique({
      where: { id: deal },
      select: {
        id: true,
        customer: {
          select: { id: true, reference: true, name: true, email: true, payoutEmail: true, phone: true, company: true },
        },
      },
    });
    if (row) {
      customer = {
        id: row.customer.id,
        reference: row.customer.reference,
        name: row.customer.name,
        email: row.customer.email || row.customer.payoutEmail,
        phone: row.customer.phone,
        company: row.customer.company,
      };
      consignmentId = row.id;
    }
  } else if (customerId) {
    const found = await db.customer.findUnique({
      where: { id: customerId },
      select: { id: true, reference: true, name: true, email: true, payoutEmail: true, phone: true, company: true },
    });
    if (found) {
      customer = {
        id: found.id,
        reference: found.reference,
        name: found.name,
        email: found.email || found.payoutEmail,
        phone: found.phone,
        company: found.company,
      };
    }
  }

  const deals = customer
    ? await db.consignment.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: { id: true, reference: true, title: true },
      })
    : [];

  return (
    <Shell>
      <p className="crumb">
        <Link href="/invoices">Invoices</Link>
        <span> / New</span>
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      <InvoiceForm
        action={createInvoice}
        customer={customer}
        lockCustomer={Boolean(deal && customer)}
        deals={deals}
        consignmentId={consignmentId}
        daysUntilDue={settings.daysUntilDue}
        submitLabel="Save draft"
        cancelHref={consignmentId ? `/consignments/${consignmentId}?tab=charges` : customer ? `/customers/${customer.id}?tab=invoices` : "/invoices"}
      />
    </Shell>
  );
}
