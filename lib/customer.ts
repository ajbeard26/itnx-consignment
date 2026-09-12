import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { text } from "@/lib/uploads";
import { formatAddress, verifyAddress } from "@/lib/address";
import { toE164 } from "@/lib/phone";

export async function ensureInfoToken(customerId: string) {
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return null;
  if (customer.infoToken) return customer.infoToken;
  const infoToken = randomBytes(24).toString("hex");
  await db.customer.update({ where: { id: customerId }, data: { infoToken } });
  return infoToken;
}

export function infoUrl(token: string | null | undefined) {
  if (!token) return "";
  const base = process.env.NEXT_PUBLIC_APP_URL || "";
  return `${base}/info/${token}`;
}

export async function saveCustomerPayout(customerId: string, fd: FormData, fallbackName: string) {
  const last4 = String(fd.get("accountLast4") || "")
    .replace(/\D/g, "")
    .slice(-4);
  const name = String(fd.get("payoutName") || fd.get("name") || "").trim() || fallbackName;
  const phone = text(fd.get("payoutPhone"));
  const checked = ["on", "yes", "true", "1"].includes(String(fd.get("smsConsent") || "").toLowerCase());

  const result = await verifyAddress({
    street: String(fd.get("payoutAddress") || ""),
    city: String(fd.get("payoutCity") || ""),
    state: String(fd.get("payoutState") || ""),
    zip: String(fd.get("payoutZip") || ""),
  });
  if (!result.ok) {
    throw new Error(result.message || "Verify the mailing address before saving.");
  }

  const existing = await db.customer.findUnique({ where: { id: customerId } });

  await db.customer.update({
    where: { id: customerId },
    data: {
      name,
      email: text(fd.get("payoutEmail")) || undefined,
      phone: phone || undefined,
      phoneE164: toE164(phone || "") || undefined,
      street: result.street,
      city: result.city,
      state: result.state,
      zip: result.zip,
      address: formatAddress(result),
      addressVerified: true,
      addressVerifiedAt: new Date(),
      payoutName: name,
      payoutEmail: text(fd.get("payoutEmail")),
      payoutPhone: phone,
      payoutAddress: result.street,
      payoutCity: result.city,
      payoutState: result.state,
      payoutZip: result.zip,
      payoutAddressVerified: true,
      payoutAddressVerifiedAt: new Date(),
      checkPayableTo: text(fd.get("checkPayableTo")) || name,
      bankName: text(fd.get("bankName")),
      accountLast4: last4 || null,
      payoutReady: true,
      payoutUpdatedAt: new Date(),
      ...(checked && !existing?.smsOptOut
        ? {
            smsConsent: true,
            smsConsentAt: existing?.smsConsentAt || new Date(),
            smsConsentMethod: existing?.smsConsentMethod || "WEB",
          }
        : {}),
    },
  });
}