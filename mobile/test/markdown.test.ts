import { parseMarkdown } from "../src/utils/markdown";

describe("markdown parser", () => {
  it("parses headings and inline formatting", () => {
    expect(parseMarkdown("# Title\nText with **bold**, *emphasis*, `code`, and [link](https://example.com).")).toEqual([
      {
        type: "heading",
        level: 1,
        children: [{ type: "text", text: "Title" }]
      },
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Text with " },
          { type: "strong", children: [{ type: "text", text: "bold" }] },
          { type: "text", text: ", " },
          { type: "emphasis", children: [{ type: "text", text: "emphasis" }] },
          { type: "text", text: ", " },
          { type: "code", text: "code" },
          { type: "text", text: ", and " },
          { type: "link", href: "https://example.com", children: [{ type: "text", text: "link" }] },
          { type: "text", text: "." }
        ]
      }
    ]);
  });

  it("parses lists and fenced code blocks", () => {
    expect(parseMarkdown("- First\n- Second\n\n```ts\nconst ok = true;\n```")).toEqual([
      {
        type: "list",
        ordered: false,
        items: [
          [{ type: "text", text: "First" }],
          [{ type: "text", text: "Second" }]
        ]
      },
      {
        type: "code",
        language: "ts",
        text: "const ok = true;"
      }
    ]);
  });

  it("links bare URLs in prose", () => {
    expect(parseMarkdown("See https://example.com/a_b for details.")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "See " },
          {
            type: "link",
            href: "https://example.com/a_b",
            children: [{ type: "text", text: "https://example.com/a_b" }]
          },
          { type: "text", text: " for details." }
        ]
      }
    ]);
  });

  it("keeps trailing punctuation outside a bare URL", () => {
    expect(parseMarkdown("Open (https://example.com/docs), then https://example.com.")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Open (" },
          {
            type: "link",
            href: "https://example.com/docs",
            children: [{ type: "text", text: "https://example.com/docs" }]
          },
          { type: "text", text: "), then " },
          {
            type: "link",
            href: "https://example.com",
            children: [{ type: "text", text: "https://example.com" }]
          },
          { type: "text", text: "." }
        ]
      }
    ]);
  });

  it("keeps parentheses that belong to the URL", () => {
    expect(parseMarkdown("https://en.wikipedia.org/wiki/Foo_(bar)")).toEqual([
      {
        type: "paragraph",
        children: [
          {
            type: "link",
            href: "https://en.wikipedia.org/wiki/Foo_(bar)",
            children: [{ type: "text", text: "https://en.wikipedia.org/wiki/Foo_(bar)" }]
          }
        ]
      }
    ]);
  });

  it("defaults www hosts to https and strips angle brackets", () => {
    expect(parseMarkdown("Try <www.example.com> now.")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Try " },
          {
            type: "link",
            href: "https://www.example.com",
            children: [{ type: "text", text: "www.example.com" }]
          },
          { type: "text", text: " now." }
        ]
      }
    ]);
  });

  it("does not autolink inside inline code", () => {
    expect(parseMarkdown("Use `curl https://example.com` here.")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Use " },
          { type: "code", text: "curl https://example.com" },
          { type: "text", text: " here." }
        ]
      }
    ]);
  });
});
