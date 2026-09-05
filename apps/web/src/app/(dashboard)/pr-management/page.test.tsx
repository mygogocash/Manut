import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PRManagementPage from "@/app/(dashboard)/pr-management/page";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("@/hooks/use-debounce", () => ({
  useDebounce: <T,>(v: T) => v,
}));

const mockArticles = [
  {
    id: "article-1",
    title: "TBH Raises $10M Series A",
    date: "2026-04-20",
    link: "https://techcrunch.com/tbh-series-a",
    img: "https://example.com/img1.jpg",
    authorId: "user-1",
    author: { id: "user-1", name: "Author" },
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  },
  {
    id: "article-2",
    title: "TBH Launches New Product",
    date: "2026-04-22",
    link: "https://forbes.com/tbh-product",
    img: "https://example.com/img2.jpg",
    authorId: "user-1",
    author: { id: "user-1", name: "Author" },
    createdAt: "2026-04-22T00:00:00.000Z",
    updatedAt: "2026-04-22T00:00:00.000Z",
  },
];

const mockListArticles = vi.fn();
const mockDeleteArticle = vi.fn();

vi.mock("@/services/article.service", () => ({
  listArticles: (...args: unknown[]) => mockListArticles(...args),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  deleteArticle: (...args: unknown[]) => mockDeleteArticle(...args),
  getArticle: vi.fn(),
}));

vi.mock("@/services/upload.service", () => ({
  uploadFile: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/lib/api-client", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

describe("PRManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListArticles.mockResolvedValue({
      data: mockArticles,
      meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
    });
  });

  it("renders the page header", async () => {
    render(<PRManagementPage />);

    expect(screen.getByText("PR Management")).toBeInTheDocument();
    expect(
      screen.getByText("Manage press release articles and media coverage"),
    ).toBeInTheDocument();
  });

  it("shows create button when user has permission", async () => {
    render(<PRManagementPage />);

    expect(screen.getByText("Create PR")).toBeInTheDocument();
  });

  it("renders article cards after loading", async () => {
    render(<PRManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("TBH Raises $10M Series A")).toBeInTheDocument();
    });

    expect(screen.getByText("TBH Launches New Product")).toBeInTheDocument();
  });

  it("shows PR Article label on cards", async () => {
    render(<PRManagementPage />);

    await waitFor(() => {
      const labels = screen.getAllByText("PR Article");
      expect(labels.length).toBe(2);
    });
  });

  it("renders external links on cards", async () => {
    render(<PRManagementPage />);

    await waitFor(() => {
      expect(
        screen.getByText("https://techcrunch.com/tbh-series-a"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("https://forbes.com/tbh-product"),
      ).toBeInTheDocument();
    });
  });

  it("renders search input", async () => {
    render(<PRManagementPage />);

    const searchInput = screen.getByPlaceholderText("Search by title...");
    expect(searchInput).toBeInTheDocument();
  });

  it("calls listArticles with search param when typing", async () => {
    render(<PRManagementPage />);

    await waitFor(() => {
      expect(mockListArticles).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText("Search by title...");
    fireEvent.change(searchInput, { target: { value: "Series" } });

    await waitFor(() => {
      expect(mockListArticles).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Series" }),
      );
    });
  });

  it("shows empty state when no articles found", async () => {
    mockListArticles.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    });

    render(<PRManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("No articles found")).toBeInTheDocument();
    });
  });

  it("shows edit and delete buttons for each article", async () => {
    render(<PRManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("TBH Raises $10M Series A")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("Edit");
    const deleteButtons = screen.getAllByText("Delete");

    expect(editButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);
  });
});
