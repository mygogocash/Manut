import { describe, expect, it } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import {
  assertAttachmentFileAllowed,
  assertAttachmentQuota,
  assertHasAttachment,
} from "@/modules/accounting/attachments-rules";

describe("attachments-rules", () => {
  it("allows PDF under 10 MB", () => {
    expect(() =>
      assertAttachmentFileAllowed({
        mimeType: "application/pdf",
        size: 1000,
      }),
    ).not.toThrow();
  });

  it("rejects a missing attachment, oversize file, and 11th file", () => {
    expect(() => assertHasAttachment(0)).toThrow(BadRequestException);
    expect(() =>
      assertAttachmentFileAllowed({
        mimeType: "application/pdf",
        size: 11 * 1024 * 1024,
      }),
    ).toThrow(BadRequestException);
    expect(() => assertAttachmentQuota(10)).toThrow(BadRequestException);
  });
});
