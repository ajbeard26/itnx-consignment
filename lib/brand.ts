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
