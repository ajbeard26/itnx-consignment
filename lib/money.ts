import { calc } from "@/lib/commission";

export { calc } from "@/lib/commission";

export const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

export function payoutPreview(saleCents: number, consignorBps: number, feeCents: number) {
  return calc(saleCents, consignorBps, feeCents);
}
