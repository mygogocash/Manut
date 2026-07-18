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

export interface ListLeaveRequestFilters {
  employeeId: string;
  status?: string;
}

export interface LeaveStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findMany(
    filters: ListLeaveRequestFilters,
    page: number,
    limit: number,
  ): Promise<{ data: LeaveRequestRecord[]; total: number }>;
}
