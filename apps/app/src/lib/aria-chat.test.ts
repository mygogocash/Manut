import { describe, expect, it } from "vitest";
import { extractChatActions } from "./aria-chat";

describe("extractChatActions", () => {
  it("strips aria-actions fences into chips", () => {
    const content = `Here are options:\n\`\`\`aria-actions\n{"actions":[{"label":"Check leave","prompt":"What is my leave balance?"}]}\n\`\`\`\n`;
    const result = extractChatActions(content);
    expect(result.display).toContain("Here are options");
    expect(result.display).not.toContain("aria-actions");
    expect(result.actions).toEqual([{ label: "Check leave", prompt: "What is my leave balance?" }]);
  });

  it("parses aria-confirm fences", () => {
    const content = `Confirm?\n\`\`\`aria-confirm\n{"action":"submit_leave","token":"tok_1","summary":"Submit annual leave tomorrow"}\n\`\`\``;
    const result = extractChatActions(content);
    expect(result.confirm).toEqual({
      action: "submit_leave",
      token: "tok_1",
      summary: "Submit annual leave tomorrow",
    });
  });
});
