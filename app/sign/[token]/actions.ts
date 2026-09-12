"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export async function accept(token: string, fd: FormData) {
  const x = await db.consignment.findUnique({ where: { acceptanceToken: token } });
  if (!x) throw new Error("Invalid");
  await db.consignment.update({
    where: { id: x.id },
    data: {
      acceptedName: String(fd.get("name")),
      acceptedAt: new Date(),
      status: x.paid ? "PAID" : "ACCEPTED",
    },
  });
  redirect(`/sign/${token}?signed=1`);
}
