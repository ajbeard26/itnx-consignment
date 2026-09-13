import { db } from "@/lib/db";

export async function logDealEvent(opts: {
  consignmentId: string;
  kind: "signed" | "email" | "sms";
  summary: string;
  ip?: string | null;
  userAgent?: string | null;
}) {
  await db.dealEvent.create({
    data: {
      consignmentId: opts.consignmentId,
      kind: opts.kind,
      summary: opts.summary.slice(0, 240),
      ip: opts.ip || null,
      userAgent: opts.userAgent || null,
    },
  });
}
