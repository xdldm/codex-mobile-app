import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { UploadService } from "../src/uploads/UploadService.js";

describe("UploadService", () => {
  let uploadDir: string;
  let service: UploadService;

  beforeEach(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-upload-test-"));
    service = new UploadService({ uploadDir, maxBytes: 1024 });
  });

  it("stores an uploaded file and reports its metadata", () => {
    const attachment = service.save({
      name: "screenshot.png",
      mimeType: "image/png",
      dataBase64: Buffer.from("fake-png-bytes").toString("base64")
    });

    expect(attachment.kind).toBe("image");
    expect(attachment.name).toBe("screenshot.png");
    expect(attachment.size).toBe(14);
    expect(fs.readFileSync(attachment.path, "utf8")).toBe("fake-png-bytes");
    expect(path.dirname(attachment.path)).toBe(path.resolve(uploadDir));
  });

  it("strips directory components and unsafe characters from names", () => {
    const attachment = service.save({
      name: "../../etc/pa$$wd",
      dataBase64: Buffer.from("x").toString("base64")
    });

    expect(attachment.name).toBe("pa__wd");
    expect(attachment.path.startsWith(`${path.resolve(uploadDir)}${path.sep}`)).toBe(true);
  });

  it("falls back to a default name and keeps the mime extension", () => {
    const attachment = service.save({
      name: "..",
      mimeType: "image/jpeg",
      dataBase64: Buffer.from("x").toString("base64")
    });

    expect(attachment.name).toBe("attachment.jpg");
    expect(attachment.kind).toBe("image");
  });

  it("rejects payloads that exceed the configured limit", () => {
    expect(() =>
      service.save({
        name: "big.bin",
        dataBase64: Buffer.alloc(2048).toString("base64")
      })
    ).toThrow(/exceeds the 1024 byte limit/);
  });

  it("rejects payloads that are not base64", () => {
    expect(() => service.save({ name: "notes.txt", dataBase64: "not base64!!" })).toThrow(
      /base64 encoded/
    );
  });

  it("rejects empty payloads", () => {
    expect(() => service.save({ name: "notes.txt", dataBase64: "   " })).toThrow(
      /payload is empty/
    );
  });

  describe("resolveAttachment", () => {
    it("resolves files inside the upload directory", () => {
      const attachment = service.save({
        name: "notes.txt",
        dataBase64: Buffer.from("hello").toString("base64")
      });

      expect(service.resolveAttachment(attachment.path)).toEqual({
        path: attachment.path,
        kind: "file"
      });
    });

    it("refuses paths outside the upload directory", () => {
      expect(service.resolveAttachment("/etc/passwd")).toBeNull();
      expect(service.resolveAttachment(path.join(uploadDir, "..", "escape.txt"))).toBeNull();
    });

    it("refuses directories and missing files", () => {
      expect(service.resolveAttachment(uploadDir)).toBeNull();
      expect(service.resolveAttachment(path.join(uploadDir, "missing.txt"))).toBeNull();
      expect(service.resolveAttachment(null)).toBeNull();
    });
  });
});
