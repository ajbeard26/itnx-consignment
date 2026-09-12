"use server";

import { Method } from "@prisma/client";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { text } from "@/lib/uploads";

function method(value: FormDataEntryValue | null): Method {
  const v = String(value || "CHECK");
  if (v === Method.CASH || v === Method.ACH || v === Method.CHECK) return v;
  return Method.CHECK;
}

export async function save(fd: FormData) {
  const p = Number(fd.get("percent") || 50);
  await db.settings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });
  await db.settings.update({
    where: { id: 1 },
    data: {
      defaultCustomerPercentBps: Math.round(p * 100),
      brandName: String(fd.get("brandName") || "ITNX Consignment").trim() || "ITNX Consignment",
      legalName: String(fd.get("legalName") || "NXRENT LLC").trim() || "NXRENT LLC",
      contactEmail: text(fd.get("contactEmail")),
      contactPhone: text(fd.get("contactPhone")),
      website: text(fd.get("website")),
      address: text(fd.get("address")),
      defaultPlatform: text(fd.get("defaultPlatform")),
      defaultMethod: method(fd.get("defaultMethod")),
      payoutNotes: text(fd.get("payoutNotes")),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/consignments/new");
}
