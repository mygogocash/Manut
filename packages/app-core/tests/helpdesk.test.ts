import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  helpdeskTicketSchema,
  helpdeskTicketStatusLabel,
  listHelpdeskTickets,
} from "../src/helpdesk/helpdesk";

const ticket = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  ticketNumber: 42,
  title: "VPN access",
  description: "Cannot connect from home",
  category: "network" as const,
  priority: "high" as const,
  status: "open" as const,
  resolutionNote: "internal",
  attachments: [{ url: "https://cdn.example/a.pdf" }],
  createdAt: "2026-07-18T10:00:00.000Z",
  updatedAt: "2026-07-18T11:00:00.000Z",
  createdBy: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  assignee: {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    name: "IT Desk",
    email: "it@example.com",
  },
};

describe("helpdesk foundation contracts", () => {
  it("projects ticket list fields and strips sensitive extras", () => {
    const parsed = helpdeskTicketSchema.parse(ticket);
    expect(parsed).toEqual({
      id: ticket.id,
      ticketNumber: 42,
      title: "VPN access",
      category: "network",
      priority: "high",
      status: "open",
      createdAt: ticket.createdAt,
      createdBy: { id: ticket.createdBy.id, name: "Alex Example" },
      assignee: { id: ticket.assignee.id, name: "IT Desk" },
    });
    expect(parsed).not.toHaveProperty("description");
    expect(parsed).not.toHaveProperty("attachments");
    expect(helpdeskTicketStatusLabel("in-progress")).toBe("In progress");
  });

  it("lists tickets and normalizes pages meta", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [ticket],
      meta: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      listHelpdeskTickets(client, { page: 1, limit: 20, scope: "mine" }, signal),
    ).resolves.toEqual({
      data: [expect.objectContaining({ title: "VPN access" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith(
      "/helpdesk?page=1&limit=20&scope=mine",
      { signal },
    );
  });
});
