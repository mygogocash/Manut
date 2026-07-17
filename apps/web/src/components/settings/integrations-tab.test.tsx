import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntegrationsTab } from "@/components/settings/integrations-tab";
import {
  disconnectGoogle,
  getIntegrationsStatus,
  startGoogleOauth,
} from "@/services/integrations.service";

vi.mock("@/services/integrations.service", () => ({
  getIntegrationsStatus: vi.fn(),
  startGoogleOauth: vi.fn(),
  disconnectGoogle: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    constructor(
      public readonly status: number,
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));

const mockedGetStatus = vi.mocked(getIntegrationsStatus);
const mockedStartOauth = vi.mocked(startGoogleOauth);
const mockedDisconnect = vi.mocked(disconnectGoogle);

const baseStatus = {
  data: {
    google: { connected: false },
  },
};

const connectedStatus = {
  data: {
    ...baseStatus.data,
    google: {
      connected: true,
      accountEmail: "user@example.com",
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      scope:
        "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/drive.readonly",
    },
  },
};

const originalLocation = window.location;

beforeEach(() => {
  mockedGetStatus.mockReset();
  mockedStartOauth.mockReset();
  mockedDisconnect.mockReset();
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});

describe("IntegrationsTab > given google.connected = false", () => {
  it("renders Connect Google button", async () => {
    mockedGetStatus.mockResolvedValueOnce(baseStatus);

    render(<IntegrationsTab />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /connect google/i }),
      ).toBeInTheDocument();
    });
  });

  it("describes the Manut-owned Cloudflare AI boundary", async () => {
    mockedGetStatus.mockResolvedValueOnce(baseStatus);

    render(<IntegrationsTab />);

    expect(
      await screen.findByText(/workers ai through ai gateway/i),
    ).toBeVisible();
  });

  it("clicking Connect calls startGoogleOauth then redirects window.location", async () => {
    mockedGetStatus.mockResolvedValueOnce(baseStatus);
    mockedStartOauth.mockResolvedValueOnce({
      url: "https://accounts.google.com/auth?x=1",
    });

    const assignSpy = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign: assignSpy },
    });

    render(<IntegrationsTab />);

    const btn = await screen.findByRole("button", { name: /connect google/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(mockedStartOauth).toHaveBeenCalled();
      expect(assignSpy).toHaveBeenCalledWith(
        "https://accounts.google.com/auth?x=1",
      );
    });
  });
});

describe("IntegrationsTab > given google.connected = true", () => {
  it("renders accountEmail and a Disconnect button", async () => {
    mockedGetStatus.mockResolvedValueOnce(connectedStatus);

    render(<IntegrationsTab />);

    await waitFor(() => {
      expect(screen.getByText("user@example.com")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /disconnect/i }),
      ).toBeInTheDocument();
    });
  });

  it("clicking Disconnect then Confirm calls disconnectGoogle", async () => {
    mockedGetStatus
      .mockResolvedValueOnce(connectedStatus)
      .mockResolvedValueOnce(baseStatus);
    mockedDisconnect.mockResolvedValueOnce({ ok: true });

    render(<IntegrationsTab />);

    const disconnectBtn = await screen.findByRole("button", {
      name: /disconnect/i,
    });
    fireEvent.click(disconnectBtn);

    const confirmBtn = await screen.findByRole("button", {
      name: /^confirm disconnect$/i,
    });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockedDisconnect).toHaveBeenCalled();
    });
  });
});
