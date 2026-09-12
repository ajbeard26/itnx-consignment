import { mkdir, writeFile } from "fs/promises";
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

export async function savePhotos(consignmentId: string, files: FormDataEntryValue[]) {
  const paths: string[] = [];
  const dir = path.join(process.cwd(), "public", "uploads", consignmentId);
  await mkdir(dir, { recursive: true });

  for (const entry of files) {
    if (!(entry instanceof File) || !entry.size) continue;
    const ext = TYPES[entry.type];
    if (!ext || entry.size > 6 * 1024 * 1024) continue;
    const name = `${randomBytes(8).toString("hex")}${ext}`;
    await writeFile(path.join(dir, name), Buffer.from(await entry.arrayBuffer()));
    paths.push(`/uploads/${consignmentId}/${name}`);
    if (paths.length >= 8) break;
  }

  return paths;
}
