"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { saveCustomerPayout } from "@/lib/customer";

export async function accept(token: string, fd: FormData) {
  const x = await db.consignment.findUnique({
    where: { acceptanceToken: token },
    include: { customer: true },
  });
  if (!x) throw new Error("Invalid");
  try {
    await saveCustomerPayout(x.customerId, fd, x.customer.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save address.";
    redirect(`/sign/${token}?error=${encodeURIComponent(message)}`);
  }
  await db.consignment.update({
    where: { id: x.id },
    data: {
      acceptedName: String(fd.get("name") || fd.get("payoutName") || x.customer.name),
      acceptedAt: new Date(),
      status: x.paid ? "PAID" : "ACCEPTED",
    },
  });
  redirect(`/sign/${token}?signed=1`);
}