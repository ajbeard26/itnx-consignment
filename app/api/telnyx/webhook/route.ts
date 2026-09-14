import { NextRequest, NextResponse } from "next/server";
import { createPublicKey, verify } from "crypto";
import { db } from "@/lib/db";
import { applyInboundSms } from "@/lib/telnyx";

function validSignature(raw: string, signature: string | null, timestamp: string | null, publicKey: string | null) {
  if (!publicKey || !signature || !timestamp) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.from(publicKey, "base64"),
      ]),
      format: "der",
      type: "spki",
    });
    return verify(null, Buffer.from(`${timestamp}|${raw}`), key, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get("content-length") || 0) > 200_000) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }
  const raw = await req.text();
  const settings = await db.settings.findUnique({ where: { id: 1 } });
  const ok = validSignature(
    raw,
    req.headers.get("telnyx-signature-ed25519"),
    req.headers.get("telnyx-timestamp"),
    settings?.telnyxPublicKey || null
  );
  if (!ok) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let json: {
    data?: {
      event_type?: string;
      payload?: {
        id?: string;
        text?: string;
        autoresponse_type?: string;
        from?: { phone_number?: string };
        to?: Array<{ status?: string }>;
      };
    };
  };
  try {
    json = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const event = json.data?.event_type;
  const payload = json.data?.payload;
  if (event === "message.received" && payload?.from?.phone_number) {
    const keyword = payload.autoresponse_type || payload.text || "";
    await applyInboundSms(payload.from.phone_number, payload.text || keyword, payload.id);
  }
  return NextResponse.json({ ok: true });
}