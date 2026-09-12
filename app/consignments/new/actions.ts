"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { Method, Status } from "@prisma/client";
import { db } from "@/lib/db";
import { savePhotos, saveRemotePhotos, text } from "@/lib/uploads";
import { importGovDealsListing } from "@/lib/govdeals";
import { ensureInfoToken } from "@/lib/customer";
import { verifyAddress, formatAddress } from "@/lib/address";
import { toE164 } from "@/lib/phone";

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
  const q = query.trim();
  return db.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 20,
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      address: true,
    },
  });
}

export async function importListing(url: string) {
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
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const existingId = text(fd.get("customerId"));
  let customerId = existingId;
  if (customerId) {
    const existing = await db.customer.findUnique({ where: { id: customerId } });
    if (!existing) throw new Error("Customer not found");
    await ensureInfoToken(existing.id);
  } else {
    const name = String(fd.get("name") || "").trim();
    if (!name) throw new Error("Customer name is required");
    const phone = text(fd.get("phone"));
    const street = String(fd.get("street") || "");
    const city = String(fd.get("city") || "");
    const state = String(fd.get("state") || "");
    const zip = String(fd.get("zip") || "");
    const checked = street.trim()
      ? await verifyAddress({ street, city, state, zip })
      : null;
    const created = await db.customer.create({
      data: {
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
    customerId = created.id;
  }

  const count = await db.consignment.count();
  const x = await db.consignment.create({
    data: {
      reference: `ITNX-${1001 + count}`,
      title: String(fd.get("title") || "").trim(),
      description: text(fd.get("description")),
      category: text(fd.get("category")),
      condition: text(fd.get("condition")),
      serialNumber: text(fd.get("serial")),
      location: text(fd.get("location")),
      notes: text(fd.get("notes")),
      listingUrl: text(fd.get("listingUrl")),
      customerId,
      platform: text(fd.get("platform")),
      salePriceCents: Math.round(Number(fd.get("sale") || 0) * 100),
      askingPriceCents: Math.round(Number(fd.get("asking") || 0) * 100),
      customerPercentBps: Math.round(
        Number(fd.get("percent") || settings.defaultCustomerPercentBps / 100) * 100
      ),
      feeCents: Math.round(Number(fd.get("fee") || 0) * 100),
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