import { beforeEach, describe, expect, it, vi } from "vitest";

import { retrieveKnowledgeContext } from "@/modules/aria/aria.service";

/**
 * ARIA Phase 5 — knowledge corpus lookup eval.
 *
 * Drives the keyword-scoring fallback (vector path mocked to `null`)
 * over a fixture corpus that mirrors what the auto-sync workers will
 * produce in production. Each case maps a representative question to
 * the article id we expect to surface first. Failure means a
 * regression in scoring or visibility filtering.
 */

// ── Hoisted mocks ───────────────────────────────────────────────────

const repositoryMock = vi.hoisted(() => ({
  findKnowledgeByEmbedding: vi.fn().mockResolvedValue([]),
  findActiveKnowledgeForRetrieval: vi.fn(),
}));

vi.mock("@/modules/aria/aria.repository", () => ({
  ariaRepository: repositoryMock,
}));

vi.mock("@/modules/aria/aria-embedding.service", () => ({
  generateEmbedding: vi.fn().mockResolvedValue(null),
  vectorLiteral: vi.fn((vec: number[]) => `[${vec.join(",")}]`),
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {},
}));

vi.mock("@/infrastructure/supabase/admin", () => ({
  supabaseAdmin: { auth: { admin: {} } },
}));

const loadUserPermissionsMock = vi.hoisted(() => vi.fn());

vi.mock("@/core/guards/auth.guard", () => ({
  loadUserPermissions: loadUserPermissionsMock,
}));

// ── Fixture corpus ──────────────────────────────────────────────────

interface FixtureArticle {
  id: string;
  category: string;
  title: string;
  body: string;
  keywords: string[];
  requiredPermissions: string[];
}

const CORPUS: FixtureArticle[] = [
  {
    id: "art-thai-visa",
    category: "immigration",
    title: "Thai Non-B Visa Renewal Process",
    body: "Steps to renew a Thai non-B visa: gather work permit, employment contract, and submit to Immigration Bureau 30 days before expiry.",
    keywords: ["thai visa", "non-b", "visa renewal", "thailand", "immigration"],
    requiredPermissions: [],
  },
  {
    id: "art-work-permit",
    category: "immigration",
    title: "Work Permit Renewal in Thailand",
    body: "Work permit renewal requires the latest tax certificate (PND.1), social security record, and TBH HR signature on the application form.",
    keywords: [
      "work permit",
      "thailand work permit",
      "wp renewal",
      "permit renewal",
    ],
    requiredPermissions: [],
  },
  {
    id: "art-leave-policy",
    category: "hr",
    title: "Annual Leave Policy",
    body: "Annual leave entitlement is 14 days per calendar year. Carry-over up to 5 days; balance forfeited on Dec 31.",
    keywords: ["annual leave", "leave policy", "vacation", "pto"],
    requiredPermissions: [],
  },
  {
    id: "art-per-diem",
    category: "finance",
    title: "Travel Per Diem Policy",
    body: "Per-diem rates: Bangkok 1500 THB, Singapore SGD 80, Mumbai INR 3500. Submit receipts for amounts above the per-diem.",
    keywords: ["per diem", "travel allowance", "daily allowance"],
    requiredPermissions: [],
  },
  {
    id: "art-expense-approval",
    category: "policy",
    title: "Expense Approval Bands",
    body: "Under $500: direct manager only. $500-$5000: manager + finance lead. Above $5000: CFO approval required.",
    keywords: [
      "expense approval",
      "expense band",
      "approval threshold",
      "approves",
      "expense",
    ],
    requiredPermissions: [],
  },
  {
    id: "art-payroll-finance-only",
    category: "finance",
    title: "Payroll Adjustment Procedure",
    body: "Finance team must validate any mid-cycle payroll adjustment. Salary changes require HR + finance double sign-off.",
    keywords: ["payroll", "salary adjustment", "payroll change"],
    requiredPermissions: ["payroll:read"],
  },
];

beforeEach(() => {
  repositoryMock.findActiveKnowledgeForRetrieval.mockResolvedValue(CORPUS);
  loadUserPermissionsMock.mockResolvedValue(new Set<string>());
});

// ── Golden Q&A cases ────────────────────────────────────────────────

interface EvalCase {
  question: string;
  expectedTopId: string;
  callerPerms?: string[];
  category: string;
}

const CASES: EvalCase[] = [
  {
    category: "immigration",
    question: "How do I renew my Thai non-B visa?",
    expectedTopId: "art-thai-visa",
  },
  {
    category: "immigration",
    question: "What's the process for renewing my Thailand work permit?",
    expectedTopId: "art-work-permit",
  },
  {
    category: "hr",
    question: "How many annual leave days do I have?",
    expectedTopId: "art-leave-policy",
  },
  {
    category: "hr",
    question: "Can I carry over unused PTO into next year?",
    expectedTopId: "art-leave-policy",
  },
  {
    category: "finance",
    question: "What is the per diem rate for Bangkok?",
    expectedTopId: "art-per-diem",
  },
  {
    category: "finance",
    question: "How is travel allowance handled?",
    expectedTopId: "art-per-diem",
  },
  {
    category: "policy",
    question: "What's the expense approval threshold for $3000?",
    expectedTopId: "art-expense-approval",
  },
  {
    category: "policy",
    question: "Who approves a $10,000 expense?",
    expectedTopId: "art-expense-approval",
  },
];

describe("ARIA knowledge corpus eval (keyword path)", () => {
  for (const c of CASES) {
    it(`[${c.category}] "${c.question}" → ${c.expectedTopId}`, async () => {
      const result = await retrieveKnowledgeContext(
        "user-1",
        c.question,
        3,
        [],
      );
      expect(result.injectedIds[0]).toBe(c.expectedTopId);
    });
  }

  it("hides permission-gated articles from unauthorised callers", async () => {
    const result = await retrieveKnowledgeContext(
      "user-1",
      "payroll adjustment salary change",
      3,
      [],
    );
    expect(result.injectedIds).not.toContain("art-payroll-finance-only");
  });

  it("surfaces permission-gated articles for permitted callers", async () => {
    loadUserPermissionsMock.mockResolvedValue(new Set(["payroll:read"]));
    const result = await retrieveKnowledgeContext(
      "user-1",
      "payroll adjustment salary change",
      3,
      [],
    );
    expect(result.injectedIds[0]).toBe("art-payroll-finance-only");
  });

  it("returns empty result + mode=keyword when nothing matches", async () => {
    const result = await retrieveKnowledgeContext(
      "user-1",
      "random gibberish nonsense xyz",
      3,
      [],
    );
    expect(result.injectedIds).toHaveLength(0);
    expect(result.mode).toBe("keyword");
  });

  // Regression guard: hit rate must stay above this floor as the
  // corpus grows. Update the threshold deliberately when re-tuning
  // the scorer.
  it("aggregate hit rate across cases >= 80%", async () => {
    let hits = 0;
    for (const c of CASES) {
      const result = await retrieveKnowledgeContext(
        "user-1",
        c.question,
        3,
        [],
      );
      if (result.injectedIds[0] === c.expectedTopId) hits += 1;
    }
    const rate = hits / CASES.length;
    expect(rate).toBeGreaterThanOrEqual(0.8);
  });
});
