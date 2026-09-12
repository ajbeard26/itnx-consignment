import { db } from "@/lib/db";
import { toE164 } from "@/lib/phone";
import { findCustomerByPhone } from "@/lib/sms";

async function settings() {
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export function telnyxConfigured(s: { telnyxApiKey: string | null; telnyxFromNumber: string | null }) {
  return Boolean(s.telnyxApiKey && s.telnyxFromNumber);
}

export async function sendSms(opts: {
  to: string;
  text: string;
  customerId?: string | null;
  requireConsent?: boolean;
}) {
  const s = await settings();
  if (!s.telnyxApiKey || !s.telnyxFromNumber) {
    throw new Error("Add your Telnyx API key and from-number in Settings.");
  }
  const to = toE164(opts.to);
  const from = toE164(s.telnyxFromNumber);
  if (!to) throw new Error("That phone number is not a valid US number.");
  if (!from) throw new Error("The Telnyx from-number in Settings is not valid.");

  const customer =
    (opts.customerId ? await db.customer.findUnique({ where: { id: opts.customerId } }) : null) ||
    (await findCustomerByPhone(to));

  if (customer?.smsOptOut) {
    throw new Error("This number opted out. They must text START to your Telnyx number first.");
  }
  if (opts.requireConsent !== false && customer && !customer.smsConsent) {
    throw new Error("Get text consent first (web checkbox or a YES reply).");
  }

  const body: Record<string, unknown> = { from, to, text: opts.text };
  if (s.telnyxMessagingProfileId) body.messaging_profile_id = s.telnyxMessagingProfileId;
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (app) body.webhook_url = `${app.replace(/\/$/, "")}/api/telnyx/webhook`;

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${s.telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    errors?: Array<{ detail?: string; title?: string }>;
  };
  if (!res.ok) {
    throw new Error(data.errors?.[0]?.detail || data.errors?.[0]?.title || `Telnyx error ${res.status}`);
  }

  await db.smsMessage.create({
    data: {
      customerId: customer?.id || opts.customerId || null,
      direction: "OUT",
      phone: to,
      body: opts.text,
      status: "sent",
      telnyxId: data.data?.id || null,
    },
  });

  if (customer) {
    await db.customer.update({
      where: { id: customer.id },
      data: { phoneE164: to, phone: customer.phone || to },
    });
  }

  return { id: data.data?.id, to };
}

export async function applyInboundSms(from: string, text: string, telnyxId?: string) {
  const body = String(text || "").trim();
  const keyword = body.toUpperCase().replace(/[^A-Z]/g, "");
  const customer = await findCustomerByPhone(from);
  const e164 = toE164(from) || from;

  if (telnyxId) {
    const existing = await db.smsMessage.findUnique({ where: { telnyxId } });
    if (existing) return { handled: true, duplicate: true };
  }

  await db.smsMessage.create({
    data: {
      customerId: customer?.id || null,
      direction: "IN",
      phone: e164,
      body,
      status: "received",
      telnyxId: telnyxId || null,
    },
  });

  const stop = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(keyword);
  const start = ["START", "UNSTOP", "YES", "Y", "AGREE", "CONSENT"].includes(keyword);
  const help = keyword === "HELP";

  if (customer && stop) {
    await db.customer.update({
      where: { id: customer.id },
      data: { smsOptOut: true, smsOptOutAt: new Date(), smsConsent: false },
    });
  }
  if (customer && start) {
    await db.customer.update({
      where: { id: customer.id },
      data: {
        smsOptOut: false,
        smsOptOutAt: null,
        smsConsent: true,
        smsConsentAt: new Date(),
        smsConsentMethod: "SMS",
        phoneE164: e164,
        phone: customer.phone || e164,
      },
    });
  }

  if (start && !stop) {
    await sendSms({
      to: e164,
      text: "You're opted in for ITNX consignment payout texts. Reply STOP to opt out.",
      customerId: customer?.id,
      requireConsent: false,
    }).catch(() => null);
  }
  if (help) {
    const s = await settings();
    await sendSms({
      to: e164,
      text: `ITNX Consignment help: ${s.contactPhone || s.contactEmail || "ask staff"}. Reply STOP to opt out.`,
      customerId: customer?.id,
      requireConsent: false,
    }).catch(() => null);
  }

  return { handled: true, stop, start, help, customerId: customer?.id || null };
}

export async function syncMessagingWebhook() {
  const s = await settings();
  const app = process.env.NEXT_PUBLIC_APP_URL;
  if (!s.telnyxApiKey || !s.telnyxMessagingProfileId || !app) return;
  await fetch(`https://api.telnyx.com/v2/messaging_profiles/${s.telnyxMessagingProfileId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${s.telnyxApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ webhook_url: `${app.replace(/\/$/, "")}/api/telnyx/webhook` }),
  }).catch(() => null);
}