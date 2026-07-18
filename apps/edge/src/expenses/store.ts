export interface ExpenseReportRecord {
  id: string;
  period: string;
  title: string;
  category: string;
  status: string;
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
  employeeId: string;
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

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  receiptRequired: boolean;
  spendingLimit: number | null;
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
  addLine(input: AddExpenseLineStoreInput): Promise<ExpenseLineRecord>;
  updateLine(
    id: string,
    input: UpdateExpenseLineStoreInput,
  ): Promise<ExpenseLineRecord>;
  softDeleteLine(id: string): Promise<void>;
}
