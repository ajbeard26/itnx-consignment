import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

export function text(value: FormDataEntryValue | null) {
  const v = String(value || "").trim();
  return v || null;
}

async function writePhoto(consignmentId: string, dir: string, type: string, bytes: Buffer) {
  const ext = TYPES[type];
  if (!ext || bytes.length > 6 * 1024 * 1024) return null;
  const name = `${randomBytes(8).toString("hex")}${ext}`;
  await writeFile(path.join(dir, name), bytes);
  return `/uploads/${consignmentId}/${name}`;
}

export async function savePhotos(consignmentId: string, files: FormDataEntryValue[]) {
  const paths: string[] = [];
  const dir = path.join(process.cwd(), "public", "uploads", consignmentId);
  await mkdir(dir, { recursive: true });

  for (const entry of files) {
    if (!(entry instanceof File) || !entry.size) continue;
    const saved = await writePhoto(
      consignmentId,
      dir,
      entry.type,
      Buffer.from(await entry.arrayBuffer())
    );
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
    if (!/^https?:\/\//i.test(url) || paths.length >= 8) continue;
    try {
      const res = await fetch(url, {
        headers: { Accept: "image/*" },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      const header = res.headers.get("content-type")?.split(";")[0]?.trim() || "";
      const type =
        TYPES[header]
          ? header
          : /\.png(\?|$)/i.test(url)
            ? "image/png"
            : /\.webp(\?|$)/i.test(url)
              ? "image/webp"
              : /\.gif(\?|$)/i.test(url)
                ? "image/gif"
                : "image/jpeg";
      const bytes = Buffer.from(await res.arrayBuffer());
      const saved = await writePhoto(consignmentId, dir, type, bytes);
      if (saved) paths.push(saved);
    } catch {
      continue;
    }
  }

  return paths;
}

export async function removeLocalPhoto(filePath: string) {
  if (!filePath.startsWith("/uploads/")) return;
  const full = path.join(process.cwd(), "public", filePath.replace(/^\/+/, ""));
  const root = path.join(process.cwd(), "public", "uploads");
  if (!full.startsWith(root)) return;
  await unlink(full).catch(() => {});
}
