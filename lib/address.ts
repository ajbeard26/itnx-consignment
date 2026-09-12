import { db } from "@/lib/db";

export type AddressInput = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type AddressResult = {
  ok: boolean;
  confidence: "MATCHED" | "APPROXIMATE" | "UNCONFIRMED";
  street: string;
  city: string;
  state: string;
  zip: string;
  formatted: string;
  message: string;
  source: "google" | "census";
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(Ne|Nw|Se|Sw)\b/g, (m) => m.toUpperCase());
}

function clean(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function formatAddress(a: AddressInput) {
  return [a.street, [a.city, a.state].filter(Boolean).join(", "), a.zip].filter(Boolean).join(", ");
}

async function googleKey() {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  return s?.googleMapsKey?.trim() || process.env.GOOGLE_MAPS_API_KEY || "";
}

async function verifyWithGoogle(input: AddressInput): Promise<AddressResult | null> {
  const key = await googleKey();
  if (!key) return null;
  try {
    const res = await fetch(`https://addressvalidation.googleapis.com/v1:validateAddress?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: {
          regionCode: "US",
          addressLines: [input.street, `${input.city} ${input.state} ${input.zip}`.trim()],
        },
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: {
        verdict?: { addressComplete?: boolean; hasUnconfirmedComponents?: boolean; validationGranularity?: string };
        address?: {
          formattedAddress?: string;
          postalAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string };
        };
      };
    };
    const postal = data.result?.address?.postalAddress;
    const street = clean(postal?.addressLines?.[0] || input.street);
    const city = clean(postal?.locality || input.city);
    const state = clean(postal?.administrativeArea || input.state).slice(0, 2).toUpperCase();
    const zip = clean((postal?.postalCode || input.zip).slice(0, 10));
    const complete = Boolean(data.result?.verdict?.addressComplete);
    const unconfirmed = Boolean(data.result?.verdict?.hasUnconfirmedComponents);
    const ok = complete && !unconfirmed && Boolean(street && city && state && zip);
    return {
      ok,
      confidence: ok ? "MATCHED" : complete ? "APPROXIMATE" : "UNCONFIRMED",
      street,
      city,
      state,
      zip,
      formatted: formatAddress({ street, city, state, zip }),
      message: ok
        ? "This USPS-style match is valid for mail and payout checks."
        : "We found a close match. Confirm the suggested address before saving.",
      source: "google",
    };
  } catch {
    return null;
  }
}

async function verifyWithCensus(input: AddressInput): Promise<AddressResult> {
  const params = new URLSearchParams({
    street: input.street,
    city: input.city,
    state: input.state,
    zip: input.zip,
    benchmark: "Public_AR_Current",
    format: "json",
  });
  const res = await fetch(`https://geocoding.geo.census.gov/geocoder/locations/address?${params}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    return {
      ok: false,
      confidence: "UNCONFIRMED",
      ...input,
      formatted: formatAddress(input),
      message: "Address lookup is unavailable right now. Check the street, city, state, and ZIP.",
      source: "census",
    };
  }
  const data = (await res.json()) as {
    result?: {
      addressMatches?: Array<{
        matchedAddress?: string;
        addressComponents?: { zip?: string; city?: string; state?: string; fromAddress?: string; streetName?: string; suffixType?: string; suffixDirection?: string; preDirection?: string; preType?: string };
      }>;
    };
  };
  const match = data.result?.addressMatches?.[0];
  if (!match) {
    return {
      ok: false,
      confidence: "UNCONFIRMED",
      ...input,
      formatted: formatAddress(input),
      message: "No US match for that address. Fix the street, city, state, or ZIP and verify again.",
      source: "census",
    };
  }
  const c = match.addressComponents || {};
  const street = titleCase(
    [c.fromAddress, c.preDirection, c.preType, c.streetName, c.suffixType, c.suffixDirection].filter(Boolean).join(" ")
  );
  const city = titleCase(c.city || input.city);
  const state = (c.state || input.state).toUpperCase();
  const zip = c.zip || input.zip;
  const standardized = { street: street || input.street, city, state, zip };
  return {
    ok: true,
    confidence: "MATCHED",
    ...standardized,
    formatted: formatAddress(standardized),
    message: "Verified against US Census / USPS address ranges.",
    source: "census",
  };
}

export async function verifyAddress(raw: AddressInput): Promise<AddressResult> {
  const input = {
    street: clean(raw.street),
    city: clean(raw.city),
    state: clean(raw.state).slice(0, 2).toUpperCase(),
    zip: clean(raw.zip).replace(/[^\d-]/g, "").slice(0, 10),
  };
  if (!input.street || !input.city || !input.state || input.zip.length < 5) {
    return {
      ok: false,
      confidence: "UNCONFIRMED",
      ...input,
      formatted: formatAddress(input),
      message: "Enter street, city, state, and ZIP, then verify.",
      source: "census",
    };
  }
  return (await verifyWithGoogle(input)) || verifyWithCensus(input);
}

export async function suggestAddresses(query: string) {
  const q = clean(query);
  if (q.length < 4) return [] as Array<AddressInput & { label: string }>;
  const key = await googleKey();
  if (!key) return [];
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
      },
      body: JSON.stringify({
        input: q,
        includedRegionCodes: ["us"],
        includedPrimaryTypes: ["street_address", "premise", "subpremise"],
      }),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }> };
    const out: Array<AddressInput & { label: string }> = [];
    for (const item of data.suggestions || []) {
      const placeId = item.placePrediction?.placeId;
      const label = item.placePrediction?.text?.text || "";
      if (!placeId) continue;
      const detail = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "addressComponents,formattedAddress",
        },
        cache: "no-store",
      });
      if (!detail.ok) continue;
      const place = (await detail.json()) as {
        formattedAddress?: string;
        addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
      };
      const get = (type: string, short = false) =>
        place.addressComponents?.find((c) => c.types?.includes(type))?.[short ? "shortText" : "longText"] || "";
      const street = clean([get("street_number"), get("route")].filter(Boolean).join(" "));
      if (!street) continue;
      out.push({
        street,
        city: get("locality") || get("sublocality") || get("administrative_area_level_2"),
        state: get("administrative_area_level_1", true),
        zip: get("postal_code"),
        label: label || place.formattedAddress || street,
      });
      if (out.length >= 5) break;
    }
    return out;
  } catch {
    return [];
  }
}

export async function cityFromZip(zip: string) {
  const z = zip.replace(/\D/g, "").slice(0, 5);
  if (z.length !== 5) return null;
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${z}`, { cache: "force-cache" });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: Array<{ "place name"?: string; "state abbreviation"?: string }> };
    const place = data.places?.[0];
    if (!place) return null;
    return { city: place["place name"] || "", state: place["state abbreviation"] || "" };
  } catch {
    return null;
  }
}