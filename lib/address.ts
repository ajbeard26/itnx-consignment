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
  source: "google" | "osm";
  suggestion?: AddressInput;
};

const OSM_UA = "ITNX-Consignment/1.0 (https://co.itnx.tech)";

export function googleVerified(verified?: boolean | null, source?: string | null) {
  return Boolean(verified && (source === "google" || source === "osm"));
}

function clean(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function houseNumber(street: string) {
  const m = clean(street).match(/^(\d+[A-Za-z]?)/i);
  return (m?.[1] || "").toUpperCase();
}

function normCity(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/\b(township|charter township|city|village|boro|borough|town)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stateAbbr(value: string) {
  const v = clean(value);
  if (v.length === 2) return v.toUpperCase();
  const names: Record<string, string> = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
    colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
    hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
    kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD", massachusetts: "MA",
    michigan: "MI", minnesota: "MN", mississippi: "MS", missouri: "MO", montana: "MT",
    nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
    "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND",
    ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI",
    "south carolina": "SC", "south dakota": "SD", tennessee: "TN", texas: "TX",
    utah: "UT", vermont: "VT", virginia: "VA", washington: "WA", "west virginia": "WV",
    wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
  };
  return names[v.toLowerCase()] || "";
}

function citiesMatch(a: string, b: string) {
  const x = normCity(a);
  const y = normCity(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
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
    source: "osm",
    ...extra,
  };
}

type NominatimHit = {
  class?: string;
  type?: string;
  addresstype?: string;
  display_name?: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    municipality?: string;
    township?: string;
    county?: string;
    state?: string;
    "ISO3166-2-lvl4"?: string;
    postcode?: string;
  };
};

function fromNominatim(hit: NominatimHit, fallbackState: string): AddressInput | null {
  const addr = hit.address;
  if (!addr?.house_number || !addr.road) return null;
  const city = clean(addr.city || addr.town || addr.village || addr.hamlet || addr.municipality || addr.township || "");
  const iso = (addr["ISO3166-2-lvl4"] || "").split("-")[1] || "";
  const state = (iso || stateAbbr(addr.state || "") || fallbackState).slice(0, 2).toUpperCase();
  const zip = clean((addr.postcode || "").split("-")[0]).slice(0, 5);
  if (!city || !state || zip.length < 5) return null;
  return {
    street: `${clean(addr.house_number)} ${clean(addr.road)}`,
    city,
    state,
    zip,
  };
}

function isExactBuilding(hit: NominatimHit, input: AddressInput) {
  const parsed = fromNominatim(hit, input.state);
  if (!parsed) return false;
  if (["highway", "boundary", "place"].includes(hit.class || "") && hit.type !== "house") return false;
  if ((hit.addresstype || "") === "highway") return false;
  return houseNumber(parsed.street) === houseNumber(input.street);
}

async function nominatimSearch(params: Record<string, string>): Promise<NominatimHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, {
    headers: { "User-Agent": OSM_UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimHit[] | { value?: NominatimHit[] };
  return Array.isArray(data) ? data : data.value || [];
}

async function verifyWithNominatim(input: AddressInput): Promise<AddressResult> {
  const structured = await nominatimSearch({
    street: input.street,
    city: input.city,
    state: input.state,
    postalcode: input.zip.slice(0, 5),
  });
  const exact = structured.find((hit) => {
    const parsed = fromNominatim(hit, input.state);
    return Boolean(parsed && isExactBuilding(hit, input) && parsed.zip === input.zip.slice(0, 5) && citiesMatch(parsed.city, input.city));
  });
  if (exact) {
    const suggested = fromNominatim(exact, input.state)!;
    return {
      ok: true,
      confidence: "MATCHED",
      ...suggested,
      formatted: formatAddress(suggested),
      message: "Confirmed this exact building.",
      source: "osm",
    };
  }

  const loose = await nominatimSearch({
    street: input.street,
    state: input.state,
    postalcode: input.zip.slice(0, 5),
  });
  const nearby = loose
    .map((hit) => ({ hit, parsed: fromNominatim(hit, input.state) }))
    .find(({ hit, parsed }) => parsed && isExactBuilding(hit, input) && parsed.zip === input.zip.slice(0, 5));
  if (nearby?.parsed) {
    return failed(input, "That house number is in this ZIP, but the city does not match. Use the suggested address or correct the city.", {
      confidence: "APPROXIMATE",
      suggestion: nearby.parsed,
    });
  }

  return failed(input, "Could not confirm that exact building. Check the street number, city, and ZIP.");
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
        validationGranularity?: string;
      };
      address?: {
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
      message: "Confirmed this exact building.",
      source: "google",
    };
  }
  return failed(input, "Could not confirm that exact building. Pick a suggestion or fix the street number.", {
    confidence: complete ? "APPROXIMATE" : "UNCONFIRMED",
    suggestion: suggested,
    source: "google",
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
      geometry?: { location_type?: string };
      address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
    }>;
  };
  if (data.status === "REQUEST_DENIED" || data.status === "INVALID_REQUEST") {
    return failed(input, data.error_message || "Google Maps key was rejected.");
  }
  if (data.status !== "OK" || !data.results?.[0]) {
    return failed(input, "No match for that address. Check the street, city, state, and ZIP.", { source: "google" });
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
    return failed(input, "Could not confirm that exact building. Use the suggested address or correct the number.", {
      confidence: rooftop ? "APPROXIMATE" : "UNCONFIRMED",
      suggestion: suggested,
      source: "google",
    });
  }
  return {
    ok: true,
    confidence: "MATCHED",
    ...suggested,
    formatted: formatAddress(suggested),
    message: "Confirmed this exact building.",
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
  if (key) {
    try {
      const validation = await verifyWithAddressValidation(key, input);
      if (validation?.ok) return validation;
      const geocode = await verifyWithGeocode(key, input);
      if (geocode.ok) return geocode;
      if (!geocode.message.includes("rejected")) return validation || geocode;
    } catch {
      // Fall through to the no-key lookup.
    }
  }
  try {
    return await verifyWithNominatim(input);
  } catch {
    return failed(input, "Address lookup failed. Try again in a moment.");
  }
}

export async function suggestAddresses(query: string) {
  const q = clean(query);
  if (q.length < 4) return [] as Array<AddressInput & { label: string }>;
  try {
    const url = new URL("https://photon.komoot.io/api/");
    url.searchParams.set("q", q);
    url.searchParams.set("limit", "5");
    url.searchParams.set("lang", "en");
    const res = await fetch(url, {
      headers: { "User-Agent": OSM_UA, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      features?: Array<{
        properties?: {
          housenumber?: string;
          street?: string;
          name?: string;
          city?: string;
          state?: string;
          postcode?: string;
          countrycode?: string;
        };
      }>;
    };
    const out: Array<AddressInput & { label: string }> = [];
    for (const item of data.features || []) {
      const p = item.properties || {};
      if ((p.countrycode || "").toLowerCase() !== "us") continue;
      const street = clean([p.housenumber, p.street || p.name].filter(Boolean).join(" "));
      const city = clean(p.city || "");
      const state = stateAbbr(p.state || "");
      const zip = clean((p.postcode || "").split("-")[0]).slice(0, 5);
      if (!p.housenumber || !street || !city || state.length !== 2 || zip.length < 5) continue;
      out.push({
        street,
        city,
        state,
        zip,
        label: `${street}, ${city}, ${state} ${zip}`,
      });
      if (out.length === 3) break;
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
