import { firstString, stripHtml } from "@/lib/html";

const MAESTRO = "https://maestro.lqdt1.com";
const STOREFRONT_KEY = "af93060f-337e-428c-87b8-c74b5837d6cd";
const PHOTO_HOST = "https://webassets.lqdt1.com/assets";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export type ListingImport = {
  title: string;
  description: string;
  category: string;
  condition: string;
  serial: string;
  location: string;
  sale: string;
  listingUrl: string;
  platform: string;
  photoUrls: string[];
};

type ParsedListing = {
  assetId: string;
  accountId: string;
  auctionId?: string;
  listingUrl: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function moneyString(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Number.isInteger(value) && value >= 100 && value % 100 === 0 ? String(value) : value.toFixed(2);
  }
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return n.toFixed(2);
  }
  return "";
}

function pickMoney(data: Record<string, unknown>) {
  const keys = [
    "totalSoldAmount",
    "soldAmount",
    "soldPrice",
    "currentBid",
    "currentHighBid",
    "winningBid",
    "highBid",
    "finalPrice",
    "closePrice",
    "hammerPrice",
    "assetStrikePrice",
    "startingBid",
    "startPrice",
    "nextBid",
  ];
  const from = (rec: Record<string, unknown>) => {
    for (const key of keys) {
      const money = moneyString(rec[key]);
      if (money) return money;
    }
    return "";
  };
  const direct = from(data);
  if (direct) return direct;
  for (const value of Object.values(data)) {
    const rec = asRecord(value);
    if (!rec) continue;
    const nested = from(rec);
    if (nested) return nested;
  }
  return "";
}

function photoFrom(value: unknown): string | null {
  if (typeof value === "string" && /^https?:\/\//i.test(value) && !/placeholder|spacer|blank/i.test(value)) {
    return value.replace(/&amp;/g, "&");
  }
  const rec = asRecord(value);
  if (!rec) return null;
  return (
    photoFrom(rec.url) ||
    photoFrom(rec.photoUrl) ||
    photoFrom(rec.imageUrl) ||
    photoFrom(rec.largeUrl) ||
    photoFrom(rec.mediumUrl) ||
    photoFrom(rec.hiResUrl) ||
    photoFrom(rec.fileUrl) ||
    null
  );
}

function looksLikePhotoFile(value: string) {
  return /\.(jpe?g|png|webp)(?:$|\?)/i.test(value) || /^\d+_\d+_[0-9a-f-]{8,}/i.test(value);
}

