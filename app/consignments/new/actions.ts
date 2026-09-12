"use server";

import { randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { Method } from "@prisma/client";
import { db } from "@/lib/db";

function payoutMethod(value: FormDataEntryValue | null): Method {
  const method = String(value || "CHECK");
  if (method === Method.CASH || method === Method.ACH || method === Method.CHECK) {
    return method;
  }
  return Method.CHECK;
}

export async function create(fd: FormData) {
  const settings = await db.settings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  const customer = await db.customer.create({
    data: {
      name: String(fd.get("name")),
      email: String(fd.get("email") || "") || null,
      phone: String(fd.get("phone") || "") || null,
    },
  });
  const count = await db.consignment.count();
  const x = await db.consignment.create({
    data: {
      reference: `ITNX-${1001 + count}`,
      title: String(fd.get("title")),
      customerId: customer.id,
      platform: String(fd.get("platform") || "") || null,
      salePriceCents: Math.round(Number(fd.get("sale") || 0) * 100),
      customerPercentBps: Math.round(
        Number(fd.get("percent") || settings.defaultCustomerPercentBps / 100) * 100
      ),
      feeCents: Math.round(Number(fd.get("fee") || 0) * 100),
      method: payoutMethod(fd.get("method")),
      status: "PAYOUT_DUE",
      acceptanceToken: randomBytes(24).toString("hex"),
    },
  });
  redirect(`/consignments/${x.id}`);
}
