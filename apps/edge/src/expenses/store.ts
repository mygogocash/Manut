export interface ExpenseReportRecord {
  id: string;
  period: string;
  title: string;
  category: string;
  status: string;
  currentStepOrder: number | null;
  submittedAt: string | Date | null;
  approvedAt: string | Date | null;
  rejectReason: string | null;
  reimbursedAt: string | Date | null;
  approvedTotal: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employeeDepartment: string | null;
  entityId: string;
  entityName: string;
  expenseCount: number;
  totalAmount: number;
  totalCurrency: string;
  converted: boolean;
  missingRates: string[];
}

export interface ListExpenseReportFilters {
  employeeId?: string;
  reportIds?: string[];
  status?: string;
  period?: string;
}

export interface CreateExpenseReportStoreInput {
  employeeId: string;
  entityId: string;
  period: string;
  title: string;
  category: string;
  notes?: string;
}

export interface ExpenseLineRecord {
  id: string;
  reportId: string;
  employeeId: string;
  description: string;
  amount: string;
  currency: string;
  date: string;
  status: string;
  categoryId: string | null;
  notes: string | null;
  receiptUrl: string | null;
}

export interface ExpenseLineFxRecord {
  id: string;
  amount: number;
  currency: string;
  date: string;
  categoryId: string | null;
}

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  receiptRequired: boolean;
  spendingLimit: number | null;
  isAllowance: boolean;
}

export interface AddExpenseLineStoreInput {
  reportId: string;
  employeeId: string;
  entityId: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  categoryId?: string;
  travelRequestId?: string;
  notes?: string;
  receiptUrl?: string | null;
}

export interface UpdateExpenseLineStoreInput {
  description?: string;
  amount?: number;
  currency?: string;
  date?: string;
  categoryId?: string | null;
  notes?: string | null;
  receiptUrl?: string | null;
}

export interface ExpenseApprovalStepRecord {
  id: string;
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
  skipWhenSubmitterIds: string[];
  onlyWhenSubmitterIds: string[];
  categoryFilter: string[];
  amountMinBaht: number | null;
  amountMaxBaht: number | null;
  isActive: boolean;
}

export interface ExpenseApprovalDecisionRecord {
  id: string;
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
  status: string;
  approvedAmount: number | null;
}

export interface ExpenseApprovalDecisionRow {
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
}

export interface ExpensesStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findRegistered(query: {
    bucket: string;
    path: string;
    purpose: string;
    uploadedBy?: string;
    linkedTo?: string;
    linkedId?: string;
  }): Promise<{ id: string } | null>;
  findMany(
    filters: ListExpenseReportFilters,
    page: number,
    limit: number,
  ): Promise<{ data: ExpenseReportRecord[]; total: number }>;
  findById(id: string): Promise<ExpenseReportRecord | null>;
  create(input: CreateExpenseReportStoreInput): Promise<ExpenseReportRecord>;
  findCategoryById(id: string): Promise<ExpenseCategoryRecord | null>;
  findLineById(id: string): Promise<ExpenseLineRecord | null>;
  findLinesForReport(reportId: string): Promise<ExpenseLineFxRecord[]>;
  addLine(input: AddExpenseLineStoreInput): Promise<ExpenseLineRecord>;
  updateLine(
    id: string,
    input: UpdateExpenseLineStoreInput,
  ): Promise<ExpenseLineRecord>;
  softDeleteLine(id: string): Promise<void>;
  findPendingForMeReportIds(userId: string): Promise<string[]>;
  findActiveApprovalSteps(): Promise<ExpenseApprovalStepRecord[]>;
  findDecisions(reportId: string): Promise<ExpenseApprovalDecisionRecord[]>;
  findManagerChain(userId: string): Promise<{
    l1UserId: string | null;
    l2UserId: string | null;
  }>;
  findEmployeeReportingTo(employeeId: string): Promise<string | null>;
  findCategoriesAllowance(
    categoryIds: string[],
  ): Promise<Array<{ id: string; isAllowance: boolean }>>;
  findExchangeRate(
    baseCurrency: string,
    currency: string,
    asOf?: Date,
  ): Promise<number | null>;
  snapshotDecisions(
    id: string,
    rows: ExpenseApprovalDecisionRow[],
  ): Promise<void>;
  submitWithDecisions(
    id: string,
    rows: ExpenseApprovalDecisionRow[],
    opts?: { category?: string },
  ): Promise<ExpenseReportRecord>;
  finaliseAllowance(id: string, actorId: string): Promise<ExpenseReportRecord>;
  approveStep(input: {
    reportId: string;
    decisionId: string;
    approverId: string;
    isFinalStep: boolean;
    nextStepOrder: number | null;
    approvedAmount: number | null;
    notes?: string;
    finalApprovedTotal: number | null;
  }): Promise<ExpenseReportRecord>;
  rejectStep(input: {
    reportId: string;
    decisionId: string | null;
    approverId: string;
    reason: string;
  }): Promise<ExpenseReportRecord>;
}
