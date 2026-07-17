import { vi } from "vitest";

export const mockSupabaseAuth = {
  admin: {
    createUser: vi.fn(),
    updateUserById: vi.fn(),
    deleteUser: vi.fn(),
    getUserById: vi.fn(),
    listUsers: vi.fn(),
  },
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
};

export const mockSupabaseStorage = {
  from: vi.fn(() => ({
    upload: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
    createSignedUrl: vi.fn(),
    getPublicUrl: vi.fn(),
  })),
  createBucket: vi.fn(),
  getBucket: vi.fn(),
  listBuckets: vi.fn(),
};

export const mockSupabaseAdmin = {
  auth: mockSupabaseAuth,
  storage: mockSupabaseStorage,
};

vi.mock("@/infrastructure/supabase/admin", () => ({
  supabaseAdmin: mockSupabaseAdmin,
}));

export function resetSupabaseMocks() {
  Object.values(mockSupabaseAuth.admin).forEach((fn) => {
    if (typeof fn === "function" && "mockReset" in fn) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  });
  mockSupabaseAuth.signInWithPassword.mockReset();
  mockSupabaseAuth.signOut.mockReset();
  mockSupabaseAuth.getUser.mockReset();
  mockSupabaseAuth.getSession.mockReset();
}
