export interface PayrollRunRecord {
  id: string;
  period: string;
  status: string;
  totalGross: string;
  totalNet: string;
  totalTax: string;
  createdAt: string;
  entityId: string;
  entityName: string;
  runnerId: string;
  runnerName: string;
  approverId: string | null;
  approverName: string | null;
}

export interface ListPayrollRunFilters {
  employeeIdScope: string;
  status?: string;
  period?: string;
  entityId?: string;
}

export interface PayrollStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findMany(
    filters: ListPayrollRunFilters,
    page: number,
    limit: number,
  ): Promise<{ data: PayrollRunRecord[]; total: number }>;
}
