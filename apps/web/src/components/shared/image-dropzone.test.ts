import { describe, expect, it } from "vitest";

import {
  ACCEPTED_IMAGE_TYPES,
  firstFileFrom,
  isAcceptedImage,
} from "@/components/shared/image-dropzone";

describe("isAcceptedImage", () => {
  it("accepts the formats the uploads bucket allows", () => {
    for (const type of ACCEPTED_IMAGE_TYPES) {
      expect(isAcceptedImage({ type })).toBe(true);
    }
  });

  // The `uploads` bucket is PUBLIC and the server rejects SVG on purpose: an
  // SVG served from a CDN path can run embedded script in an HTML context,
  // which is a stored-XSS vector against teammates. Testing `image/*` here
  // would send one to a 415 the user cannot interpret — and would be the first
  // step toward someone "fixing" that by allowing it server-side.
  it("rejects SVG, even though it is an image", () => {
    expect(isAcceptedImage({ type: "image/svg+xml" })).toBe(false);
  });

  it("rejects non-images", () => {
    expect(isAcceptedImage({ type: "application/pdf" })).toBe(false);
    expect(isAcceptedImage({ type: "text/html" })).toBe(false);
    expect(isAcceptedImage({ type: "" })).toBe(false);
  });

  // Windows and legacy Safari report this for .jpg files.
  it("accepts the non-standard image/jpg some clients send", () => {
    expect(isAcceptedImage({ type: "image/jpg" })).toBe(true);
  });
});

describe("firstFileFrom", () => {
  const file = { name: "chair.png", type: "image/png" } as File;

  it("reads the file list when the browser provides one", () => {
    const dt = { files: [file], items: [] } as unknown as DataTransfer;
    expect(firstFileFrom(dt)).toBe(file);
  });

  // Some browsers populate `items` instead of `files` on drop.
  it("falls back to the items list", () => {
    const dt = {
      files: [],
      items: [{ kind: "file", getAsFile: () => file }],
    } as unknown as DataTransfer;
    expect(firstFileFrom(dt)).toBe(file);
  });

  it("skips non-file items such as dragged text", () => {
    const dt = {
      files: [],
      items: [
        { kind: "string", getAsFile: () => null },
        { kind: "file", getAsFile: () => file },
      ],
    } as unknown as DataTransfer;
    expect(firstFileFrom(dt)).toBe(file);
  });

  it("returns null when nothing usable was dropped", () => {
    const dt = { files: [], items: [] } as unknown as DataTransfer;
    expect(firstFileFrom(dt)).toBeNull();
  });
});
