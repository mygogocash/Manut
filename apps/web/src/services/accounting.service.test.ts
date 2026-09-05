import { beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/lib/api-client";
import {
  activateCompany,
  applyCustomerAdvance,
  closeFiscalPeriod,
  convertPoToBill,
  convertQuote,
  createCreditNote,
  createPurchaseOrder,
  createQuote,
  createTaxCode,
  deletePurchaseOrder,
  deleteQuote,
  deleteTaxCode,
  fileTaxPeriod,
  getAgingSummary,
  getBankMatchSuggestions,
  getCompanySetup,
  getExpenseSummary,
  getMakerChecker,
  getOpeningBalances,
  getReconciliationSummary,
  getTaxRegisters,
  importOpeningBalances,
  issueCreditNote,
  listAccountingAuditLogs,
  listCreditNotes,
  listCustomerAdvances,
  listFiscalPeriods,
  listPurchaseOrders,
  listQuotes,
  listTaxCodes,
  listTaxFilings,
  receivePurchaseOrder,
  reconcileBankTransaction,
  reopenFiscalPeriod,
  reopenTaxPeriod,
  searchAccounting,
  sendQuote,
  setMakerChecker,
  settleBankTransaction,
  unreconcileBankTransaction,
  updateCompanySetup,
  updateQuote,
  updateTaxCode,
  voidCreditNote,
} from "@/services/accounting.service";

vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
  apiBaseUrl: "/api",
  authFetchInit: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

const apiMock = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  apiMock.get.mockReset().mockResolvedValue({ data: null });
  apiMock.post.mockReset().mockResolvedValue({ data: null });
  apiMock.put.mockReset().mockResolvedValue({ data: null });
  apiMock.delete.mockReset().mockResolvedValue({ data: null });
});

describe("accounting.service > credit notes", () => {
  it("listCreditNotes only includes provided filters in the query string", async () => {
    await listCreditNotes({ entityId: "e1", status: "issued" });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/credit-notes?entityId=e1&status=issued",
    );
  });

  it("listCreditNotes passes the noteKind filter (M4 debit notes)", async () => {
    await listCreditNotes({ entityId: "e1", noteKind: "debit" });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/credit-notes?entityId=e1&noteKind=debit",
    );
  });

  it("createCreditNote POSTs a debit note with its noteKind", async () => {
    const input = {
      entityId: "e1",
      type: "receivable" as const,
      noteKind: "debit" as const,
      issueDate: "2026-08-04",
      lines: [{ description: "Undercharge", quantity: 1, unitPrice: 250 }],
    };
    await createCreditNote(input);
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/credit-notes",
      input,
    );
  });

  it("listCreditNotes with no filters hits the bare endpoint", async () => {
    await listCreditNotes({});
    expect(apiMock.get).toHaveBeenCalledWith("/accounting/credit-notes");
  });

  it("createCreditNote POSTs the note payload", async () => {
    const input = {
      entityId: "e1",
      type: "receivable" as const,
      issueDate: "2026-08-03",
      lines: [{ description: "Refund", quantity: 1, unitPrice: 100 }],
    };
    await createCreditNote(input);
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/credit-notes",
      input,
    );
  });

  it("issueCreditNote / voidCreditNote POST to the id sub-routes", async () => {
    await issueCreditNote("cn1");
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/credit-notes/cn1/issue",
    );
    await voidCreditNote("cn1");
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/credit-notes/cn1/void",
    );
  });
});

describe("accounting.service > tax codes", () => {
  it("listTaxCodes includes includeInactive when set", async () => {
    await listTaxCodes({ entityId: "e1", includeInactive: true });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/tax-codes?entityId=e1&includeInactive=true",
    );
  });

  it("createTaxCode POSTs and updateTaxCode PUTs to the id route", async () => {
    const create = {
      entityId: "e1",
      code: "VAT7",
      name: "VAT 7%",
      kind: "vat-output" as const,
      rate: 0.07,
    };
    await createTaxCode(create);
    expect(apiMock.post).toHaveBeenCalledWith("/accounting/tax-codes", create);

    await updateTaxCode("tc1", { rate: 0.1 });
    expect(apiMock.put).toHaveBeenCalledWith("/accounting/tax-codes/tc1", {
      rate: 0.1,
    });
  });

  it("deleteTaxCode DELETEs the id route", async () => {
    await deleteTaxCode("tc1");
    expect(apiMock.delete).toHaveBeenCalledWith("/accounting/tax-codes/tc1");
  });
});

