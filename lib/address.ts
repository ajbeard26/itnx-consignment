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
  source: "google";
  suggestion?: AddressInput;
};

export function googleVerified(verified?: boolean | null, source?: string | null) {
  return Boolean(verified && source === "google");
}

function clean(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function houseNumber(street: string) {
  const m = clean(street).match(/^(\d+[A-Za-z]?)/i);
  return (m?.[1] || "").toUpperCase();
}

function component(
  parts: Array<{ long_name?: string; short_name?: string; longText?: string; shortText?: string; types?: string[] }>,
  type: string,
  short = false
) {
  const hit = parts.find((p) => p.types?.includes(type));
  if (!hit) return "";
  if (short) return hit.short_name || hit.shortText || hit.long_name || hit.longText || "";
  return hit.long_name || hit.longText || hit.short_name || hit.shortText || "";
}

export function formatAddress(a: AddressInput) {
  return [a.street, [a.city, a.state].filter(Boolean).join(", "), a.zip].filter(Boolean).join(", ");
}

async function googleKey() {
  const s = await db.settings.findUnique({ where: { id: 1 } });
  return s?.googleMapsKey?.trim() || process.env.GOOGLE_MAPS_API_KEY || "";
}

function failed(input: AddressInput, message: string, extra: Partial<AddressResult> = {}): AddressResult {
  return {
    ok: false,
    confidence: "UNCONFIRMED",
    ...input,
    formatted: formatAddress(input),
    message,
    source: "google",
    ...extra,
  };
}

async function verifyWithAddressValidation(key: string, input: AddressInput): Promise<AddressResult | null> {
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
  if (res.status === 403 || res.status === 400) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as {
    result?: {
      verdict?: {
        addressComplete?: boolean;
        hasUnconfirmedComponents?: boolean;
        hasReplacedComponents?: boolean;
        validationGranularity?: string;
      };
      address?: {
        formattedAddress?: string;
        addressComponents?: Array<{ componentName?: { text?: string }; componentType?: string; confirmationLevel?: string }>;
        postalAddress?: { addressLines?: string[]; locality?: string; administrativeArea?: string; postalCode?: string };
      };
      uspsData?: { dpvConfirmation?: string };
    };
  };
  const postal = data.result?.address?.postalAddress;
  const street = clean(postal?.addressLines?.[0] || input.street);
  const city = clean(postal?.locality || input.city);
  const state = clean(postal?.administrativeArea || input.state).slice(0, 2).toUpperCase();
  const zip = clean((postal?.postalCode || input.zip).split("-")[0]).slice(0, 5);
  const suggested = { street, city, state, zip };
  const granularity = data.result?.verdict?.validationGranularity || "";
  const dpv = data.result?.uspsData?.dpvConfirmation || "";
  const complete = Boolean(data.result?.verdict?.addressComplete);
  const unconfirmed = Boolean(data.result?.verdict?.hasUnconfirmedComponents);
  const exactBuilding = ["PREMISE", "SUB_PREMISE"].includes(granularity) || dpv === "Y" || dpv === "S";
  const numberOk = !houseNumber(input.street) || houseNumber(input.street) === houseNumber(street);
  const zipOk = input.zip.slice(0, 5) === zip;
  const ok = complete && !unconfirmed && exactBuilding && numberOk && zipOk && Boolean(street && city && state && zip);
  if (ok) {
    return {
      ok: true,
      confidence: "MATCHED",
      ...suggested,
      formatted: formatAddress(suggested),
      message: "Google confirmed this exact building.",
      source: "google",
    };
  }
  return failed(input, "Google could not confirm that exact building. Pick a suggestion or fix the street number.", {
    confidence: complete ? "APPROXIMATE" : "UNCONFIRMED",
    suggestion: suggested,
  });
}

async function verifyWithGeocode(key: string, input: AddressInput): Promise<AddressResult> {
  const q = `${input.street}, ${input.city}, ${input.state} ${input.zip}`;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&region=us&key=${encodeURIComponent(key)}`,
    { cache: "no-store" }
  );
  const data = (await res.json()) as {
    status?: string;
    error_message?: string;
    results?: Array<{
      partial_match?: boolean;
      types?: string[];
      formatted_address?: string;
      geometry?: { location_type?: string };
      address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
    }>;
  };
  if (data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") {
    return failed(
      input,
      data.error_message ||
        "Google rejected the Maps key. Enable Geocoding API (and Address Validation if you use it) for this key."
    );
  }
  if (data.status !== "OK" || !data.results?.[0]) {
    return failed(input, "Google found no match for that address. Check the street, city, state, and ZIP.");
  }
  const hit = data.results[0];
  const parts = hit.address_components || [];
  const street = clean([component(parts, "street_number"), component(parts, "route")].filter(Boolean).join(" "));
  const city = clean(component(parts, "locality") || component(parts, "sublocality") || component(parts, "postal_town"));
  const state = clean(component(parts, "administrative_area_level_1", true)).slice(0, 2).toUpperCase();
  const zip = clean(component(parts, "postal_code")).slice(0, 5);
  const suggested = {
    street: street || input.street,
    city: city || input.city,
    state: state || input.state,
    zip: zip || input.zip,
  };
  const rooftop = hit.geometry?.location_type === "ROOFTOP";
  const precise = (hit.types || []).some((t) => ["street_address", "premise", "subpremise"].includes(t));
  const numberOk = !houseNumber(input.street) || houseNumber(input.street) === houseNumber(suggested.street);
  const zipOk = input.zip.slice(0, 5) === suggested.zip;
  if (hit.partial_match || !rooftop || !precise || !numberOk || !zipOk) {
    return failed(input, "Google could not confirm that exact building. Use a Google suggestion or correct the number.", {
      confidence: rooftop ? "APPROXIMATE" : "UNCONFIRMED",
      suggestion: suggested,
    });
  }
  return {
    ok: true,
    confidence: "MATCHED",
    ...suggested,
    formatted: formatAddress(suggested),
    message: "Google confirmed this exact building.",
    source: "google",
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
    return failed(input, "Enter street, city, state, and ZIP, then verify.");
  }
  const key = await googleKey();
  if (!key) {
    return failed(input, "Add a Google Maps API key in Settings to verify addresses.");
  }
  try {
    const validation = await verifyWithAddressValidation(key, input);
    if (validation?.ok) return validation;
    const geocode = await verifyWithGeocode(key, input);
    if (geocode.ok) return geocode;
    if (geocode.message.includes("rejected the Maps key")) return geocode;
    return validation || geocode;
  } catch {
    return failed(input, "Google address lookup failed. Check the API key in Settings.");
  }
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
    for (const item of (data.suggestions || []).slice(0, 3)) {
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
      const street = clean(
        [component(place.addressComponents || [], "street_number"), component(place.addressComponents || [], "route")].filter(Boolean).join(" ")
      );
      if (!street) continue;
      out.push({
        street,
        city: component(place.addressComponents || [], "locality") || component(place.addressComponents || [], "sublocality"),
        state: component(place.addressComponents || [], "administrative_area_level_1", true),
        zip: component(place.addressComponents || [], "postal_code"),
        label: label || place.formattedAddress || street,
      });
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