import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  listOfficeAssets,
  listOfficeRooms,
  listOffices,
} from "../src/office/office";

const officeRecord = {
  id: "cloffice000000000000000001",
  name: "Bangkok HQ",
  address: "1 Example Road",
  city: "Bangkok",
  country: "Thailand",
  timezone: "Asia/Bangkok",
  capacity: 120,
  isActive: true,
};

const roomRecord = {
  id: "a0000000-0000-4000-8000-000000000001",
  name: "Meeting A",
  capacity: 8,
  floor: null,
  amenities: ["tv", "whiteboard"],
  imageUrl: "https://cdn.example/room-a.jpg",
  officeId: officeRecord.id,
  office: { id: officeRecord.id, name: "Bangkok HQ", city: "Bangkok" },
  slotMinutes: 30,
  maxConsecutiveSlots: 8,
  timeSlots: [
    {
      time: "09:00",
      endTime: "09:30",
      isAvailable: false,
      bookedBy: { id: "user-1", name: "Alex" },
      bookingId: "booking-1",
      title: "Standup",
      description: "Daily sync",
      attendeesCount: 4,
      bookingStart: "09:00",
      bookingEnd: "09:30",
    },
  ],
};

const assetRecord = {
  id: "a0000000-0000-4000-8000-000000000002",
  officeId: officeRecord.id,
  name: "MacBook Pro",
  type: "laptop",
  serialNo: "SN-123",
  status: "assigned",
  purchaseCost: "1999.00",
  bookValue: "1200.00",
  sellingPrice: null,
  notes: "Internal finance note",
  manufacturer: "Apple",
  model: "M3",
  office: { id: officeRecord.id, name: "Bangkok HQ" },
  assignee: {
    id: "a0000000-0000-4000-8000-000000000099",
    name: "Alex Example",
    email: "alex@example.com",
  },
};

describe("office foundation contracts", () => {
  it("lists offices for the read foundation", async () => {
    const get = vi.fn().mockResolvedValue({ data: [officeRecord] });
    const client = { get } as unknown as ApiClient;

    const result = await listOffices(client);
    expect(result.data[0]).toEqual({
      id: officeRecord.id,
      name: "Bangkok HQ",
      city: "Bangkok",
      country: "Thailand",
      capacity: 120,
      isActive: true,
    });
    expect(result.data[0]).not.toHaveProperty("address");
    expect(get).toHaveBeenCalledWith("/office/offices", undefined);
  });

  it("lists rooms and strips booking slot detail", async () => {
    const get = vi.fn().mockResolvedValue({ data: [roomRecord] });
    const client = { get } as unknown as ApiClient;

    const result = await listOfficeRooms(client);
    expect(result.data[0]).toEqual({
      id: roomRecord.id,
      name: "Meeting A",
      capacity: 8,
      amenities: ["tv", "whiteboard"],
      hasImage: true,
      office: { id: officeRecord.id, name: "Bangkok HQ", city: "Bangkok" },
    });
    expect(result.data[0]).not.toHaveProperty("timeSlots");
    expect(result.data[0]).not.toHaveProperty("imageUrl");
    expect(get).toHaveBeenCalledWith("/office/rooms", undefined);
  });

  it("lists assets and strips finance plus assignee email", async () => {
    const get = vi.fn().mockResolvedValue({
      data: [assetRecord],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    const result = await listOfficeAssets(client, { page: 1, limit: 20 });
    expect(result.data[0]).toEqual({
      id: assetRecord.id,
      name: "MacBook Pro",
      type: "laptop",
      serialNo: "SN-123",
      status: "assigned",
      manufacturer: "Apple",
      model: "M3",
      office: { id: officeRecord.id, name: "Bangkok HQ" },
      assignee: {
        id: assetRecord.assignee.id,
        name: "Alex Example",
      },
    });
    expect(result.data[0]).not.toHaveProperty("purchaseCost");
    expect(result.data[0]).not.toHaveProperty("bookValue");
    expect(result.data[0]).not.toHaveProperty("notes");
    expect(result.data[0]?.assignee).not.toHaveProperty("email");
    expect(get).toHaveBeenCalledWith(
      "/office/assets?page=1&limit=20",
      undefined,
    );
  });
});
