import Stripe from "stripe";
import { db } from "@/lib/db";
import { clampInvoiceDays } from "@/lib/invoice-shared";

export function stripeConfigured(s: { stripeSecretKey?: string | null } | null | undefined) {
  return Boolean((s?.stripeSecretKey || process.env.STRIPE_SECRET_KEY || "").trim());
}

export async function billingSettings() {
  const s = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const secretKey = (s.stripeSecretKey || process.env.STRIPE_SECRET_KEY || "").trim();
  const webhookSecret = (s.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const mode = secretKey.startsWith("sk_test_") ? "test" : secretKey ? "live" : "off";
  return {
    secretKey,
    webhookSecret,
    daysUntilDue: clampInvoiceDays(s.invoiceDaysUntilDue, 14),
    footer: (s.invoiceFooter || "").trim(),
    configured: Boolean(secretKey),
    mode: mode as "test" | "live" | "off",
    fromEnvKey: Boolean(!s.stripeSecretKey && process.env.STRIPE_SECRET_KEY),
    fromEnvHook: Boolean(!s.stripeWebhookSecret && process.env.STRIPE_WEBHOOK_SECRET),
  };
}

export async function stripeClient() {
  const { secretKey } = await billingSettings();
  if (!secretKey) throw new Error("Add your Stripe secret key in Settings → Payments.");
  return new Stripe(secretKey);
}
