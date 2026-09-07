import { describe, expect, it } from "vitest";
import {
  filesFromClipboard,
  mergeAttachments,
  pathsFromClipboard,
} from "./attachments";
import type { Attachment } from "./session";

function file(name: string, type: string, body = "x") {
  return new File([body], name, { type });
}

function item(next: File): {
  kind: string;
  type: string;
  getAsFile: () => File | null;
} {
  return {
    kind: "file",
    type: next.type,
    getAsFile: () => next,
  };
}

function attachment(
  partial: Partial<Attachment> & Pick<Attachment, "id" | "name">,
): Attachment {
  return {
    mimeType: "image/png",
    kind: "image",
    size: 4,
    ...partial,
  };
}

describe("mergeAttachments", () => {
  it("does not exceed the attachment limit when already full", () => {
    const existing = Array.from({ length: 20 }, (_, i) =>
      attachment({ id: String(i), name: `${i}.png` }),
    );
    expect(
      mergeAttachments(existing, [
        attachment({ id: "extra", name: "extra.png" }),
      ]),
    ).toHaveLength(20);
  });
  it("keeps previously attached images when adding more", () => {
    const first = attachment({ id: "a", name: "one.png" });
    const second = attachment({ id: "b", name: "two.png" });
    expect(mergeAttachments([first], [second]).map((file) => file.id)).toEqual([
      "a",
      "b",
    ]);
  });

  it("skips the same path twice", () => {
    const first = attachment({
      id: "a",
      name: "shot.png",
      path: "/tmp/shot.png",
    });
    const again = attachment({
      id: "b",
      name: "shot.png",
      path: "/tmp/shot.png",
    });
    expect(mergeAttachments([first], [again])).toEqual([first]);
  });
});

describe("filesFromClipboard", () => {
  it("returns every file item when the files list is truncated", () => {
    const a = file("a.png", "image/png", "a");
    const b = file("b.png", "image/png", "b");
    expect(
      filesFromClipboard({
        files: [a],
        items: [item(a), item(b)],
      }),
    ).toEqual([a, b]);
  });

  it("drops the unnamed tiff twin of a png screenshot", () => {
    const png = file("image.png", "image/png");
    const tiff = file("image.tiff", "image/tiff");
    expect(
      filesFromClipboard({
        files: [png],
        items: [item(png), item(tiff)],
      }),
    ).toEqual([png]);
  });

  it("keeps a real named tiff next to a png", () => {
    const png = file("diagram.png", "image/png");
    const tiff = file("scan.tiff", "image/tiff");
    expect(
      filesFromClipboard({
        files: [png, tiff],
        items: [item(png), item(tiff)],
      }),
    ).toEqual([png, tiff]);
  });
});

describe("pathsFromClipboard", () => {
  it("decodes escaped filename characters and rejects remote hosts", () => {
    expect(
      pathsFromClipboard({
        getData: (type) =>
          type === "text/uri-list"
            ? "file:///tmp/a%23b%3Fc.png\nfile://remote/tmp/no.png\nfile://localhost/tmp/yes.png"
            : "",
      }),
    ).toEqual(["/tmp/a#b?c.png", "/tmp/yes.png"]);
  });
  it("reads file:// uris from text/uri-list", () => {
    const data = {
      getData: (type: string) =>
        type === "text/uri-list"
          ? "# comment\nfile:///tmp/screenshot.png\n"
          : "",
    };
    expect(pathsFromClipboard(data)).toEqual(["/tmp/screenshot.png"]);
  });

  it("falls back to file:// uri in text/plain", () => {
    const data = {
      getData: (type: string) =>
        type === "text/plain" ? "file:///home/popwavy/Pictures/shot.png" : "",
    };
    expect(pathsFromClipboard(data)).toEqual([
      "/home/popwavy/Pictures/shot.png",
    ]);
  });

  it("decodes uri percent-encoding", () => {
    const data = {
      getData: (type: string) =>
        type === "text/uri-list" ? "file:///tmp/some%20shot.png" : "",
    };
    expect(pathsFromClipboard(data)).toEqual(["/tmp/some shot.png"]);
  });

  it("ignores non-file schemes and blank lines", () => {
    const data = {
      getData: (type: string) =>
        type === "text/uri-list"
          ? "\nhttps://example.com/x.png\n\nfile:///tmp/a.png\n"
          : "",
    };
    expect(pathsFromClipboard(data)).toEqual(["/tmp/a.png"]);
  });

  it("returns an empty list when no getData is provided", () => {
    expect(pathsFromClipboard({})).toEqual([]);
    expect(pathsFromClipboard(null)).toEqual([]);
  });

  it("de-duplicates paths reported in both uri-list and plain", () => {
    const data = {
      getData: (type: string) =>
        type === "text/uri-list"
          ? "file:///tmp/a.png\nfile:///tmp/b.png"
          : "file:///tmp/a.png",
    };
    expect(pathsFromClipboard(data)).toEqual(["/tmp/a.png", "/tmp/b.png"]);
  });
});
