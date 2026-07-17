import { Router } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import { logger } from "@/common/utils/logger";
import { getRequiredParam } from "@/common/utils/params";
import {
  authenticate,
  requireActive,
  requirePermission,
} from "@/core/guards/auth.guard";
import { asyncHandler } from "@/core/middleware/async-handler";
import { logAudit } from "@/infrastructure/audit/audit.service";
import { accountingService } from "@/modules/accounting/accounting.service";
import {
  accountQuerySchema,
  bankTransactionQuerySchema,
  bulkDeleteJournalsSchema,
  createAccountSchema,
  createInvoiceSchema,
  createJournalSchema,
  importAccountsSchema,
  importBankStatementSchema,
  importJournalsSchema,
  invoiceQuerySchema,
  journalQuerySchema,
  updateAccountSchema,
  updateInvoiceSchema,
  updateJournalSchema,
} from "@/modules/accounting/accounting.validation";

const router = Router();

router.use(authenticate, requireActive);

router.get(
  "/accounts",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const query = accountQuerySchema.parse(req.query);
    const data = await accountingService.listAccounts(query);
    res.json({ data });
  }),
);

router.post(
  "/accounts",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = createAccountSchema.parse(req.body);
    const data = await accountingService.createAccount(input);
    res.status(201).json({ data });
  }),
);

// Bulk import for Chart of Accounts — preview + commit. Frontend parses
// the accounting-export xlsx locally and POSTs canonical rows. Literal
// paths must come before `/accounts/:id` or Express will route
// "/accounts/import" through the :id handler and 404.
router.post(
  "/accounts/import/preview",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = importAccountsSchema.parse(req.body);
    const data = await accountingService.previewAccountImport(input);
    res.json({ data });
  }),
);

router.post(
  "/accounts/import/commit",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = importAccountsSchema.parse(req.body);
    const data = await accountingService.commitAccountImport(input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/accounts/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await accountingService.getAccountById(id);
    res.json({ data });
  }),
);

router.put(
  "/accounts/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateAccountSchema.parse(req.body);
    const data = await accountingService.updateAccount(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/accounts/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await accountingService.deleteAccount(id);
    res.json({ data: { success: true } });
  }),
);

router.get(
  "/journals",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const query = journalQuerySchema.parse(req.query);
    const result = await accountingService.listJournals(query);
    res.json(result);
  }),
);

router.post(
  "/journals",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = createJournalSchema.parse(req.body);
    const data = await accountingService.createJournal(req.user!.id, input);
    res.status(201).json({ data });
  }),
);

// Journal-entry bulk import — preview + commit. Literal paths must come
// before `/journals/:id` or Express routes them through the :id handler.
router.post(
  "/journals/import/preview",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = importJournalsSchema.parse(req.body);
    const data = await accountingService.previewJournalImport(input);
    res.json({ data });
  }),
);

router.post(
  "/journals/import/commit",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = importJournalsSchema.parse(req.body);
    const data = await accountingService.commitJournalImport(
      req.user!.id,
      input,
    );
    res.status(201).json({ data });
  }),
);

// Bulk delete must be a POST (request body) and must come BEFORE
// `/journals/:id` so Express doesn't route the literal segment into the
// param handler.
router.post(
  "/journals/bulk-delete",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    const input = bulkDeleteJournalsSchema.parse(req.body);
    const data = await accountingService.bulkDeleteJournals(input);
    void logAudit({
      action: "bulk_delete",
      resource: "journal_entry",
      details: {
        mode: data.mode,
        deletedCount: data.deletedCount,
        requestedIds: input.ids?.length ?? 0,
        deleteAll: input.all === true,
      },
      req,
    });
    logger.info(
      `Accounting journals bulk-delete: mode=${data.mode}, deleted=${data.deletedCount} by ${req.user!.email}`,
    );
    res.json({ data });
  }),
);

router.get(
  "/journals/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await accountingService.getJournalById(id);
    res.json({ data });
  }),
);

router.put(
  "/journals/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateJournalSchema.parse(req.body);
    const data = await accountingService.updateJournal(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/journals/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await accountingService.deleteJournal(id);
    res.json({ data: { success: true } });
  }),
);

router.put(
  "/journals/:id/approve",
  requirePermission(PERMISSIONS.ACCOUNTING_APPROVE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await accountingService.approveJournal(id, req.user!.id);
    res.json({ data });
  }),
);

router.put(
  "/journals/:id/post",
  requirePermission(PERMISSIONS.ACCOUNTING_POST),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await accountingService.postJournal(id);
    res.json({ data });
  }),
);

router.get(
  "/invoices",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const query = invoiceQuerySchema.parse(req.query);
    const result = await accountingService.listInvoices(query);
    res.json(result);
  }),
);

router.post(
  "/invoices",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const input = createInvoiceSchema.parse(req.body);
    const data = await accountingService.createInvoice(input);
    res.status(201).json({ data });
  }),
);

router.get(
  "/invoices/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const data = await accountingService.getInvoiceById(id);
    res.json({ data });
  }),
);

router.put(
  "/invoices/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_CREATE),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    const input = updateInvoiceSchema.parse(req.body);
    const data = await accountingService.updateInvoice(id, input);
    res.json({ data });
  }),
);

router.delete(
  "/invoices/:id",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    const id = getRequiredParam(req.params, "id");
    await accountingService.deleteInvoice(id);
    res.json({ data: { success: true } });
  }),
);

router.get(
  "/bank",
  requirePermission(PERMISSIONS.ACCOUNTING_READ),
  asyncHandler(async (req, res) => {
    const query = bankTransactionQuerySchema.parse(req.query);
    const result = await accountingService.listBankTransactions(query);
    res.json(result);
  }),
);

router.post(
  "/bank/import",
  requirePermission(PERMISSIONS.ACCOUNTING_ADMIN),
  asyncHandler(async (req, res) => {
    const input = importBankStatementSchema.parse(req.body);
    const data = await accountingService.importBankStatement(input);
    res.status(201).json({ data });
  }),
);

export default router;
