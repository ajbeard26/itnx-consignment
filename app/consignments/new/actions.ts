"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { Method, Status } from "@prisma/client";
import { db } from "@/lib/db";
import { savePhotos, text } from "@/lib/uploads";

function payoutMethod(value: FormDataEntryValue | null): Method {
  const method = String(value || "CHECK");
  if (method === Method.CASH || method === Method.ACH || method === Method.CHECK) return method;
  return Method.CHECK;
}

function dealStatus(value: FormDataEntryValue | null): Status {
  const status = String(value || "PAYOUT_DUE");
  if ((Object.values(Status) as string[]).includes(status)) return status as Status;
  return Status.PAYOUT_DUE;
}

export async function create(fd: FormData) {
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const customer = await db.customer.create({
    data: {
      name: String(fd.get("name") || "").trim(),
      email: text(fd.get("email")),
      phone: text(fd.get("phone")),
      company: text(fd.get("company")),
      address: text(fd.get("address")),
    },
  });
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
      customerId: customer.id,
      platform: text(fd.get("platform")),
      salePriceCents: Math.round(Number(fd.get("sale") || 0) * 100),
      customerPercentBps: Math.round(
        Number(fd.get("percent") || settings.defaultCustomerPercentBps / 100) * 100
      ),
      feeCents: Math.round(Number(fd.get("fee") || 0) * 100),
      method: payoutMethod(fd.get("method")),
      status: dealStatus(fd.get("status")),
      acceptanceToken: randomBytes(24).toString("hex"),
    },
  });
  const photos = await savePhotos(x.id, fd.getAll("photos"));
  if (photos.length) {
    await db.consignmentImage.createMany({
      data: photos.map((path) => ({ consignmentId: x.id, path })),
    });
  }
  redirect(`/consignments/${x.id}`);
}
