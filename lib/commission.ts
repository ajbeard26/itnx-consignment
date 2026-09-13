export const AUCTION_FEE_BPS = 1250;

export type CommissionTier = {
  minCents: number;
  maxCents: number | null;
  label: string;
  consigneePercent: number;
  consignorPercent: number;
  effectiveAfterFee: number;
};

export const COMMISSION_TIERS: CommissionTier[] = [
  {
    minCents: 0,
    maxCents: 49999,
    label: "$0–$499",
    consigneePercent: 50,
    consignorPercent: 50,
    effectiveAfterFee: 37.5,
  },
  {
    minCents: 50000,
    maxCents: 99999,
    label: "$500–$999",
    consigneePercent: 40,
    consignorPercent: 60,
    effectiveAfterFee: 27.5,
  },
  {
    minCents: 100000,
    maxCents: null,
    label: "$1,000+",
    consigneePercent: 30,
    consignorPercent: 70,
    effectiveAfterFee: 17.5,
  },
];

export function tierForSale(saleCents: number) {
  const n = Math.max(0, Math.round(saleCents || 0));
  return (
    COMMISSION_TIERS.find((tier) => n >= tier.minCents && (tier.maxCents == null || n <= tier.maxCents)) ||
    COMMISSION_TIERS[0]
  );
}

export function auctionFeeCents(saleCents: number, feeBps = AUCTION_FEE_BPS) {
  return Math.round(Math.max(0, saleCents || 0) * feeBps / 10000);
}

export function consignorBps(percent: number) {
  return Math.round(Math.min(100, Math.max(0, percent)) * 100);
}

export function calc(
  saleCents: number,
  consignorBpsValue: number,
  feeCents: number
) {
  const sale = Math.max(0, Math.round(saleCents || 0));
  const bps = Math.min(10000, Math.max(0, Math.round(consignorBpsValue || 0)));
  const customer = Math.round((sale * bps) / 10000);
  const gross = sale - customer;
  const fee = Math.max(0, Math.round(feeCents || 0));
  return {
    sale,
    customer,
    gross,
    fee,
    net: gross - fee,
    consignorPercent: bps / 100,
    consigneePercent: (10000 - bps) / 100,
  };
}

export function dollarsFromCents(cents: number) {
  return (Math.max(0, cents || 0) / 100).toFixed(2);
}