function collectPhotos(data: Record<string, unknown>, accountId: string, assetId: string) {
  const out: string[] = [];
  const seen = new Set<string>();
  const folders = Array.from(new Set([accountId, assetId, String(data.accountId || ""), String(data.assetId || "")])).filter(Boolean);

  const push = (url: string) => {
    const clean = url.replace(/&amp;/g, "&").split("&w=")[0].split("&h=")[0];
    if (!/^https?:\/\//i.test(clean) || seen.has(clean) || /placeholder|logo|icon|sprite/i.test(clean)) return;
    seen.add(clean);
    out.push(clean);
  };

  const walk = (value: unknown, depth: number) => {
    if (depth > 8 || out.length >= 8) return;
    if (typeof value === "string") {
      const url = photoFrom(value);
      if (url && /webassets\.lqdt1\.com|govdeals\.com\/.*\.(jpe?g|png|webp)/i.test(url)) {
        push(url);
        return;
      }
      if (looksLikePhotoFile(value) && !/^https?:\/\//i.test(value)) {
        for (const folder of folders) {
          push(`${PHOTO_HOST}/photos/${folder}/${value}`);
          if (out.length >= 8) return;
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const rec = asRecord(value);
    if (!rec) return;
    const file = firstString(rec.photo, rec.photoFileName, rec.fileName, rec.image);
    if (file && looksLikePhotoFile(file) && !/^https?:\/\//i.test(file)) {
      const folder = firstString(rec.accountId, rec.acctId) || folders[0];
      if (folder) push(`${PHOTO_HOST}/photos/${folder}/${file}`);
    }
    for (const nested of Object.values(rec)) walk(nested, depth + 1);
  };

  walk(data, 0);
  return out.slice(0, 8);
}

export function parseGovDealsUrl(raw: string): ParsedListing | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host !== "govdeals.com" && !host.endsWith(".govdeals.com")) return null;

  const listingUrl = url.toString();
  const itemid = url.searchParams.get("itemid") || url.searchParams.get("itemId");
  const acctid = url.searchParams.get("acctid") || url.searchParams.get("acctId") || url.searchParams.get("accountid");
  const auctionid = url.searchParams.get("auctionid") || url.searchParams.get("auctionId") || undefined;
  if (itemid && acctid) {
    return { assetId: itemid.replace(/\D/g, ""), accountId: acctid.replace(/\D/g, ""), auctionId: auctionid, listingUrl };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const assetIdx = parts.findIndex((part) => part.toLowerCase() === "asset");
  if (assetIdx >= 0 && parts[assetIdx + 1] && parts[assetIdx + 2]) {
    const a = parts[assetIdx + 1].replace(/\D/g, "");
    const b = parts[assetIdx + 2].replace(/\D/g, "");
    if (!a || !b) return null;
    // Current storefront: /asset/{accountId}/{assetId} and /en/asset/{accountId}/{assetId}
    return { accountId: a, assetId: b, auctionId: auctionid, listingUrl };
  }
  return null;
}

function canonicalListingUrl(accountId: string, assetId: string, fallback: string) {
  if (!accountId || !assetId) return fallback;
  return `https://www.govdeals.com/en/asset/${accountId}/${assetId}`;
}

function maestroHeaders(referer: string) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": STOREFRONT_KEY,
    "x-user-id": "-1",
    "x-api-correlation-id": crypto.randomUUID(),
    "x-page-unique-id": crypto.randomUUID(),
    "x-user-timezone": "America/New_York",
    "x-referer": encodeURI(referer),
    "User-Agent": BROWSER_UA,
    Origin: "https://www.govdeals.com",
    Referer: "https://www.govdeals.com/",
  };
}

async function maestro<T>(path: string, body: Record<string, unknown> | null, referer: string): Promise<T | null> {
  try {
    const res = await fetch(`${MAESTRO}${path}`, {
      method: body ? "POST" : "GET",
      headers: maestroHeaders(referer),
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function searchRows(assetId: string, accountId: string, referer: string) {
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const accountNum = Number(accountId);
  for (const extra of [{ isQAL: true }, { isQAL: false }]) {
    const data = await maestro<Record<string, unknown>>(
      "/search/list",
      {
        categoryIds: "",
        businessId: "GD",
        searchText: assetId,
        page: 1,
        displayRows: 10,
        sortField: "bestfit",
        sortOrder: "desc",
        requestType: "",
        responseStyle: "",
        facets: [],
        facetsFilter: "",
        ...(Number.isFinite(accountNum) ? { accountIds: [accountNum] } : {}),
        ...extra,
      },
      referer
    );
    for (const row of asList(data?.assetSearchResults).map(asRecord)) {
      if (!row) continue;
      const key = `${row.assetId}-${row.accountId}-${row.auctionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}

function looksLikeSerial(value: string) {
  const serial = value.trim();
  if (serial.length < 4 || serial.length > 40 || !/\d/.test(serial)) return false;
  return !/^(shown|see|none|unknown|n\/a|na|tbd|photo|photos|label)$/i.test(serial);
}

function serialFromText(text: string) {
  const labeled = text.match(/(?:serial(?:\s*(?:number|#|no\.?))?|vin)\s*[:#]?\s*([A-Z0-9-]{5,})/i);
  const value = labeled?.[1] || "";
  return looksLikeSerial(value) ? value : "";
}

function pickSerial(data: Record<string, unknown>, nested: Record<string, unknown>[], description: string) {
  const candidates = [
    data.vinserial,
    data.vin,
    data.vinNumber,
    data.serialNumber,
    data.serial,
    data.assetSerial,
    data.inventoryId,
    data.serialNo,
    ...nested.flatMap((row) => [row.vinserial, row.serialNumber, row.vin]),
  ];
  for (const candidate of candidates) {
    const value = firstString(candidate);
    if (value && looksLikeSerial(value)) return value;
  }
  return serialFromText(description);
}

function mapAsset(data: Record<string, unknown>, listingUrl: string, accountId: string, assetId: string): ListingImport {
  const nested = [asRecord(data.assetBidBoxModel), asRecord(data.assetModel)].filter(Boolean) as Record<string, unknown>[];
  const city = firstString(data.city, data.locationCity, data.warehouseCity, ...nested.map((row) => row.city));
  const state = firstString(
    data.state,
    data.stateDesc,
    data.stateDescription,
    data.locationState,
    data.warehouseState,
    ...nested.map((row) => row.stateDesc || row.state)
  );
  const zip = firstString(data.zip, data.locationZip, data.postalCode, ...nested.map((row) => row.zip || row.postalCode));
  const address = firstString(
    data.addressLine1,
    data.address,
    data.locationAddress,
    data.warehouseAddress,
    data.address1,
    ...nested.map((row) => row.addressLine1 || row.address)
  );
  const location = [address, city, state, zip].filter(Boolean).join(", ");
  const year = firstString(data.modelYear, data.year);
  const make = firstString(data.make, data.makeBrand, data.brand);
  const model = firstString(data.model);
  const title =
    firstString(data.assetShortDesc, data.assetShortDescription, data.title, data.description) ||
    [year, make, model].filter(Boolean).join(" ");
  const description = firstString(
    data.assetLongDesc,
    data.assetLongDescription,
    data.longDescription,
    data.description,
    data.assetShortDesc
  );
  const condition = firstString(data.condition, data.assetCondition, data.conditionDesc, data.conditionDescription);
  const serial = pickSerial(data, nested, description);
  const category = firstString(data.category, data.categoryDescription, data.categoryName, data.classDescription);
  const sale = pickMoney(data) || nested.map(pickMoney).find(Boolean) || "";

  return {
    title: title.slice(0, 180),
    description,
    category,
    condition,
    serial,
    location,
    sale,
    listingUrl,
    platform: "GovDeals",
    photoUrls: collectPhotos(data, accountId, assetId),
  };
}

async function getAsset(accountId: string, assetId: string, referer: string) {
  const paths = [`/assets/${accountId}/${assetId}/false`, `/assets/${assetId}/${accountId}/false`];
  const bodies = [{ businessId: "GD", siteId: "1" }, { businessId: "GD" }];
  for (const path of paths) {
    for (const body of bodies) {
      const data = asRecord(await maestro<Record<string, unknown>>(path, body, referer));
      if (!data) continue;
      const asset = asRecord(data.asset) || asRecord(data.Asset) || data;
      if (firstString(asset.assetShortDesc, asset.assetShortDescription, asset.title)) return asset;
    }
  }
  return null;
}

async function getBidBox(assetId: string, accountId: string, auctionId: string, referer: string) {
  const auctions = Array.from(new Set([auctionId, "1", "0"].filter(Boolean)));
  const orders: Array<[string, string]> = [
    [assetId, accountId],
    [accountId, assetId],
  ];
  for (const [first, second] of orders) {
    for (const auction of auctions) {
      const data = asRecord(
        await maestro<Record<string, unknown>>(`/bids/bidbox/GD/${first}/${second}/${auction}`, null, referer)
      );
      if (data && (pickMoney(data) || firstString(data.assetShortDesc))) return data;
    }
  }
  return null;
}

function metaContent(html: string, key: string) {
  const a = html.match(new RegExp(`(?:property|name)=["']${key}["'][^>]*content=["']([^"']+)["']`, "i"));
  const b = html.match(new RegExp(`content=["']([^"']+)["'][^>]*(?:property|name)=["']${key}["']`, "i"));
  return stripHtml(decodeHtml(a?.[1] || b?.[1] || ""));
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchText(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.govdeals.com/",
      },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function listingFromHtml(html: string, listingUrl: string): ListingImport | null {
  if (!html || html.length < 400) return null;
  const title = (
    metaContent(html, "og:title") ||
    metaContent(html, "twitter:title") ||
    stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "") ||
    stripHtml(html.match(/<title>([^<]+)<\/title>/i)?.[1] || "")
  )
    .replace(/\s*[|\-–]\s*GovDeals.*$/i, "")
    .trim();
  if (!title || title.length < 8 || /^(home|govdeals|loading|untitled|govdeals.com)$/i.test(title)) return null;

  const photos: string[] = [];
  const seen = new Set<string>();
  const ogImage = metaContent(html, "og:image") || metaContent(html, "twitter:image");
  const push = (value: string) => {
    const url = value.replace(/&amp;/g, "&");
    if (!/^https?:\/\//i.test(url) || seen.has(url) || /placeholder|logo|icon|sprite/i.test(url)) return;
    seen.add(url);
    photos.push(url);
  };
  if (ogImage) push(ogImage);
  for (const match of html.matchAll(/https?:\/\/webassets\.lqdt1\.com\/[^\s"'<>]+/gi)) {
    push(match[0]);
    if (photos.length >= 8) break;
  }

  return {
    title: title.slice(0, 180),
    description: metaContent(html, "og:description") || metaContent(html, "description"),
    category: "",
    condition: "",
    serial: "",
    location: "",
    sale: "",
    listingUrl,
    platform: "GovDeals",
    photoUrls: photos.slice(0, 8),
  };
}

async function scrapeListing(parsed: ParsedListing) {
  const urls = [
    canonicalListingUrl(parsed.accountId, parsed.assetId, parsed.listingUrl),
    `https://www.govdeals.com/asset/${parsed.accountId}/${parsed.assetId}`,
    `https://www.govdeals.com/index.cfm?fa=Main.Item&itemid=${parsed.assetId}&acctid=${parsed.accountId}`,
    parsed.listingUrl,
  ];
  for (const url of urls) {
    const mapped = listingFromHtml(await fetchText(url), parsed.listingUrl);
    if (mapped?.title) return mapped;
  }
  return null;
}

export async function importGovDealsListing(rawUrl: string): Promise<ListingImport> {
  const parsed = parseGovDealsUrl(rawUrl);
  if (!parsed) {
    throw new Error("Paste a GovDeals listing URL, like https://www.govdeals.com/asset/4/32423");
  }

  const listingUrl = canonicalListingUrl(parsed.accountId, parsed.assetId, parsed.listingUrl);
  const pairs: Array<[string, string]> = [
    [parsed.accountId, parsed.assetId],
    [parsed.assetId, parsed.accountId],
  ];

  for (const [accountId, assetId] of pairs) {
    const asset = await getAsset(accountId, assetId, listingUrl);
    if (!asset) continue;
    const auctionId = firstString(asset.auctionId, asset.auctionID, parsed.auctionId);
    const bidbox = await getBidBox(assetId, accountId, auctionId, listingUrl);
    const merged = bidbox ? { ...asset, ...bidbox, assetPhotos: asset.assetPhotos || bidbox.assetPhotos } : asset;
    const mapped = mapAsset(merged, listingUrl, accountId, assetId);
    if (mapped.title) {
      return {
        ...mapped,
        sale: mapped.sale || (bidbox ? pickMoney(bidbox) : ""),
        serial: mapped.serial || (bidbox && looksLikeSerial(firstString(bidbox.vinserial, bidbox.serialNumber))
          ? firstString(bidbox.vinserial, bidbox.serialNumber)
          : ""),
        photoUrls: mapped.photoUrls.length ? mapped.photoUrls : collectPhotos(asset, accountId, assetId),
      };
    }
  }

  for (const [accountId, assetId] of pairs) {
    const rows = await searchRows(assetId, accountId, listingUrl);
    const match =
      rows.find((row) => String(row.assetId) === assetId && String(row.accountId) === accountId) ||
      rows.find((row) => String(row.assetId) === assetId || String(row.accountId) === assetId) ||
      rows[0];
    if (!match) continue;
    const mapped = mapAsset(match, listingUrl, accountId, assetId);
    if (mapped.title) return mapped;
  }

  const scraped = await scrapeListing(parsed);
  if (scraped) return { ...scraped, listingUrl };

  throw new Error("Could not load that GovDeals listing. Check the URL, or fill the item in by hand.");
}