describe("accounting.service > company setup & opening balances", () => {
  it("getCompanySetup GETs the entity-scoped endpoint", async () => {
    await getCompanySetup("e1");
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/company-setup?entityId=e1",
    );
  });

  it("updateCompanySetup PUTs and activateCompany POSTs { entityId }", async () => {
    await updateCompanySetup({ entityId: "e1", fiscalYearStartMonth: 1 });
    expect(apiMock.put).toHaveBeenCalledWith("/accounting/company-setup", {
      entityId: "e1",
      fiscalYearStartMonth: 1,
    });

    await activateCompany("e1");
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/company-setup/activate",
      { entityId: "e1" },
    );
  });

  it("getOpeningBalances GETs status and importOpeningBalances POSTs rows", async () => {
    await getOpeningBalances("e1");
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/opening-balances?entityId=e1",
    );

    const input = {
      entityId: "e1",
      asOfDate: "2026-01-01",
      accounts: [{ chartOfAccountId: "a1", debit: 100 }],
    };
    await importOpeningBalances(input);
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/opening-balances",
      input,
    );
  });
});

describe("accounting.service > maker-checker & fiscal periods", () => {
  it("getMakerChecker GETs and setMakerChecker PUTs the flag", async () => {
    await getMakerChecker();
    expect(apiMock.get).toHaveBeenCalledWith("/accounting/maker-checker");

    await setMakerChecker(true);
    expect(apiMock.put).toHaveBeenCalledWith("/accounting/maker-checker", {
      blockSelfApproval: true,
    });
  });

  it("fiscal-period close / reopen POST the period payload", async () => {
    await listFiscalPeriods("e1");
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/fiscal-periods?entityId=e1",
    );

    await closeFiscalPeriod({ entityId: "e1", year: 2026, month: 7 });
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/fiscal-periods/close",
      {
        entityId: "e1",
        year: 2026,
        month: 7,
      },
    );

    await reopenFiscalPeriod({ entityId: "e1", year: 2026, month: 7 });
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/fiscal-periods/reopen",
      { entityId: "e1", year: 2026, month: 7 },
    );
  });
});

describe("accounting.service > quotes", () => {
  it("listQuotes includes only provided filters", async () => {
    await listQuotes({ entityId: "e1", status: "sent" });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/quotes?entityId=e1&status=sent",
    );
  });

  it("createQuote POSTs, updateQuote PUTs, deleteQuote DELETEs", async () => {
    const input = {
      entityId: "e1",
      issueDate: "2026-08-03",
      lines: [{ description: "Design", quantity: 1, unitPrice: 500 }],
    };
    await createQuote(input);
    expect(apiMock.post).toHaveBeenCalledWith("/accounting/quotes", input);

    await updateQuote("q1", { currency: "USD" });
    expect(apiMock.put).toHaveBeenCalledWith("/accounting/quotes/q1", {
      currency: "USD",
    });

    await deleteQuote("q1");
    expect(apiMock.delete).toHaveBeenCalledWith("/accounting/quotes/q1");
  });

  it("sendQuote / convertQuote POST to the id sub-routes", async () => {
    await sendQuote("q1");
    expect(apiMock.post).toHaveBeenCalledWith("/accounting/quotes/q1/send");
    await convertQuote("q1");
    expect(apiMock.post).toHaveBeenCalledWith("/accounting/quotes/q1/convert");
  });
});

describe("accounting.service > purchase orders", () => {
  it("listPurchaseOrders includes only provided filters", async () => {
    await listPurchaseOrders({ entityId: "e1", status: "awaiting-delivery" });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/purchase-orders?entityId=e1&status=awaiting-delivery",
    );
  });

  it("createPurchaseOrder POSTs the payload", async () => {
    const input = {
      entityId: "e1",
      orderDate: "2026-08-03",
      lines: [{ description: "Laptops", quantity: 2, unitPrice: 1000 }],
    };
    await createPurchaseOrder(input);
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/purchase-orders",
      input,
    );
  });

  it("receive / convert-to-bill / delete hit the right routes", async () => {
    await receivePurchaseOrder("po1", {
      lines: [{ lineId: "l1", qtyReceived: 2 }],
    });
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/purchase-orders/po1/receive",
      { lines: [{ lineId: "l1", qtyReceived: 2 }] },
    );

    await convertPoToBill("po1");
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/purchase-orders/po1/convert-to-bill",
    );

    await deletePurchaseOrder("po1");
    expect(apiMock.delete).toHaveBeenCalledWith(
      "/accounting/purchase-orders/po1",
    );
  });
});

