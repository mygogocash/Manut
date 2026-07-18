export interface LeaveRequestRecord {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  leaveTypeCode: string;
  leaveTypeCategory: string;
  startDate: string;
  endDate: string;
  durationType: string;
  halfDayPeriod: string | null;
  days: string;
  reason: string | null;
  status: string;
  createdAt: string;
}

export interface LeaveRequestDetailRecord extends LeaveRequestRecord {
  currentStepOrder: number | null;
  delegatedToId: string | null;
  source: "entitled" | "carried";
  leaveTypeDaysPerYear: number;
  employeeReportingTo: string | null;
}

export interface LeaveTypeRecord {
  id: string;
  name: string;
  code: string;
  category: string;
  entityId: string | null;
  daysPerYear: number;
  requiresApproval: boolean;
  isActive: boolean;
}

export interface LeaveUserRecord {
  id: string;
  entityId: string | null;
  isActive: boolean;
  reportingTo: string | null;
}

export interface LeaveBalanceRecord {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  entitled: number;
  used: number;
  carried: number;
  carriedUsed: number;
  carriedExpiry: string | null;
  adjustment: number;
}

export interface LeaveApprovalStepRecord {
  id: string;
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
  skipWhenSubmitterIds: string[];
  onlyWhenSubmitterIds: string[];
  isActive: boolean;
}

export interface LeaveApprovalDecisionRecord {
  id: string;
  leaveRequestId: string;
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
  status: string;
}

export interface LeavePolicyApproverRecord {
  approverType: string;
  approverUserId: string | null;
}

export interface ListLeaveRequestFilters {
  employeeId: string;
  status?: string;
}

export interface CreateLeaveRequestStoreInput {
  employeeId: string;
  leaveTypeId: string;
  entityId: string | null;
  startDate: string;
  endDate: string;
  days: number;
  durationType: "full_day" | "half_day";
  halfDayPeriod: "am" | "pm" | null;
  reason?: string;
  source: "entitled" | "carried";
  defaultEntitlement: number;
  requiresApproval: boolean;
  approvalDescription: string;
}

export interface LeaveApprovalDecisionRow {
  order: number;
  name: string;
  approverType: string;
  approverUserId: string | null;
}

export interface ApproveLeaveStepInput {
  requestId: string;
  approverId: string;
  currentDecisionId: string | null;
  expectedStepOrder: number | null;
  nextStepOrder: number | null;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  days: number;
  source: "entitled" | "carried";
  defaultEntitlement: number;
  description: string;
}

export interface RejectLeaveStepInput {
  requestId: string;
  approverId: string;
  currentDecisionId: string | null;
  expectedStepOrder: number | null;
  reason: string;
}

export interface CancelLeaveInput {
  requestId: string;
  expectedStatus: "pending" | "approved" | "pending_cancellation";
  approvedBy?: string;
  refund: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    days: number;
    source: "entitled" | "carried";
    defaultEntitlement: number;
    description: string;
  } | null;
}

export interface LeaveStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findMany(
    filters: ListLeaveRequestFilters,
    page: number,
    limit: number,
  ): Promise<{ data: LeaveRequestRecord[]; total: number }>;
  findLeaveTypeById(id: string): Promise<LeaveTypeRecord | null>;
  findUserById(userId: string): Promise<LeaveUserRecord | null>;
  findBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
  ): Promise<LeaveBalanceRecord | null>;
  checkOverlap(
    employeeId: string,
    startDate: string,
    endDate: string,
  ): Promise<boolean>;
  createRequest(input: CreateLeaveRequestStoreInput): Promise<LeaveRequestRecord>;
  findActiveApprovalSteps(): Promise<LeaveApprovalStepRecord[]>;
  initializeApprovalChain(
    leaveRequestId: string,
    rows: LeaveApprovalDecisionRow[],
  ): Promise<boolean>;
  findRequestById(id: string): Promise<LeaveRequestDetailRecord | null>;
  findDecisions(leaveRequestId: string): Promise<LeaveApprovalDecisionRecord[]>;
  findPolicyApprovers(leaveTypeId: string): Promise<LeavePolicyApproverRecord[]>;
  approveRequestStep(
    input: ApproveLeaveStepInput,
  ): Promise<LeaveRequestRecord | null>;
  rejectRequestStep(
    input: RejectLeaveStepInput,
  ): Promise<LeaveRequestRecord | null>;
  cancelRequest(input: CancelLeaveInput): Promise<LeaveRequestRecord | null>;
}
