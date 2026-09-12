import { firstString } from "@/lib/html";

const MAESTRO = "https://maestro.lqdt1.com";
// Public anonymous key shipped in the GovDeals storefront JS (same one every browser uses).
const STOREFRONT_KEY = "af93060f-337e-428c-87b8-c74b5837d6cd";

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
    return value >= 100 && Number.isInteger(value) && value % 100 === 0
      ? String(value)
      : value.toFixed(2);
  }
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0) return n.toFixed(2);
  }
  return "";
}

function photoFrom(value: unknown): string | null {
  if (typeof value === "string" && /^https?:\/\//i.test(value) && !value.includes("placeholder")) return value;
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

function collectPhotos(data: Record<string, unknown>) {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (value: unknown) => {
    const url = photoFrom(value);
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push(url);
  };

  for (const key of [
    "photos",
    "images",
    "assetImages",
    "assetPhotos",
    "photoUrls",
    "imageList",
    "media",
    "pictureList",
  ]) {
    asList(data[key]).forEach(push);
    push(data[key]);
  }
  push(data.photoUrl);
  push(data.imageUrl);
  push(data.image);
  push(data.primaryImageUrl);
  return out.slice(0, 8);
}

export function parseGovDealsUrl(raw: string): ParsedListing | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!url.hostname.toLowerCase().includes("govdeals")) {
    return null;
  }

  const listingUrl = url.toString();
  const itemid = url.searchParams.get("itemid") || url.searchParams.get("itemId");
  const acctid = url.searchParams.get("acctid") || url.searchParams.get("acctId") || url.searchParams.get("accountid");
  const auctionid = url.searchParams.get("auctionid") || url.searchParams.get("auctionId") || undefined;
  if (itemid && acctid) {
    return { assetId: itemid, accountId: acctid, auctionId: auctionid, listingUrl };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const assetIdx = parts.findIndex((part) => part.toLowerCase() === "asset");
  if (assetIdx >= 0 && parts[assetIdx + 1] && parts[assetIdx + 2]) {
    const a = parts[assetIdx + 1].replace(/\D/g, "");
    const b = parts[assetIdx + 2].replace(/\D/g, "");
    if (!a || !b) return null;
    // /en/asset/{accountId}/{assetId} vs /asset/{assetId}/{accountId}
    const english = parts[assetIdx - 1]?.toLowerCase() === "en";
    return english
      ? { accountId: a, assetId: b, auctionId: auctionid, listingUrl }
      : { assetId: a, accountId: b, auctionId: auctionid, listingUrl };
  }
  return null;
}

async function maestro<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`${MAESTRO}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": STOREFRONT_KEY,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function lookupAuction(parsed: ParsedListing) {
  if (parsed.auctionId) return parsed.auctionId;
  const body = {
    categoryIds: "",
    businessId: "GD",
    searchText: parsed.assetId,
    isQAL: true,
    page: 1,
    displayRows: 10,
    sortField: "bestfit",
    sortOrder: "desc",
    requestType: "",
    responseStyle: "",
    facets: [] as string[],
    facetsFilter: "",
    accountIds: parsed.accountId,
  };
  const data = await maestro<Record<string, unknown>>("/search/list", body);
  const rows = asList(data?.assetSearchResults).map(asRecord).filter(Boolean) as Record<string, unknown>[];
  const match =
    rows.find(
      (row) =>
        String(row.assetId) === parsed.assetId && String(row.accountId) === parsed.accountId
    ) ||
    rows.find((row) => String(row.assetId) === parsed.assetId) ||
    rows[0];
  const auctionId = firstString(match?.auctionId, match?.auctionID);
  return auctionId || "1";
}

function mapAsset(data: Record<string, unknown>, listingUrl: string): ListingImport {
  const city = firstString(data.city, data.locationCity, data.warehouseCity);
  const state = firstString(data.state, data.locationState, data.warehouseState);
  const zip = firstString(data.zip, data.locationZip, data.postalCode);
  const address = firstString(data.address, data.locationAddress, data.warehouseAddress);
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
  const sale = moneyString(
    data.currentHighBid ??
      data.currentBid ??
      data.soldPrice ??
      data.winningBid ??
      data.highBid ??
      data.startingBid ??
      data.startPrice
  );
  const condition = firstString(data.condition, data.assetCondition, data.conditionDesc, data.conditionDescription);
  const serial = firstString(data.vin, data.vinNumber, data.serialNumber, data.serial, data.assetSerial, data.inventoryId);
  const category = firstString(data.category, data.categoryDescription, data.categoryName, data.classDescription);

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
    photoUrls: collectPhotos(data),
  };
}

async function getAsset(assetId: string, accountId: string, auctionId: string) {
  for (const body of [{ businessId: "GD", siteId: "1" }, { businessId: "GD" }]) {
    const data = asRecord(await maestro<Record<string, unknown>>(`/assets/${assetId}/${accountId}/${auctionId}`, body));
    if (!data) continue;
    return asRecord(data.asset) || asRecord(data.Asset) || data;
  }
  return null;
}

export async function importGovDealsListing(rawUrl: string): Promise<ListingImport> {
  const parsed = parseGovDealsUrl(rawUrl);
  if (!parsed) {
    throw new Error("Paste a GovDeals listing URL, like https://www.govdeals.com/asset/123/456");
  }

  const attempts: Array<[string, string]> = [
    [parsed.assetId, parsed.accountId],
    [parsed.accountId, parsed.assetId],
  ];

  for (const [assetId, accountId] of attempts) {
    const auctionId = await lookupAuction({ ...parsed, assetId, accountId });
    const ids = Array.from(new Set([auctionId, parsed.auctionId, "1", "2", "3"].filter(Boolean))) as string[];
    for (const auction of ids) {
      const asset = await getAsset(assetId, accountId, auction);
      if (!asset) continue;
      const mapped = mapAsset(asset, parsed.listingUrl);
      if (mapped.title) return mapped;
    }
  }

  const search = await maestro<Record<string, unknown>>("/search/list", {
    categoryIds: "",
    businessId: "GD",
    searchText: parsed.assetId,
    isQAL: true,
    page: 1,
    displayRows: 5,
    sortField: "bestfit",
    sortOrder: "desc",
    facets: [],
    facetsFilter: "",
  });
  const row = asList(search?.assetSearchResults).map(asRecord).find(Boolean);
  if (row) {
    const mapped = mapAsset(row, parsed.listingUrl);
    if (mapped.title) return mapped;
  }

  throw new Error("Could not load that GovDeals listing. Check the URL, or fill the item in by hand.");
}