import { db } from "@/lib/db";

export type AddressInput = {
  street: string;
  city: string;
  state: string;
  zip: string;
};

export type AddressHint = AddressInput & { label: string; confirm?: boolean };

export type AddressResult = {
  ok: boolean;
  confidence: "MATCHED" | "APPROXIMATE" | "UNCONFIRMED";
  street: string;
  city: string;
  state: string;
  zip: string;
  formatted: string;
  message: string;
  source: "google" | "osm" | "census";
  suggestion?: AddressInput;
};

const OSM_UA = "ITNX-Consignment/1.0 (https://co.itnx.tech)";
const DEFAULT_STATE = "MI";
const STREET_SUFFIX =
  /^(st|street|rd|road|ave|avenue|dr|drive|ln|lane|blvd|boulevard|ct|court|cir|circle|way|hwy|highway|pkwy|parkway|trl|trail|pl|place|ter|terrace|pvt|private)$/i;
const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
  al: "AL",
  ak: "AK",
  az: "AZ",
  ar: "AR",
  ca: "CA",
  co: "CO",
  ct: "CT",
  de: "DE",
  fl: "FL",
  ga: "GA",
  hi: "HI",
  id: "ID",
  il: "IL",
  in: "IN",
  ia: "IA",
  ks: "KS",
  ky: "KY",
  la: "LA",
  me: "ME",
  md: "MD",
  ma: "MA",
  mi: "MI",
  mn: "MN",
  ms: "MS",
  mo: "MO",
  mt: "MT",
  ne: "NE",
  nv: "NV",
  nh: "NH",
  nj: "NJ",
  nm: "NM",
  ny: "NY",
  nc: "NC",
  nd: "ND",
  oh: "OH",
  ok: "OK",
  or: "OR",
  pa: "PA",
  ri: "RI",
  sc: "SC",
  sd: "SD",
  tn: "TN",
  tx: "TX",
  ut: "UT",
  vt: "VT",
  va: "VA",
  wa: "WA",
  wv: "WV",
  wi: "WI",
  wy: "WY",
  dc: "DC",
};

export function googleVerified(verified?: boolean | null, source?: string | null) {
  return Boolean(verified && (source === "google" || source === "osm" || source === "census"));
}

function clean(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function titleCase(value: string) {
  return clean(value)
    .toLowerCase()
    .replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
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

export function stateAbbr(value: string) {
  const v = clean(value);
  if (!v) return "";
  return STATE_NAMES[v.toLowerCase()] || (v.length === 2 ? v.toUpperCase() : "");
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
  const cityState = [a.city, a.state].filter(Boolean).join(", ");
  const line = [cityState, a.zip].filter(Boolean).join(" ");
  return [a.street, line].filter(Boolean).join(", ");
}

function parseLoose(raw: string): AddressInput {
  let q = clean(raw).replace(/[.]/g, " ").replace(/,/g, " ");
  let zip = "";
  let state = "";
  let city = "";
  const zipM = q.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  if (zipM) {
    zip = zipM[1];
    q = clean(q.slice(0, zipM.index));
  }
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const last3 = words.slice(-3).join(" ").toLowerCase();
    const last2 = words.slice(-2).join(" ").toLowerCase();
    const last = words[words.length - 1].toLowerCase();
    if (STATE_NAMES[last3] && words.length >= 4) {
      state = STATE_NAMES[last3];
      q = words.slice(0, -3).join(" ");
    } else if (STATE_NAMES[last2] && words.length >= 3) {
      state = STATE_NAMES[last2];
      q = words.slice(0, -2).join(" ");
    } else if (STATE_NAMES[last]) {
      state = STATE_NAMES[last];
      q = words.slice(0, -1).join(" ");
    }
  }
  const rest = q.split(/\s+/).filter(Boolean);
  if (state && rest.length >= 3 && /^\d/.test(rest[0]) && !STREET_SUFFIX.test(rest[rest.length - 1])) {
    city = rest[rest.length - 1];
    q = rest.slice(0, -1).join(" ");
  }
  return { street: clean(q), city: titleCase(city), state, zip };
}

function looksOneLine(street: string) {
  const parsed = parseLoose(street);
  return Boolean(parsed.state || parsed.zip || parsed.city);
}

export function normalizeAddress(raw: AddressInput): AddressInput {
  const parsed = looksOneLine(raw.street) ? parseLoose(raw.street) : { street: clean(raw.street), city: "", state: "", zip: "" };
  return {
    street: parsed.city && !clean(raw.city) ? parsed.street : clean(raw.street),
    city: clean(raw.city) || parsed.city,
    state: stateAbbr(raw.state) || parsed.state,
    zip: clean(raw.zip).replace(/[^\d-]/g, "").slice(0, 10) || parsed.zip,
  };
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
    source: "census",
    ...extra,
  };
}

