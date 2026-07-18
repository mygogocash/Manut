import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  addTravelAttachments,
  addTravelAttachmentsInputSchema,
  approveTravelRequest,
  canCancelTravelRequest,
  cancelTravelRequest,
  createTravelRequest,
  createTravelRequestInputSchema,
  getTravelRequests,
  rejectTravelRequest,
  rejectTravelRequestInputSchema,
  travelRequestListParamsSchema,
  travelRequestSchema,
} from "../src/travel/travel";

const request = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  requestCode: "TRV-2026-001",
  origin: "Bangkok",
  destination: "Singapore",
  purpose: "Client workshop",
  departureDate: "2026-08-10",
  returnDate: "2026-08-12",
  estimatedBudget: "1200",
  cashAdvance: null,
  currency: "USD",
  category: "general" as const,
  status: "pending" as const,
  createdAt: "2026-07-01T10:00:00.000Z",
  employee: {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Person",
    email: "person@manut.example",
    department: "Operations",
  },
};

describe("travel contracts", () => {
  it("accepts travel receipts and rejects unknown status values", () => {
    expect(travelRequestSchema.safeParse(request).success).toBe(true);
    expect(
      travelRequestSchema.safeParse({
        ...request,
        status: "in_flight",
      }).success,
    ).toBe(false);
  });

  it("normalizes list parameters and bounds page size", () => {
    expect(
      travelRequestListParamsSchema.parse({
        page: 2,
        limit: 20,
        employeeId: "11111111-1111-4111-8111-111111111111",
        status: "pending",
      }),
    ).toEqual({
      page: 2,
      limit: 20,
      employeeId: "11111111-1111-4111-8111-111111111111",
      status: "pending",
    });
    expect(
      travelRequestListParamsSchema.safeParse({ page: 0, limit: 101 }).success,
    ).toBe(false);
  });

  it("requires core create fields and enforces return after departure", () => {
    expect(
      createTravelRequestInputSchema.safeParse({
        origin: "Bangkok",
        destination: "Singapore",
        purpose: "Workshop",
        departureDate: "2026-08-12",
        returnDate: "2026-08-10",
      }).success,
    ).toBe(false);
    expect(
      createTravelRequestInputSchema.parse({
        origin: " Bangkok ",
        destination: " Singapore ",
        purpose: " Workshop ",
        departureDate: "2026-08-10",
        returnDate: "2026-08-12",
      }),
    ).toMatchObject({
      origin: "Bangkok",
      destination: "Singapore",
      purpose: "Workshop",
      category: "general",
      currency: "USD",
    });
  });

  it("lists requests with pagination and forwards aborts", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [request],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      getTravelRequests(
        client,
        {
          page: 1,
          limit: 20,
          employeeId: "11111111-1111-4111-8111-111111111111",
        },
        signal,
      ),
    ).resolves.toMatchObject({ data: [request], meta: { total: 1 } });

    expect(get).toHaveBeenCalledWith(
      "/travel/requests?page=1&limit=20&employeeId=11111111-1111-4111-8111-111111111111",
      { signal },
    );
  });

  it("creates a request and projects a cancelable receipt", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        ...request,
        employee: { ...request.employee, email: "private@manut.example" },
        viewerCanAct: false,
        notes: "internal",
      },
    });
    const client = { post } as unknown as ApiClient;

    const created = await createTravelRequest(client, {
      origin: "Bangkok",
      destination: "Singapore",
      purpose: "Workshop",
      departureDate: "2026-08-10",
      returnDate: "2026-08-12",
    });

    expect(created).toMatchObject({
      id: request.id,
      status: "pending",
      destination: "Singapore",
      viewerCanAct: false,
    });
    expect(post).toHaveBeenCalledWith(
      "/travel/requests",
      expect.objectContaining({
        origin: "Bangkok",
        destination: "Singapore",
        category: "general",
      }),
    );
  });

  it("cancels pending or draft requests only", async () => {
    expect(canCancelTravelRequest("pending")).toBe(true);
    expect(canCancelTravelRequest("draft")).toBe(true);
    expect(canCancelTravelRequest("approved")).toBe(false);

    const put = vi.fn().mockResolvedValue({
      data: { ...request, status: "cancelled" },
    });
    const client = { put } as unknown as ApiClient;

    await expect(cancelTravelRequest(client, request.id)).resolves.toMatchObject(
      { status: "cancelled" },
    );
    expect(put).toHaveBeenCalledWith(
      `/travel/requests/${request.id}/cancel`,
    );
  });

  it("approves and rejects pending requests with a required reason", async () => {
    expect(
      rejectTravelRequestInputSchema.safeParse({ reason: "   " }).success,
    ).toBe(false);

    const put = vi
      .fn()
      .mockResolvedValueOnce({ data: { ...request, status: "approved" } })
      .mockResolvedValueOnce({
        data: { ...request, status: "rejected", rejectReason: "Budget" },
      });
    const client = { put } as unknown as ApiClient;

    await expect(approveTravelRequest(client, request.id)).resolves.toMatchObject(
      { status: "approved" },
    );
    await expect(
      rejectTravelRequest(client, request.id, { reason: " Budget " }),
    ).resolves.toMatchObject({ status: "rejected" });
    expect(put).toHaveBeenNthCalledWith(
      1,
      `/travel/requests/${request.id}/approve`,
    );
    expect(put).toHaveBeenNthCalledWith(
      2,
      `/travel/requests/${request.id}/reject`,
      { reason: "Budget" },
    );
  });

  it("adds attachment metadata by name and URL", async () => {
    expect(
      addTravelAttachmentsInputSchema.safeParse({
        attachments: [{ name: "Itinerary", url: "not-a-url" }],
      }).success,
    ).toBe(false);

    const post = vi.fn().mockResolvedValue({
      data: { ...request, viewerCanAct: false },
    });
    const client = { post } as unknown as ApiClient;

    await expect(
      addTravelAttachments(client, request.id, {
        attachments: [
          {
            name: " Itinerary ",
            url: "https://files.example/itinerary.pdf",
          },
        ],
      }),
    ).resolves.toMatchObject({ id: request.id });
    expect(post).toHaveBeenCalledWith(
      `/travel/requests/${request.id}/attachments`,
      {
        attachments: [
          {
            name: "Itinerary",
            url: "https://files.example/itinerary.pdf",
          },
        ],
      },
    );
  });
});
