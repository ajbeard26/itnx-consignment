"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { Method, Status } from "@prisma/client";
import { db } from "@/lib/db";
import { savePhotos, saveRemotePhotos, text } from "@/lib/uploads";
import { importGovDealsListing } from "@/lib/govdeals";
import { ensureInfoToken, ensureCustomerReference } from "@/lib/customer";
import { verifyAddress, formatAddress } from "@/lib/address";
import { toE164 } from "@/lib/phone";
import { auctionFeeCents, consignorBps, tierForSale } from "@/lib/commission";
import { allocateDealId, allocateCustomerId, customerSearchNeedles, dealSearchNeedles } from "@/lib/reference";
import { parseDay } from "@/lib/dates";
import { requireStaff } from "@/lib/staff";
import { safeListingUrl } from "@/lib/safe";

function payoutMethod(value: FormDataEntryValue | null): Method {
  const method = String(value || "CHECK");
  if (method === Method.CASH || method === Method.ACH || method === Method.CHECK) return method;
  return Method.CHECK;
}

function dealStatus(value: FormDataEntryValue | null): Status {
  const status = String(value || "RECEIVED");
  if ((Object.values(Status) as string[]).includes(status)) return status as Status;
  return Status.RECEIVED;
}

export async function searchCustomers(query: string) {
  await requireStaff();
  const q = query.trim();
  if (q.length < 2) return [];
  const customerNeedles = customerSearchNeedles(q);
  const people = await db.customer.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
        { company: { contains: q, mode: "insensitive" } },
        ...customerNeedles.map((n) => ({ reference: { contains: n, mode: "insensitive" as const } })),
      ],
    },
    orderBy: { name: "asc" },
    take: 12,
    select: {
      id: true,
      reference: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      address: true,
    },
  });
  const needles = dealSearchNeedles(q);
  const deals = await db.consignment.findMany({
    where: { OR: needles.map((n) => ({ reference: { contains: n, mode: "insensitive" } })) },
    take: 8,
    select: {
      customer: {
        select: { id: true, reference: true, name: true, email: true, phone: true, company: true, address: true },
      },
    },
  });
  const seen = new Set(people.map((p) => p.id));
  const extra = deals
    .map((d) => d.customer)
    .filter((c) => {
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  return [...extra, ...people].slice(0, 20);
}

export async function createCustomerForDeal(fd: FormData) {
  await requireStaff();
  const name = String(fd.get("name") || "").trim();
  if (!name) throw new Error("Customer name is required");
  const phone = text(fd.get("phone"));
  const street = String(fd.get("street") || "");
  const city = String(fd.get("city") || "");
  const state = String(fd.get("state") || "");
  const zip = String(fd.get("zip") || "");
  const checked = street.trim() ? await verifyAddress({ street, city, state, zip }) : null;
  const customer = await db.customer.create({
    data: {
      reference: await allocateCustomerId(),
      name,
      email: text(fd.get("email")),
      phone,
      phoneE164: toE164(phone || ""),
      company: text(fd.get("company")),
      street: checked?.street || street || null,
      city: checked?.city || city || null,
      state: checked?.state || state || null,
      zip: checked?.zip || zip || null,
      address: checked ? formatAddress(checked) : text(fd.get("address")),
      addressVerified: Boolean(checked?.ok),
      addressVerifiedAt: checked?.ok ? new Date() : null,
      addressVerifiedSource: checked?.ok ? checked.source : null,
      infoToken: randomBytes(24).toString("hex"),
    },
  });
  redirect(`/consignments/new?customer=${customer.id}`);
}

export async function importListing(url: string) {
  await requireStaff();
  try {
    const listing = await importGovDealsListing(url);
    return { ok: true as const, listing };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "Could not import that listing.",
    };
  }
}

export async function create(fd: FormData) {
  await requireStaff();
  const customerId = text(fd.get("customerId"));
  if (!customerId) throw new Error("Choose a customer first");
  const existing = await db.customer.findUnique({ where: { id: customerId } });
  if (!existing) throw new Error("Customer not found");
  await ensureInfoToken(existing.id);
  await ensureCustomerReference(existing.id);

  const salePriceCents = Math.round(Number(fd.get("sale") || 0) * 100);
  const askingPriceCents = Math.round(Number(fd.get("asking") || 0) * 100);
  const tier = tierForSale(salePriceCents || askingPriceCents);
  const postedPercent = Number(fd.get("percent"));
  const consignorPercent =
    Number.isFinite(postedPercent) && postedPercent > 0 ? postedPercent : tier.consignorPercent;
  const feeRaw = String(fd.get("fee") ?? "").trim();
  const feeCents =
    feeRaw === ""
      ? auctionFeeCents(salePriceCents || askingPriceCents)
      : Math.round(Number(feeRaw || 0) * 100);

  const x = await db.consignment.create({
    data: {
      reference: await allocateDealId(),
      title: String(fd.get("title") || "").trim(),
      description: text(fd.get("description")),
      category: text(fd.get("category")),
      condition: text(fd.get("condition")),
      serialNumber: text(fd.get("serial")),
      location: text(fd.get("location")),
      notes: text(fd.get("notes")),
      listingUrl: safeListingUrl(fd.get("listingUrl")),
      listedAt: parseDay(fd.get("listedAt")),
      customerId,
      platform: text(fd.get("platform")),
      salePriceCents,
      askingPriceCents,
      customerPercentBps: consignorBps(consignorPercent),
      feeCents,
      method: payoutMethod(fd.get("method")),
      status: dealStatus(fd.get("status")),
      acceptanceToken: randomBytes(24).toString("hex"),
    },
  });

  const uploaded = await savePhotos(x.id, fd.getAll("photos"));
  const remote = await saveRemotePhotos(
    x.id,
    fd
      .getAll("importedPhotos")
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );
  const photos = [...uploaded, ...remote].slice(0, 8);
  if (photos.length) {
    await db.consignmentImage.createMany({
      data: photos.map((path) => ({ consignmentId: x.id, path })),
    });
  }
  redirect(`/consignments/${x.id}`);
}