export interface CashAdvanceItemRecord {
  id: string;
  description: string;
  receiptUrl: string | null;
  approvedAmount: number;
  requestedAmount: number;
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
  currentStepOrder: number | null;
}

export interface CashAdvanceApprovalStepRecord {
  id: string;
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
  skipWhenSubmitterIds: string[];
  onlyWhenSubmitterIds: string[];
  payoutModeFilter: string[];
  amountMin: number | null;
  amountMax: number | null;
  isActive: boolean;
}

export interface CashAdvanceApprovalDecisionRow {
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
}

export interface CashAdvanceApprovalDecisionRecord {
  id: string;
  requestId: string;
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
  status: string;
}

export interface CashAdvanceUserRecord {
  id: string;
  reportingTo: string | null;
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
  items: Array<{
    description: string;
    requestedAmount: number;
    categoryId?: string | null;
    receiptUrl?: string | null;
  }>;
}

export interface UpdateCashAdvanceStoreInput {
  entityId?: string | null;
  payoutMode?: string;
  bankName?: string | null;
  bankAccountNo?: string | null;
  currency?: string;
  notes?: string | null;
  items?: Array<{
    description: string;
    requestedAmount: number;
    categoryId?: string | null;
    receiptUrl?: string | null;
  }>;
}

export interface CashAdvanceStore {
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
    filters: ListCashAdvanceFilters,
    page: number,
    limit: number,
  ): Promise<{ data: CashAdvanceRequestRecord[]; total: number }>;
  create(input: CreateCashAdvanceStoreInput): Promise<CashAdvanceRequestRecord>;
  update(
    id: string,
    input: UpdateCashAdvanceStoreInput,
  ): Promise<CashAdvanceRequestRecord>;
  findById(id: string): Promise<CashAdvanceRequestRecord | null>;
  findActiveApprovalSteps(): Promise<CashAdvanceApprovalStepRecord[]>;
  submitWithDecisions(
    id: string,
    rows: CashAdvanceApprovalDecisionRow[],
  ): Promise<CashAdvanceRequestRecord>;
  findUserById(userId: string): Promise<CashAdvanceUserRecord | null>;
  findDecisions(
    requestId: string,
  ): Promise<CashAdvanceApprovalDecisionRecord[]>;
  createDecisions(
    requestId: string,
    rows: CashAdvanceApprovalDecisionRow[],
  ): Promise<void>;
  updateDecision(
    id: string,
    data: {
      status: string;
      decidedById: string;
      notes?: string;
    },
  ): Promise<void>;
  updateApprovedAmounts(
    items: Array<{ id: string; approvedAmount: number }>,
  ): Promise<void>;
  advanceStep(
    id: string,
    nextStepOrder: number,
  ): Promise<CashAdvanceRequestRecord>;
  finalizeApproval(
    id: string,
    data: {
      approvedTotal: number;
      approvedById: string;
    },
  ): Promise<CashAdvanceRequestRecord>;
  markRejected(
    id: string,
    data: {
      rejectReason: string;
      approvedById: string;
    },
  ): Promise<CashAdvanceRequestRecord>;
  markDisbursedIfApproved(
    id: string,
    data: {
      proofUploadId: string;
      proofUrl: string;
      uploadedBy: string;
    },
  ): Promise<CashAdvanceRequestRecord | null>;
  markClearedIfDisbursed(id: string): Promise<CashAdvanceRequestRecord | null>;
}
