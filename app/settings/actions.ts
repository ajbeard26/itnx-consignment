"use server";

import { Method } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { text } from "@/lib/uploads";
import { sendSms, syncMessagingWebhook } from "@/lib/telnyx";

function method(value: FormDataEntryValue | null): Method {
  const v = String(value || "CHECK");
  if (v === Method.CASH || v === Method.ACH || v === Method.CHECK) return v;
  return Method.CHECK;
}

async function row() {
  return db.settings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
}

function keepSecret(incoming: FormDataEntryValue | null, existing: string | null) {
  const v = String(incoming || "").trim();
  if (!v || v === "••••••••") return existing;
  return v;
}

export async function saveCompany(fd: FormData) {
  await row();
  await db.settings.update({
    where: { id: 1 },
    data: {
      brandName: String(fd.get("brandName") || "ITNX Consignment").trim() || "ITNX Consignment",
      legalName: String(fd.get("legalName") || "NXRENT LLC").trim() || "NXRENT LLC",
      contactEmail: text(fd.get("contactEmail")),
      contactPhone: text(fd.get("contactPhone")),
      website: text(fd.get("website")),
      address: text(fd.get("address")),
    },
  });
  revalidatePath("/settings");
}

export async function saveDeals(fd: FormData) {
  const p = Number(fd.get("percent") || 50);
  await row();
  await db.settings.update({
    where: { id: 1 },
    data: {
      defaultCustomerPercentBps: Math.round(p * 100),
      defaultPlatform: text(fd.get("defaultPlatform")),
      defaultMethod: method(fd.get("defaultMethod")),
      payoutNotes: text(fd.get("payoutNotes")),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/consignments/new");
}

export async function saveAddress(fd: FormData) {
  const current = await row();
  await db.settings.update({
    where: { id: 1 },
    data: {
      googleMapsKey: keepSecret(fd.get("googleMapsKey"), current.googleMapsKey),
    },
  });
  revalidatePath("/settings");
}

export async function saveMessaging(fd: FormData) {
  const current = await row();
  await db.settings.update({
    where: { id: 1 },
    data: {
      telnyxApiKey: keepSecret(fd.get("telnyxApiKey"), current.telnyxApiKey),
      telnyxFromNumber: text(fd.get("telnyxFromNumber")),
      telnyxMessagingProfileId: text(fd.get("telnyxMessagingProfileId")),
      telnyxPublicKey: keepSecret(fd.get("telnyxPublicKey"), current.telnyxPublicKey),
      smsConsentTemplate: text(fd.get("smsConsentTemplate")),
      smsPayoutTemplate: text(fd.get("smsPayoutTemplate")),
      smsAcceptTemplate: text(fd.get("smsAcceptTemplate")),
    },
  });
  await syncMessagingWebhook();
  revalidatePath("/settings");
}

export async function sendTestSms(fd: FormData) {
  try {
    const to = String(fd.get("testPhone") || "").trim();
    await sendSms({
      to,
      text: "ITNX test: your Telnyx SMS is connected. Reply STOP to opt out.",
      requireConsent: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not send test text.";
    redirect(`/settings?sms=${encodeURIComponent(message)}`);
  }
  redirect("/settings?sms=sent");
}