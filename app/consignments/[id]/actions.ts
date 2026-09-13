"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { text, removeLocalPhoto } from "@/lib/uploads";
import { auctionFeeCents, consignorBps, tierForSale } from "@/lib/commission";
import { parseMethod, parseStatus, statusWrite } from "@/lib/deals";

async function touchDeal(id: string) {
  const x = await db.consignment.findUnique({ where: { id }, select: { id: true, customerId: true } });
  if (!x) return;
  revalidatePath(`/consignments/${id}`);
  revalidatePath("/consignments");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${x.customerId}`);
}

export async function paid(id: string, fd: FormData) {
  await db.consignment.update({
    where: { id },
    data: {
      paid: true,
      status: "COMPLETED",
      payoutReference: String(fd.get("ref") || "") || null,
    },
  });
  await touchDeal(id);
}

export async function updateStatus(id: string, fd: FormData) {
  const current = await db.consignment.findUnique({ where: { id } });
  if (!current) return;
  const status = parseStatus(fd.get("status"), current.status);
  await db.consignment.update({
    where: { id },
    data: statusWrite(status),
  });
  await touchDeal(id);
}

export async function updateItem(id: string, fd: FormData) {
  const current = await db.consignment.findUnique({ where: { id } });
  if (!current) return;
  await db.consignment.update({
    where: { id },
    data: {
      title: String(fd.get("title") || current.title).trim() || current.title,
      category: text(fd.get("category")),
      condition: text(fd.get("condition")),
      serialNumber: text(fd.get("serial")),
      location: text(fd.get("location")),
      notes: text(fd.get("notes")),
      listingUrl: text(fd.get("listingUrl")),
      description: text(fd.get("description")),
    },
  });
  await touchDeal(id);
}

export async function updatePayout(id: string, fd: FormData) {
  const current = await db.consignment.findUnique({ where: { id } });
  if (!current) return;
  const status = parseStatus(fd.get("status"), current.status);
  const method = parseMethod(fd.get("method"), current.method);
  const salePriceCents = Math.round(Number(fd.get("sale") || 0) * 100);
  const askingPriceCents = Math.round(Number(fd.get("asking") || 0) * 100);
  const moneyChanged = salePriceCents !== current.salePriceCents;
  const tier = tierForSale(salePriceCents || askingPriceCents);
  await db.consignment.update({
    where: { id },
    data: {
      ...statusWrite(status),
      method,
      platform: text(fd.get("platform")),
      salePriceCents,
      askingPriceCents,
      ...(moneyChanged
        ? {
            customerPercentBps: consignorBps(tier.consignorPercent),
            feeCents: auctionFeeCents(salePriceCents || askingPriceCents),
          }
        : {}),
    },
  });
  await touchDeal(id);
}

export async function deletePhoto(consignmentId: string, imageId: string) {
  const img = await db.consignmentImage.findFirst({
    where: { id: imageId, consignmentId },
  });
  if (!img) return;
  await db.consignmentImage.delete({ where: { id: imageId } });
  await removeLocalPhoto(img.path);
  await touchDeal(consignmentId);
}

export async function deleteConsignment(id: string) {
  const current = await db.consignment.findUnique({ where: { id }, select: { customerId: true } });
  if (!current) redirect("/consignments");
  await db.consignment.delete({ where: { id } });
  revalidatePath("/consignments");
  revalidatePath("/dashboard");
  revalidatePath(`/customers/${current.customerId}`);
  redirect("/consignments");
}
