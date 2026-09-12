"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { saveCustomerPayout } from "@/lib/customer";

export async function saveInfo(token: string, fd: FormData) {
  const customer = await db.customer.findUnique({ where: { infoToken: token } });
  if (!customer) throw new Error("Invalid");
  try {
    await saveCustomerPayout(customer.id, fd, customer.name);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save.";
    redirect(`/info/${token}?error=${encodeURIComponent(message)}`);
  }
  redirect(`/info/${token}?saved=1`);
}