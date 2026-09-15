import { db } from "@/lib/db";

export async function publicBrand() {
  try {
    const s = await db.settings.findUnique({ where: { id: 1 } });
    return {
      brand: s?.brandName || "ITNX Consignment",
      legal: s?.legalName || "NXRENT LLC",
      address: s?.address || "",
      contactEmail: s?.contactEmail || "",
      contactPhone: s?.contactPhone || "",
    };
  } catch {
    return {
      brand: "ITNX Consignment",
      legal: "NXRENT LLC",
      address: "",
      contactEmail: "",
      contactPhone: "",
    };
  }
}

export function senderAddressLines(address: string) {
  const raw = String(address || "")
    .replace(/\r/g, "")
    .trim();
  if (!raw) return [] as string[];
  if (raw.includes("\n")) return raw.split("\n").map((line) => line.trim()).filter(Boolean);
  const parts = raw.split(",").map((line) => line.trim()).filter(Boolean);
  if (parts.length >= 3) return [parts[0], parts.slice(1).join(", ")];
  return parts.length ? parts : [raw];
}
