import { randomBytes } from "crypto";
import { Method } from "@prisma/client";
import { db } from "@/lib/db";
import { text } from "@/lib/uploads";
import { formatAddress, verifyAddress } from "@/lib/address";
import { toE164 } from "@/lib/phone";
import { allocateCustomerId } from "@/lib/reference";

export { appUrl, infoUrl, signUrl } from "@/lib/urls";

function payoutMethod(value: string): Method {
  if (value === "ACH" || value === "CASH" || value === "CHECK") return value;
  return "CHECK";
}

export async function ensureInfoToken(customerId: string) {
  const customer = await db.customer.findUnique({ where: { id: customerId } });
  if (!customer) return null;
  if (customer.infoToken) return customer.infoToken;
  const infoToken = randomBytes(24).toString("hex");
  await db.customer.update({ where: { id: customerId }, data: { infoToken } });
  return infoToken;
}

export async function ensureCustomerReference(customerId: string) {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    select: { reference: true, createdAt: true },
  });
  if (!customer) return null;
  if (customer.reference) return customer.reference;
  const year = customer.createdAt.getFullYear();
  for (let attempt = 0; attempt < 8; attempt++) {
    const reference = await allocateCustomerId(year);
    try {
      await db.customer.update({
        where: { id: customerId },
        data: { reference },
      });
      return reference;
    } catch {
      const again = await db.customer.findUnique({
        where: { id: customerId },
        select: { reference: true },
      });
      if (again?.reference) return again.reference;
    }
  }
  throw new Error("Could not assign a customer ID. Try again.");
}

export async function backfillCustomerIds() {
  const missing = await db.customer.findMany({
    where: { reference: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const row of missing) {
    await ensureCustomerReference(row.id);
  }
}

export async function saveCustomerPayout(
  customerId: string,
  fd: FormData,
  fallbackName: string,
  opts?: { consignmentId?: string }
) {
  const last4 = String(fd.get("accountLast4") || "")
    .replace(/\D/g, "")
    .slice(-4);
  const name = String(fd.get("payoutName") || fd.get("name") || "").trim() || fallbackName;
  const phone = text(fd.get("payoutPhone"));
  const checked = ["on", "yes", "true", "1"].includes(String(fd.get("smsConsent") || "").toLowerCase());
  const existing = await db.customer.findUnique({ where: { id: customerId } });
  const latest = opts?.consignmentId
    ? await db.consignment.findFirst({ where: { id: opts.consignmentId, customerId } })
    : await db.consignment.findFirst({
        where: { customerId, paid: false },
        orderBy: { createdAt: "desc" },
      });
  const method = latest?.method || payoutMethod(String(fd.get("payoutMethod") || "CHECK").toUpperCase());
  const payable = String(fd.get("checkPayableTo") || "").trim() || name;
  const street = String(fd.get("payoutAddress") || "").trim();
  const city = String(fd.get("payoutCity") || "").trim();
  const state = String(fd.get("payoutState") || "").trim();
  const zip = String(fd.get("payoutZip") || "").trim();
  const hasMailing = Boolean(street && city && state && zip.replace(/\D/g, "").length >= 5);

  if (method === "CHECK" && !payable) {
    throw new Error("Enter the name to print on the check.");
  }
  if (method === "CHECK" && !hasMailing) {
    throw new Error("Enter a mailing address so we can send your check.");
  }

  let mailing = {
    street: existing?.payoutAddress || existing?.street || street,
    city: existing?.payoutCity || existing?.city || city,
    state: existing?.payoutState || existing?.state || state,
    zip: existing?.payoutZip || existing?.zip || zip,
    formatted: existing?.address || "",
    verified: Boolean(existing?.payoutAddressVerified || existing?.addressVerified),
    source: existing?.payoutAddressVerifiedSource || existing?.addressVerifiedSource || null,
  };

  if (hasMailing) {
    const result = await verifyAddress({ street, city, state, zip });
    mailing = result.ok
      ? {
          street: result.street,
          city: result.city,
          state: result.state,
          zip: result.zip,
          formatted: result.formatted,
          verified: true,
          source: result.source,
        }
      : {
          street,
          city,
          state: state.slice(0, 2).toUpperCase(),
          zip,
          formatted: formatAddress({ street, city, state, zip }),
          verified: false,
          source: null,
        };
  }

  await db.customer.update({
    where: { id: customerId },
    data: {
      name,
      email: text(fd.get("payoutEmail")) || undefined,
      phone: phone || undefined,
      phoneE164: toE164(phone || "") || undefined,
      ...(hasMailing
        ? {
            street: mailing.street,
            city: mailing.city,
            state: mailing.state,
            zip: mailing.zip,
            address: mailing.formatted,
            addressVerified: mailing.verified,
            addressVerifiedAt: mailing.verified ? new Date() : null,
            addressVerifiedSource: mailing.source,
            payoutAddress: mailing.street,
            payoutCity: mailing.city,
            payoutState: mailing.state,
            payoutZip: mailing.zip,
            payoutAddressVerified: mailing.verified,
            payoutAddressVerifiedAt: mailing.verified ? new Date() : null,
            payoutAddressVerifiedSource: mailing.source,
          }
        : {}),
      payoutName: name,
      payoutEmail: text(fd.get("payoutEmail")),
      payoutPhone: phone,
      checkPayableTo: payable,
      bankName: method === "ACH" ? text(fd.get("bankName")) : existing?.bankName,
      accountLast4: method === "ACH" ? last4 || null : existing?.accountLast4,
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