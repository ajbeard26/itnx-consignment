"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/staff";
import { publicError } from "@/lib/safe";
import { clampInvoiceDays, readInvoiceLines } from "@/lib/invoice-shared";
import { allocateInvoiceId, deliverInvoice, discardStripeDraft, pullInvoice, voidRemoteInvoice } from "@/lib/invoice";
import { billingSettings } from "@/lib/stripe";

function invoicePath(id: string, extra: Record<string, string> = {}) {
  const q = new URLSearchParams(extra);
  const query = q.toString();
  return query ? `/invoices/${id}?${query}` : `/invoices/${id}`;
}

async function ownedDeal(customerId: string, consignmentId: string) {
  if (!consignmentId) return null;
  const deal = await db.consignment.findFirst({
    where: { id: consignmentId, customerId },
    select: { id: true },
  });
  if (!deal) throw new Error("That consignment does not belong to this customer.");
  return deal.id;
}

function draftInput(fd: FormData, fallbackDays: number) {
  const customerId = String(fd.get("customerId") || "").trim();
  if (!customerId) throw new Error("Choose a customer.");
  const lines = readInvoiceLines(fd);
  const totalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  const memo = String(fd.get("memo") || "").trim().slice(0, 500);
  const daysUntilDue = clampInvoiceDays(fd.get("daysUntilDue"), fallbackDays);
  return {
    customerId,
    consignmentId: String(fd.get("consignmentId") || "").trim(),
    lines,
    totalCents,
    memo: memo || null,
    daysUntilDue,
  };
}

export async function customerDeals(customerId: string) {
  await requireStaff();
  if (!customerId) return [];
  return db.consignment.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, reference: true, title: true },
  });
}

export async function createInvoice(fd: FormData) {
  await requireStaff();
  try {
    const settings = await billingSettings();
    const input = draftInput(fd, settings.daysUntilDue);
    const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
    if (!customer) throw new Error("Customer not found.");
    const consignmentId = await ownedDeal(input.customerId, input.consignmentId);
    const reference = await allocateInvoiceId();
    const invoice = await db.invoice.create({
      data: {
        reference,
        customerId: input.customerId,
        consignmentId,
        memo: input.memo,
        daysUntilDue: input.daysUntilDue,
        subtotalCents: input.totalCents,
        totalCents: input.totalCents,
        lines: { create: input.lines },
      },
    });
    revalidatePath("/invoices");
    revalidatePath(`/customers/${input.customerId}`);
    if (consignmentId) revalidatePath(`/consignments/${consignmentId}`);
    redirect(invoicePath(invoice.id));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const back = String(fd.get("customerId") || "");
    const deal = String(fd.get("consignmentId") || "");
    const q = new URLSearchParams({ error: publicError(error, "Could not save the invoice.") });
    if (back) q.set("customer", back);
    if (deal) q.set("deal", deal);
    redirect(`/invoices/new?${q.toString()}`);
  }
}

export async function updateInvoice(fd: FormData) {
  await requireStaff();
  const id = String(fd.get("id") || "").trim();
  try {
    const existing = await db.invoice.findUnique({ where: { id } });
    if (!existing) throw new Error("Invoice not found.");
    if (existing.status !== "DRAFT") throw new Error("Sent invoices cannot be edited. Void this one and create another.");
    const settings = await billingSettings();
    const input = draftInput(fd, settings.daysUntilDue);
    const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
    if (!customer) throw new Error("Customer not found.");
    const consignmentId = await ownedDeal(input.customerId, input.consignmentId);
    await db.$transaction(async (tx) => {
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.update({
        where: { id },
        data: {
          customerId: input.customerId,
          consignmentId,
          memo: input.memo,
          daysUntilDue: input.daysUntilDue,
          subtotalCents: input.totalCents,
          totalCents: input.totalCents,
          lastError: null,
          lines: { create: input.lines },
        },
      });
    });
    revalidatePath("/invoices");
    revalidatePath(invoicePath(id));
    revalidatePath(`/customers/${input.customerId}`);
    revalidatePath(`/customers/${existing.customerId}`);
    if (consignmentId) revalidatePath(`/consignments/${consignmentId}`);
    if (existing.consignmentId) revalidatePath(`/consignments/${existing.consignmentId}`);
    redirect(invoicePath(id, { saved: "1" }));
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(invoicePath(id, { error: publicError(error, "Could not save the invoice.") }));
  }
}

export async function sendInvoice(fd: FormData) {
  await requireStaff();
  const id = String(fd.get("id") || "").trim();
  try {
    await deliverInvoice(id);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    const message = publicError(error, "Could not send the invoice.");
    await db.invoice.update({ where: { id }, data: { lastError: message } }).catch(() => undefined);
    redirect(invoicePath(id, { error: message }));
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect(invoicePath(id, { sent: "1" }));
}

export async function refreshInvoice(fd: FormData) {
  await requireStaff();
  const id = String(fd.get("id") || "").trim();
  try {
    await pullInvoice(id);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(invoicePath(id, { error: publicError(error, "Could not refresh this invoice.") }));
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect(invoicePath(id, { refreshed: "1" }));
}

export async function voidInvoice(fd: FormData) {
  await requireStaff();
  const id = String(fd.get("id") || "").trim();
  try {
    await voidRemoteInvoice(id);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(invoicePath(id, { error: publicError(error, "Could not void this invoice.") }));
  }
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  redirect(invoicePath(id, { voided: "1" }));
}

export async function deleteDraft(fd: FormData) {
  await requireStaff();
  const id = String(fd.get("id") || "").trim();
  const invoice = await db.invoice.findUnique({ where: { id } });
  if (!invoice) redirect("/invoices");
  if (invoice.status !== "DRAFT") {
    redirect(invoicePath(id, { error: "Only a draft can be deleted." }));
  }
  try {
    if (invoice.stripeInvoiceId) await discardStripeDraft(invoice.stripeInvoiceId);
    await db.invoice.delete({ where: { id } });
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    redirect(invoicePath(id, { error: publicError(error, "Could not delete this draft.") }));
  }
  revalidatePath("/invoices");
  revalidatePath(`/customers/${invoice.customerId}`);
  if (invoice.consignmentId) revalidatePath(`/consignments/${invoice.consignmentId}`);
  redirect("/invoices");
}
