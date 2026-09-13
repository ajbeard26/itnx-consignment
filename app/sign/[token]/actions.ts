"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { saveCustomerPayout } from "@/lib/customer";
import { requestAudit } from "@/lib/request";
import { logDealEvent } from "@/lib/events";

export async function accept(token: string, fd: FormData) {
  const x = await db.consignment.findUnique({
    where: { acceptanceToken: token },
    include: { customer: true },
  });
  if (!x) throw new Error("Invalid");
  const agreed = ["on", "yes", "true", "1"].includes(String(fd.get("agreeTerms") || "").toLowerCase());
  if (!agreed) {
    redirect(`/sign/${token}?error=${encodeURIComponent("Please agree to the Consignment Agreement to sign.")}`);
  }
  try {
    await saveCustomerPayout(x.customerId, fd, x.customer.name, { consignmentId: x.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save address.";
    redirect(`/sign/${token}?error=${encodeURIComponent(message)}`);
  }
  const audit = await requestAudit();
  const name = String(fd.get("name") || fd.get("payoutName") || x.customer.name);
  await db.consignment.update({
    where: { id: x.id },
    data: {
      acceptedName: name,
      acceptedAt: new Date(),
      acceptedIp: audit.ip,
      acceptedUserAgent: audit.userAgent,
      acceptedForwarded: audit.forwarded,
      acceptedCountry: audit.country,
      status: x.paid ? "COMPLETED" : "ACCEPTED",
    },
  });
  await logDealEvent({
    consignmentId: x.id,
    kind: "signed",
    summary: `Signed by ${name}`,
    ip: audit.ip,
    userAgent: audit.userAgent,
  });
  redirect(`/sign/${token}?signed=1`);
}
