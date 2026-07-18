export interface CashAdvanceItemRecord {
  id: string;
  description: string;
}

export interface CashAdvanceRequestRecord {
  id: string;
  requestNumber: number;
  requestDate: string;
  payoutMode: string;
  currency: string;
  status: string;
  requestedTotal: number;
  approvedTotal: number;
  rejectReason: string | null;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  entityId: string | null;
  entityName: string | null;
  items: CashAdvanceItemRecord[];
  bankName: string | null;
  bankAccountNo: string | null;
  notes: string | null;
}

export interface ListCashAdvanceFilters {
  employeeId: string;
  status?: string;
}

export interface CreateCashAdvanceStoreInput {
  employeeId: string;
  entityId?: string;
  payoutMode: string;
  bankName?: string;
  bankAccountNo?: string;
  currency: string;
  notes?: string;
  items: Array<{ description: string; requestedAmount: number }>;
}

export interface CashAdvanceStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findMany(
    filters: ListCashAdvanceFilters,
    page: number,
    limit: number,
  ): Promise<{ data: CashAdvanceRequestRecord[]; total: number }>;
  create(input: CreateCashAdvanceStoreInput): Promise<CashAdvanceRequestRecord>;
}
