import { calc } from "@/lib/commission";

export { calc } from "@/lib/commission";

export const money = (c: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100);

export function payoutPreview(saleCents: number, consignorBps: number, feeCents: number) {
  return calc(saleCents, consignorBps, feeCents);
}

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const TEENS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function underThousand(n: number) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else {
    if (rest >= 20) parts.push(TENS[Math.floor(rest / 10)] + (rest % 10 ? `-${ONES[rest % 10]}` : ""));
    else if (rest) parts.push(ONES[rest]);
  }
  return parts.join(" ");
}

export function moneyWords(cents: number) {
  const abs = Math.abs(Math.round(cents));
  let dollars = Math.floor(abs / 100);
  const coins = abs % 100;
  const parts: string[] = [];
  const millions = Math.floor(dollars / 1_000_000);
  dollars %= 1_000_000;
  const thousands = Math.floor(dollars / 1000);
  dollars %= 1000;
  if (millions) parts.push(`${underThousand(millions)} million`);
  if (thousands) parts.push(`${underThousand(thousands)} thousand`);
  if (dollars) parts.push(underThousand(dollars));
  const whole = parts.join(" ") || "zero";
  const text = `${whole} and ${String(coins).padStart(2, "0")}/100 dollars`;
  const titled = text.charAt(0).toUpperCase() + text.slice(1);
  return cents < 0 ? `Minus ${titled}` : titled;
}

export function moneyWordsLine(cents: number) {
  return `${moneyWords(cents).replace(/ dollars$/i, "")} **`;
}