describe("accounting.service > tax filing registers (M9)", () => {
  it("getTaxRegisters GETs the entity + period-scoped endpoint", async () => {
    await getTaxRegisters({
      entityId: "e1",
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/reports/tax-registers?entityId=e1&startDate=2026-08-01&endDate=2026-08-31",
    );
  });
});

describe("accounting.service > bank reconciliation (M7)", () => {
  it("getReconciliationSummary GETs the entity + statement-scoped endpoint", async () => {
    await getReconciliationSummary({
      entityId: "e1",
      statementBalance: 1200,
    });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/bank/reconciliation-summary?entityId=e1&statementBalance=1200",
    );
  });

  it("reconcile / unreconcile POST to the id sub-routes", async () => {
    await reconcileBankTransaction("bt1");
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/bank/bt1/reconcile",
      {},
    );

    await unreconcileBankTransaction("bt1");
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/bank/bt1/unreconcile",
    );
  });
});

describe("accounting.service > tax filings (M9)", () => {
  it("listTaxFilings GETs the entity + year-scoped endpoint", async () => {
    await listTaxFilings({ entityId: "e1", year: 2026 });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/tax-filings?entityId=e1&year=2026",
    );
  });

  it("fileTaxPeriod / reopenTaxPeriod POST their payloads", async () => {
    await fileTaxPeriod({ entityId: "e1", year: 2026, month: 8 });
    expect(apiMock.post).toHaveBeenCalledWith("/accounting/tax-filings/file", {
      entityId: "e1",
      year: 2026,
      month: 8,
    });

    await reopenTaxPeriod({ entityId: "e1", year: 2026, month: 8 });
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/tax-filings/reopen",
      { entityId: "e1", year: 2026, month: 8 },
    );
  });
});

describe("accounting.service > audit log (M12)", () => {
  it("listAccountingAuditLogs only includes provided filters", async () => {
    await listAccountingAuditLogs({ resource: "invoice", limit: 50 });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/audit-log?resource=invoice&limit=50",
    );
  });

  it("listAccountingAuditLogs with no filters hits the bare endpoint", async () => {
    await listAccountingAuditLogs({});
    expect(apiMock.get).toHaveBeenCalledWith("/accounting/audit-log");
  });
});

describe("accounting.service > customer advances (M3)", () => {
  it("listCustomerAdvances GETs the entity-scoped endpoint", async () => {
    await listCustomerAdvances({ entityId: "e1", status: "open" });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/customer-advances?entityId=e1&status=open",
    );
  });

  it("applyCustomerAdvance POSTs the apply payload", async () => {
    await applyCustomerAdvance("adv1", { invoiceId: "inv1", amount: 200 });
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/customer-advances/adv1/apply",
      { invoiceId: "inv1", amount: 200 },
    );
  });
});

describe("accounting.service > aging summary (M11)", () => {
  it("getAgingSummary GETs the entity + as-of-scoped endpoint", async () => {
    await getAgingSummary({ entityId: "e1", asOf: "2026-08-04" });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/aging-summary?entityId=e1&asOf=2026-08-04",
    );
  });

  it("getAgingSummary omits an unset as-of", async () => {
    await getAgingSummary({ entityId: "e1" });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/aging-summary?entityId=e1",
    );
  });
});

describe("accounting.service > global search", () => {
  it("searchAccounting GETs the term-scoped endpoint (no signal)", async () => {
    await searchAccounting({ q: "acme" });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/search?q=acme",
      undefined,
    );
  });

  it("searchAccounting includes entityId + limit, and forwards an abort signal", async () => {
    const controller = new AbortController();
    await searchAccounting(
      { q: "acme", entityId: "e1", limit: 10 },
      controller.signal,
    );
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/search?q=acme&entityId=e1&limit=10",
      { signal: controller.signal },
    );
  });
});

describe("accounting.service > smart bank matching", () => {
  it("getBankMatchSuggestions GETs the entity-scoped endpoint", async () => {
    await getBankMatchSuggestions("e1");
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/bank/match-suggestions?entityId=e1",
    );
  });

  it("settleBankTransaction POSTs the settle payload to the id route", async () => {
    const input = {
      invoiceId: "inv1",
      bankAccountId: "ba1",
      date: "2026-08-04",
      method: "bank-transfer",
    };
    await settleBankTransaction("tx1", input);
    expect(apiMock.post).toHaveBeenCalledWith(
      "/accounting/bank/tx1/settle",
      input,
    );
  });
});

describe("accounting.service > expense summary", () => {
  it("getExpenseSummary GETs the entity + year + month-scoped endpoint", async () => {
    await getExpenseSummary({ entityId: "e1", year: 2026, month: 3 });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/expense-summary?entityId=e1&year=2026&month=3",
    );
  });

  it("getExpenseSummary omits month for a whole-year roll-up", async () => {
    await getExpenseSummary({ entityId: "e1", year: 2026 });
    expect(apiMock.get).toHaveBeenCalledWith(
      "/accounting/expense-summary?entityId=e1&year=2026",
    );
  });
});
