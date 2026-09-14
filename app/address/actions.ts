"use server";

import { cityFromZip, suggestAddresses, verifyAddress, type AddressInput } from "@/lib/address";
import { allowIp } from "@/lib/rate-limit";

export async function verifyAddressAction(input: AddressInput) {
  if (!(await allowIp("address", 40, 10 * 60 * 1000))) {
    return {
      ok: false as const,
      confidence: "UNCONFIRMED" as const,
      street: input.street || "",
      city: input.city || "",
      state: input.state || "",
      zip: input.zip || "",
      formatted: "",
      message: "Too many address lookups. Try again in a few minutes.",
      source: "census" as const,
    };
  }
  return verifyAddress(input);
}

export async function suggestAddressAction(query: string, city = "", state = "", zip = "") {
  if (!(await allowIp("address", 40, 10 * 60 * 1000))) return [];
  return suggestAddresses(query, city, state, zip);
}

export async function zipLookupAction(zip: string) {
  if (!(await allowIp("address", 40, 10 * 60 * 1000))) return null;
  return cityFromZip(zip);
}
