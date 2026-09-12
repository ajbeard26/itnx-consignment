import { db } from "@/lib/db";
import { last10, toE164 } from "@/lib/phone";

const DEFAULTS = {
  consent:
    "{brand}: Reply YES to get texts about your consignment payout. Msg & data rates may apply. Reply STOP to opt out.",
  payout: "{brand}: Add your mailing/payout info here: {link}",
  accept: "{brand}: Review and sign your payout: {link}",
};

export function fillTemplate(template: string | null | undefined, fallback: string, vars: Record<string, string>) {
  let text = (template || fallback).trim();
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return text.slice(0, 480);
}

export async function smsTemplates() {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  const brand = s?.brandName || "ITNX";
  return {
    brand,
    consent: s?.smsConsentTemplate || DEFAULTS.consent,
    payout: s?.smsPayoutTemplate || DEFAULTS.payout,
    accept: s?.smsAcceptTemplate || DEFAULTS.accept,
    defaults: DEFAULTS,
  };
}

export async function findCustomerByPhone(phone: string) {
  const e164 = toE164(phone);
  const ten = last10(phone);
  if (!ten) return null;
  return db.customer.findFirst({
    where: {
      OR: [
        ...(e164 ? [{ phoneE164: e164 }] : []),
        { phone: { contains: ten } },
        { payoutPhone: { contains: ten } },
      ],
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function canText(customer: { smsConsent: boolean; smsOptOut: boolean } | null) {
  if (!customer) return false;
  return customer.smsConsent && !customer.smsOptOut;
}