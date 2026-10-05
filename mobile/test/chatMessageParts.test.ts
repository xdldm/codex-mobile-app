import type { ChatMessagePart } from "../src/domain/bridge";
import { messageTextFromParts } from "../src/domain/chatMessageParts";

function textPart(id: string, text: string): ChatMessagePart {
  return { id, type: "text", text };
}

describe("messageTextFromParts", () => {
  it("joins the prose parts that the copy action puts on the clipboard", () => {
    expect(
      messageTextFromParts([
        textPart("a", "First paragraph."),
        textPart("b", "```ts\nconst x = 1;\n```")
      ])
    ).toBe("First paragraph.\n\n```ts\nconst x = 1;\n```");
  });

  it("skips tool activity and approval cards", () => {
    const parts: ChatMessagePart[] = [
      textPart("a", "Done."),
      {
        id: "b",
        type: "activity",
        title: "Ran npm test",
        status: "done",
        output: "35 passed"
      },
      {
        id: "c",
        type: "approval",
        status: "answered",
        decision: "accept",
        approval: { approval_id: "ap_1" }
      }
    ];

    expect(messageTextFromParts(parts)).toBe("Done.");
  });

  it("ignores empty and whitespace-only parts", () => {
    expect(messageTextFromParts([textPart("a", "  "), textPart("b", "Kept.")])).toBe("Kept.");
    expect(messageTextFromParts([])).toBe("");
  });
});
