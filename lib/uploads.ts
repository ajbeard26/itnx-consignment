import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";

const TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const PHOTO_HOSTS = [
  "lqdt1.com",
  "govdeals.com",
  "govdeals.ca",
  "liquidation.com",
];

export function text(value: FormDataEntryValue | null) {
  const v = String(value || "").trim();
  return v || null;
}

function sniffImage(bytes: Buffer): keyof typeof TYPES | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function hostAllowed(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return PHOTO_HOSTS.some((base) => host === base || host.endsWith(`.${base}`));
}

function isPrivateAddress(ip: string) {
  if (ip.includes(":")) {
    const x = ip.toLowerCase();
    return (
      x === "::1" ||
      x === "::" ||
      x.startsWith("fc") ||
      x.startsWith("fd") ||
      x.startsWith("fe80") ||
      x.startsWith("::ffff:")
    );
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  if (p[0] === 0 || p[0] === 10 || p[0] === 127) return true;
  if (p[0] === 169 && p[1] === 254) return true;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true;
  if (p[0] === 192 && p[1] === 168) return true;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true;
  return false;
}

async function publicHttpsUrl(raw: string) {
  let current: URL;
  try {
    current = new URL(raw);
  } catch {
    return null;
  }
  if (current.protocol !== "https:") return null;
  if (current.username || current.password) return null;
  if (!hostAllowed(current.hostname)) return null;
  if (isIP(current.hostname) && isPrivateAddress(current.hostname)) return null;
  try {
    const looked = await lookup(current.hostname, { all: true });
    if (!looked.length || looked.some((row) => isPrivateAddress(row.address))) return null;
  } catch {
    return null;
  }
  return current.toString();
}

async function fetchAllowedImage(url: string, hops = 0): Promise<Buffer | null> {
  const allowed = await publicHttpsUrl(url);
  if (!allowed || hops > 2) return null;
  const res = await fetch(allowed, {
    headers: { Accept: "image/jpeg,image/png,image/webp,image/gif" },
    cache: "no-store",
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
  });
  if (res.status >= 300 && res.status < 400) {
    const next = res.headers.get("location");
    if (!next) return null;
    try {
      return fetchAllowedImage(new URL(next, allowed).toString(), hops + 1);
    } catch {
      return null;
    }
  }
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > 6 * 1024 * 1024) return null;
  return bytes;
}

async function writePhoto(consignmentId: string, dir: string, bytes: Buffer) {
  const type = sniffImage(bytes);
  if (!type) return null;
  const name = `${randomBytes(8).toString("hex")}${TYPES[type]}`;
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${consignmentId}/${name}`;
}

export async function savePhotos(consignmentId: string, files: FormDataEntryValue[]) {
  const paths: string[] = [];
  const dir = path.join(process.cwd(), "public", "uploads", consignmentId);
  await mkdir(dir, { recursive: true });

  for (const entry of files) {
    if (!(entry instanceof File) || !entry.size || entry.size > 6 * 1024 * 1024) continue;
    const saved = await writePhoto(consignmentId, dir, Buffer.from(await entry.arrayBuffer()));
    if (saved) paths.push(saved);
    if (paths.length >= 8) break;
  }

  return paths;
}

export async function saveRemotePhotos(consignmentId: string, urls: string[]) {
  const paths: string[] = [];
  const dir = path.join(process.cwd(), "public", "uploads", consignmentId);
  await mkdir(dir, { recursive: true });

  for (const url of urls) {
    if (paths.length >= 8) break;
    try {
      const bytes = await fetchAllowedImage(url);
      if (!bytes) continue;
      const saved = await writePhoto(consignmentId, dir, bytes);
      if (saved) paths.push(saved);
    } catch {
      continue;
    }
  }

  return paths;
}

export async function removeLocalPhoto(filePath: string) {
  if (!filePath.startsWith("/uploads/") || filePath.includes("..")) return;
  const root = path.resolve(process.cwd(), "public", "uploads") + path.sep;
  const full = path.resolve(process.cwd(), "public", filePath.replace(/^\/+/, ""));
  if (full !== root.slice(0, -1) && !full.startsWith(root)) return;
  await unlink(full).catch(() => {});
}
