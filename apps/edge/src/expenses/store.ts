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

export interface ExpensesStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findMany(
    filters: ListExpenseReportFilters,
    page: number,
    limit: number,
  ): Promise<{ data: ExpenseReportRecord[]; total: number }>;
  findById(id: string): Promise<ExpenseReportRecord | null>;
  create(input: CreateExpenseReportStoreInput): Promise<ExpenseReportRecord>;
}
