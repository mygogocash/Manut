import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import BlogManagementPage from "@/app/(dashboard)/blog-management/page";

vi.mock("@/providers/auth-provider", () => ({
  useAuth: () => ({
    hasPermission: () => true,
  }),
}));

vi.mock("@/hooks/use-debounce", () => ({
  useDebounce: <T,>(v: T) => v,
}));

const mockBlogs = [
  {
    id: "blog-1",
    title: "Test Blog Post",
    content: "<p>Hello world</p>",
    coverImage: "https://example.com/img.jpg",
    slug: "test-blog",
    active: true,
    authorId: "user-1",
    author: { id: "user-1", name: "Author" },
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
  },
  {
    id: "blog-2",
    title: "Draft Blog Post",
    content: "Draft content",
    coverImage: "https://example.com/img2.jpg",
    slug: "draft-blog",
    active: false,
    authorId: "user-1",
    author: { id: "user-1", name: "Author" },
    createdAt: "2026-04-21T00:00:00.000Z",
    updatedAt: "2026-04-21T00:00:00.000Z",
  },
];

const mockListBlogs = vi.fn();
const mockDeleteBlog = vi.fn();

vi.mock("@/services/blog.service", () => ({
  listBlogs: (...args: unknown[]) => mockListBlogs(...args),
  createBlog: vi.fn(),
  updateBlog: vi.fn(),
  deleteBlog: (...args: unknown[]) => mockDeleteBlog(...args),
  getBlog: vi.fn(),
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

describe("BlogManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListBlogs.mockResolvedValue({
      data: mockBlogs,
      meta: { page: 1, limit: 12, total: 2, totalPages: 1 },
    });
  });

  it("renders the page header", async () => {
    render(<BlogManagementPage />);

    expect(screen.getByText("Blog Management")).toBeInTheDocument();
    expect(
      screen.getByText("Create and manage blog posts for the company website"),
    ).toBeInTheDocument();
  });

  it("shows create button when user has permission", async () => {
    render(<BlogManagementPage />);

    // CreateBlogDialog is loaded via next/dynamic with ssr: false, so wait
    // for the chunk to resolve before asserting on the trigger label.
    expect(await screen.findByText("Add New Blog")).toBeInTheDocument();
  });

  it("renders blog cards after loading", async () => {
    render(<BlogManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Blog Post")).toBeInTheDocument();
    });

    expect(screen.getByText("Draft Blog Post")).toBeInTheDocument();
  });

  it("shows Published badge for active blogs", async () => {
    render(<BlogManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Published")).toBeInTheDocument();
    });
  });

  it("shows Draft badge for inactive blogs", async () => {
    render(<BlogManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  it("renders search input", async () => {
    render(<BlogManagementPage />);

    const searchInput = screen.getByPlaceholderText("Enter title...");
    expect(searchInput).toBeInTheDocument();
  });

  it("calls listBlogs with search param when typing", async () => {
    render(<BlogManagementPage />);

    await waitFor(() => {
      expect(mockListBlogs).toHaveBeenCalled();
    });

    const searchInput = screen.getByPlaceholderText("Enter title...");
    fireEvent.change(searchInput, { target: { value: "Test" } });

    await waitFor(() => {
      expect(mockListBlogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Test" }),
      );
    });
  });

  it("shows empty state when no blogs found", async () => {
    mockListBlogs.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 12, total: 0, totalPages: 0 },
    });

    render(<BlogManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("No blogs found")).toBeInTheDocument();
    });
  });

  it("shows edit and delete buttons for each blog", async () => {
    render(<BlogManagementPage />);

    await waitFor(() => {
      expect(screen.getByText("Test Blog Post")).toBeInTheDocument();
    });

    const editButtons = screen.getAllByText("Edit");
    const deleteButtons = screen.getAllByText("Delete");

    expect(editButtons.length).toBe(2);
    expect(deleteButtons.length).toBe(2);
  });
});
