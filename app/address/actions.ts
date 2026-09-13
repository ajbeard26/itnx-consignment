"use server";

import { cityFromZip, suggestAddresses, verifyAddress, type AddressInput } from "@/lib/address";

export async function verifyAddressAction(input: AddressInput) {
  return verifyAddress(input);
}

export async function suggestAddressAction(query: string, city = "", state = "", zip = "") {
  return suggestAddresses(query, city, state, zip);
}

export async function zipLookupAction(zip: string) {
  return cityFromZip(zip);
}