function matched(source: AddressResult["source"], suggested: AddressInput, message = "Confirmed this mailing address."): AddressResult {
  return {
    ok: true,
    confidence: "MATCHED",
    ...suggested,
    formatted: formatAddress(suggested),
    message,
    source,
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
  if (!city || !state) return null;
  return {
    street: `${clean(addr.house_number)} ${clean(addr.road)}`,
    city,
    state,
    zip,
  };
}

async function nominatimSearch(params: Record<string, string>): Promise<NominatimHit[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "us");
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }
  const res = await fetch(url, {
    headers: { "User-Agent": OSM_UA, Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimHit[] | { value?: NominatimHit[] };
  return Array.isArray(data) ? data : data.value || [];
}

type CensusMatch = {
  matchedAddress?: string;
  addressComponents?: {
    zip?: string;
    city?: string;
    state?: string;
    streetName?: string;
    preType?: string;
    preDirection?: string;
    suffixType?: string;
    suffixDirection?: string;
    fromAddress?: string;
    toAddress?: string;
  };
};

function fromCensus(hit: CensusMatch, house: string): AddressInput | null {
  const c = hit.addressComponents;
  if (!c?.city || !c.state) return null;
  const street = [
    house || c.fromAddress,
    c.preDirection,
    c.preType,
    c.streetName,
    c.suffixType,
    c.suffixDirection,
  ]
    .map((part) => (part ? titleCase(part) : ""))
    .filter(Boolean)
    .join(" ");
  const zip = clean((c.zip || "").split("-")[0]).slice(0, 5);
  if (!street || zip.length < 5) return null;
  return {
    street,
    city: titleCase(c.city),
    state: stateAbbr(c.state),
    zip,
  };
}

async function censusLookup(input: AddressInput): Promise<AddressInput[]> {
  const line = [input.street, input.city, input.state, input.zip].filter(Boolean).join(", ");
  if (!houseNumber(input.street) || line.length < 8) return [];
  const urls = [
    `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(line)}&benchmark=Public_AR_Current&format=json`,
  ];
  if (input.city && input.state) {
    const structured = new URL("https://geocoding.geo.census.gov/geocoder/locations/address");
    structured.searchParams.set("street", input.street);
    structured.searchParams.set("city", input.city);
    structured.searchParams.set("state", input.state);
    if (input.zip.slice(0, 5).length === 5) structured.searchParams.set("zip", input.zip.slice(0, 5));
    structured.searchParams.set("benchmark", "Public_AR_Current");
    structured.searchParams.set("format", "json");
    urls.push(structured.toString());
  }
  const house = houseNumber(input.street);
  const out: AddressInput[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const data = (await res.json()) as { result?: { addressMatches?: CensusMatch[] } };
      for (const hit of data.result?.addressMatches || []) {
        const parsed = fromCensus(hit, house);
        if (!parsed) continue;
        const key = formatAddress(parsed).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(parsed);
      }
      if (out.length) break;
    } catch {
      // Try the next Census endpoint.
    }
  }
  return out;
}

async function verifyWithCensus(input: AddressInput): Promise<AddressResult> {
  const hits = await censusLookup(input);
  const samePlace = hits.find(
    (hit) =>
      houseNumber(hit.street) === houseNumber(input.street) &&
      hit.state === input.state &&
      citiesMatch(hit.city, input.city)
  );
  if (samePlace) {
    if (input.zip.length >= 5 && samePlace.zip !== input.zip.slice(0, 5)) {
      return failed(input, "That house is in this city, but the ZIP does not match. Use the suggested address.", {
        confidence: "APPROXIMATE",
        suggestion: samePlace,
        source: "census",
      });
    }
    return matched("census", samePlace);
  }
  const sameState = hits.find((hit) => houseNumber(hit.street) === houseNumber(input.street) && hit.state === input.state);
  if (sameState) {
    return failed(input, `That house number is in ${sameState.state}, but the city does not match. Use the suggested city.`, {
      confidence: "APPROXIMATE",
      suggestion: sameState,
      source: "census",
    });
  }
  if (hits[0]) {
    return failed(input, "Could not confirm that city and street together. Use the suggested address if it is yours.", {
      confidence: "APPROXIMATE",
      suggestion: hits[0],
      source: "census",
    });
  }
  return failed(input, "Could not confirm that mailing address. Check the street number, city, and ZIP.", { source: "census" });
}

async function verifyWithNominatim(input: AddressInput): Promise<AddressResult> {
  const structured = await nominatimSearch({
    street: input.street,
    city: input.city,
    state: input.state,
    postalcode: input.zip.slice(0, 5),
  });
  const free = await nominatimSearch({ q: formatAddress(input) });
  const hits = [...structured, ...free];
  for (const hit of hits) {
    const parsed = fromNominatim(hit, input.state);
    if (!parsed) continue;
    if (houseNumber(parsed.street) !== houseNumber(input.street)) continue;
    if (parsed.state !== input.state) continue;
    if (!citiesMatch(parsed.city, input.city)) continue;
    if (parsed.zip.length < 5) parsed.zip = input.zip.slice(0, 5);
    if (parsed.zip.length < 5) continue;
    return matched("osm", parsed);
  }
  return failed(input, "Could not confirm that exact building. Check the street number, city, and ZIP.", { source: "osm" });
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
  const numberOk = !houseNumber(input.street) || houseNumber(input.street) === houseNumber(street);
  const placeOk = citiesMatch(city, input.city) && state === input.state;
  const deliverable = ["Y", "S", "D"].includes(dpv) || ["PREMISE", "SUB_PREMISE", "RANGE"].includes(granularity);
  if (numberOk && placeOk && deliverable && zip.length === 5) {
    return matched("google", suggested);
  }
  return failed(input, "Could not confirm that exact building. Pick a suggestion or fix the street number.", {
    confidence: deliverable ? "APPROXIMATE" : "UNCONFIRMED",
    suggestion: suggested,
    source: "google",
  });
}

async function verifyWithGeocode(key: string, input: AddressInput): Promise<AddressResult> {
  const q = formatAddress(input);
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&components=${encodeURIComponent(`country:US|administrative_area:${input.state}`)}&region=us&key=${encodeURIComponent(key)}`,
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
    return failed(input, data.error_message || "Google Maps key was rejected.", { source: "google" });
  }
  if (data.status !== "OK" || !data.results?.[0]) {
    return failed(input, "No match for that address. Check the street, city, state, and ZIP.", { source: "google" });
  }
  const hit = data.results[0];
  const parts = hit.address_components || [];
  const street = clean([component(parts, "street_number"), component(parts, "route")].filter(Boolean).join(" "));
  const city = clean(component(parts, "locality") || component(parts, "sublocality") || component(parts, "postal_town") || component(parts, "neighborhood"));
  const state = clean(component(parts, "administrative_area_level_1", true)).slice(0, 2).toUpperCase();
  const zip = clean(component(parts, "postal_code")).slice(0, 5);
  const suggested = {
    street: street || input.street,
    city: city || input.city,
    state: state || input.state,
    zip: zip || input.zip,
  };
  const location = hit.geometry?.location_type || "";
  const numberOk = !houseNumber(input.street) || houseNumber(input.street) === houseNumber(suggested.street);
  const placeOk = citiesMatch(suggested.city, input.city) && suggested.state === input.state;
  const preciseEnough = ["ROOFTOP", "RANGE_INTERPOLATED"].includes(location) && Boolean(component(parts, "street_number"));
  if (numberOk && placeOk && preciseEnough && suggested.zip.length === 5) {
    return matched("google", suggested);
  }
  return failed(input, "Could not confirm that exact building. Use the suggested address or correct the number.", {
    confidence: preciseEnough ? "APPROXIMATE" : "UNCONFIRMED",
    suggestion: suggested,
    source: "google",
  });
}

export async function verifyAddress(raw: AddressInput): Promise<AddressResult> {
  const input = normalizeAddress(raw);
  if (!input.street || !input.city || !input.state) {
    return failed(input, "Enter street, city, and state, then verify.");
  }
  let key = "";
  try {
    key = await googleKey();
  } catch {
    key = "";
  }
  if (key) {
    try {
      const validation = await verifyWithAddressValidation(key, input);
      if (validation?.ok) return validation;
      const geocode = await verifyWithGeocode(key, input);
      if (geocode.ok) return geocode;
    } catch {
      // Fall through to Census / OSM.
    }
  }
  try {
    const census = await verifyWithCensus(input);
    if (census.ok || census.suggestion) return census;
  } catch {
    // OSM next.
  }
  try {
    return await verifyWithNominatim(input);
  } catch {
    return failed(input, "Address lookup failed. Try again in a moment.");
  }
}

function hintFrom(item: AddressInput, confirm = false): AddressHint {
  return { ...item, label: formatAddress(item), confirm };
}

async function photonSuggest(query: string, prefer: AddressInput): Promise<AddressHint[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "8");
  url.searchParams.set("lang", "en");
  if ((prefer.state || DEFAULT_STATE) === "MI") {
    url.searchParams.set("lat", "43.6");
    url.searchParams.set("lon", "-84.8");
  }
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
  const want = prefer.state || DEFAULT_STATE;
  const out: AddressHint[] = [];
  for (const item of data.features || []) {
    const p = item.properties || {};
    if ((p.countrycode || "").toLowerCase() !== "us") continue;
    const state = stateAbbr(p.state || "");
    if (state && state !== want) continue;
    const street = clean([p.housenumber, p.street || p.name].filter(Boolean).join(" "));
    const city = clean(p.city || "");
    const zip = clean((p.postcode || "").split("-")[0]).slice(0, 5);
    if (!p.housenumber || !street || !city || state.length !== 2 || zip.length < 5) continue;
    if (prefer.city && !citiesMatch(city, prefer.city)) continue;
    out.push(hintFrom({ street, city, state, zip }));
    if (out.length === 3) break;
  }
  return out;
}

export async function suggestAddresses(query: string, city = "", state = "", zip = "") {
  const q = clean(query);
  if (q.length < 4) return [] as AddressHint[];
  const prefer = normalizeAddress({ street: q, city, state, zip });
  const line = [prefer.street, prefer.city, prefer.state || DEFAULT_STATE, prefer.zip].filter(Boolean).join(" ");
  const out: AddressHint[] = [];
  const seen = new Set<string>();
  function add(items: AddressHint[]) {
    for (const item of items) {
      const key = item.label.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }
  try {
    if (houseNumber(prefer.street) && (prefer.city || prefer.state || q.split(/\s+/).length >= 3)) {
      const census = await censusLookup({
        street: prefer.street,
        city: prefer.city,
        state: prefer.state || DEFAULT_STATE,
        zip: prefer.zip,
      });
      add(
        census
          .filter((item) => !prefer.state || item.state === prefer.state)
          .map((item) => hintFrom(item, true))
      );
    }
  } catch {
    // Photon can still help in towns OSM knows.
  }
  if (out.length < 3) {
    try {
      add(await photonSuggest(line, { ...prefer, state: prefer.state || DEFAULT_STATE }));
    } catch {
      // Ignore suggestion failures.
    }
  }
  return out.slice(0, 3);
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
