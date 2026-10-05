import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { AppError } from "../errors.js";

export type AttachmentKind = "image" | "file";

export type StoredAttachment = {
  id: string;
  name: string;
  path: string;
  size: number;
  kind: AttachmentKind;
  created_at: string;
};

export type ResolvedAttachment = {
  path: string;
  kind: AttachmentKind;
};

export type UploadInput = {
  name?: string | null;
  mimeType?: string | null;
  dataBase64: string;
};

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".heic",
  ".heif",
  ".tif",
  ".tiff"
]);

const MIME_EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/bmp": ".bmp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/tiff": ".tiff",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
  "text/markdown": ".md",
  "application/json": ".json",
  "application/zip": ".zip"
};

const FALLBACK_NAME = "attachment";
const MAX_NAME_LENGTH = 120;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

export class UploadService {
  constructor(private readonly options: { uploadDir: string; maxBytes: number }) {}

  get directory(): string {
    return path.resolve(this.options.uploadDir);
  }

  get maxBytes(): number {
    return this.options.maxBytes;
  }

  save(input: UploadInput): StoredAttachment {
    const decoded = decodeBase64(input.dataBase64, this.maxBytes);
    const name = withMimeExtension(sanitizeFileName(input.name), input.mimeType ?? null);
    const storedName = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}-${name}`;
    const directory = this.directory;

    fs.mkdirSync(directory, { recursive: true });
    const filePath = path.join(directory, storedName);
    fs.writeFileSync(filePath, decoded);

    return {
      id: storedName,
      name,
      path: filePath,
      size: decoded.byteLength,
      kind: detectKind(name),
      created_at: new Date().toISOString()
    };
  }

  /**
   * Resolves a client-supplied attachment path, but only when it points at a
   * regular file inside the upload directory. Everything else is rejected so a
   * caller cannot read arbitrary host files by tagging them as attachments.
   */
  resolveAttachment(candidatePath: string | null | undefined): ResolvedAttachment | null {
    if (!candidatePath) {
      return null;
    }

    const resolved = path.resolve(candidatePath);
    if (!this.contains(resolved)) {
      return null;
    }

    let stats: fs.Stats;
    try {
      stats = fs.statSync(resolved);
    } catch {
      return null;
    }

    if (!stats.isFile()) {
      return null;
    }

    return { path: resolved, kind: detectKind(path.basename(resolved)) };
  }

  contains(candidatePath: string): boolean {
    const relative = path.relative(this.directory, path.resolve(candidatePath));
    return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
  }
}

function decodeBase64(value: string, maxBytes: number): Buffer {
  const cleaned = value.replace(/\s+/g, "");
  if (cleaned.length === 0) {
    throw new AppError(400, "invalid_base64", "Attachment payload is empty.");
  }

  if (!BASE64_PATTERN.test(cleaned)) {
    throw new AppError(400, "invalid_base64", "Attachment payload must be base64 encoded.");
  }

  if (Math.floor((cleaned.length * 3) / 4) > maxBytes) {
    throw new AppError(
      413,
      "attachment_too_large",
      `Attachment exceeds the ${maxBytes} byte limit.`
    );
  }

  const decoded = Buffer.from(cleaned, "base64");
  if (decoded.byteLength === 0) {
    throw new AppError(400, "invalid_base64", "Attachment payload is empty.");
  }

  if (decoded.byteLength > maxBytes) {
    throw new AppError(
      413,
      "attachment_too_large",
      `Attachment exceeds the ${maxBytes} byte limit.`
    );
  }

  return decoded;
}

export function detectKind(fileName: string): AttachmentKind {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase()) ? "image" : "file";
}

function withMimeExtension(name: string, mimeType: string | null): string {
  if (path.extname(name)) {
    return name;
  }

  const extension = mimeType ? MIME_EXTENSIONS[mimeType.toLowerCase()] : undefined;
  return extension ? `${name}${extension}` : name;
}

function sanitizeFileName(value: string | null | undefined): string {
  const base = path.basename((value ?? "").replace(/\\/g, "/"));
  const cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\w.\- ()]/g, "_")
    .replace(/^[.\s]+/, "")
    .trim();

  const truncated = cleaned.slice(0, MAX_NAME_LENGTH);
  return truncated.length > 0 ? truncated : FALLBACK_NAME;
}
