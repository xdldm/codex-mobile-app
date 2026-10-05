import { attachmentInputItems, messageForDraft } from "../src/domain/attachments";
import type { UploadedAttachment } from "../src/domain/bridge";

function attachment(overrides: Partial<UploadedAttachment> = {}): UploadedAttachment {
  return {
    id: "upload-1",
    name: "screenshot.png",
    path: "/home/user/.codex-mobile/uploads/upload-1-screenshot.png",
    size: 2048,
    kind: "image",
    created_at: "2026-10-04T00:00:00.000Z",
    ...overrides
  };
}

describe("attachmentInputItems", () => {
  it("maps uploaded attachments to attachment input items", () => {
    expect(attachmentInputItems([attachment()])).toEqual([
      {
        type: "attachment",
        name: "screenshot.png",
        path: "/home/user/.codex-mobile/uploads/upload-1-screenshot.png"
      }
    ]);
  });

  it("returns an empty list when nothing is attached", () => {
    expect(attachmentInputItems([])).toEqual([]);
  });
});

describe("messageForDraft", () => {
  it("keeps the draft when the user typed something", () => {
    expect(messageForDraft("What is wrong here?", 1)).toBe("What is wrong here?");
  });

  it("falls back to a prompt when only attachments are present", () => {
    expect(messageForDraft("", 1)).toBe("Please review the attached file.");
    expect(messageForDraft("   ", 2)).toBe("Please review the attached files.");
  });

  it("does not invent a message without attachments", () => {
    expect(messageForDraft("", 0)).toBe("");
  });
});
