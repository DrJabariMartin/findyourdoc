import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

// Verification documents live outside the public folder. In production, swap
// this for encrypted object storage covered by a business associate agreement.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function root() {
  return path.resolve(process.env.STORAGE_DIR ?? "./storage");
}

/** Checks the file's first bytes, not just the type the browser claims. */
export function sniffType(buf: Uint8Array): string | null {
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  return null;
}

export async function saveFile(buf: Uint8Array, mime: string): Promise<string> {
  const key = `${randomBytes(16).toString("hex")}.${ALLOWED_TYPES[mime]}`;
  await mkdir(root(), { recursive: true });
  await writeFile(path.join(root(), key), buf, { mode: 0o600 });
  return key;
}

export async function readStored(key: string): Promise<Buffer> {
  if (!/^[a-f0-9]{32}\.(pdf|jpg|png)$/.test(key)) throw new Error("bad key");
  return readFile(path.join(root(), key));
}
