import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { applyRemoteInvoice } from "@/lib/invoice";
import { billingSettings, stripeClient } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") || 0) > 1_000_000) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  const raw = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  let stripe;
  let webhookSecret = "";
  try {
    const settings = await billingSettings();
    webhookSecret = settings.webhookSecret;
    if (!settings.configured || !webhookSecret) {
      return NextResponse.json({ error: "stripe webhook is not configured" }, { status: 503 });
    }
    stripe = await stripeClient();
  } catch {
    return NextResponse.json({ error: "stripe webhook is not configured" }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (!event.type.startsWith("invoice.")) return NextResponse.json({ received: true });
  const object = event.data.object;
  if (!object || object.object !== "invoice") return NextResponse.json({ received: true });

  let remote: Stripe.Invoice = object;
  try {
    remote = await stripe.invoices.retrieve(object.id);
  } catch {
    remote = object;
  }
  const failure =
    event.type === "invoice.payment_failed" && remote.status !== "paid"
      ? "The latest payment attempt failed. The invoice is still open."
      : undefined;
  await applyRemoteInvoice(remote, failure);
  return NextResponse.json({ received: true });
}
