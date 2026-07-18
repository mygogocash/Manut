export interface VisaDocumentRecord {
  name: string;
  category: string;
}

export interface VisaListRecord {
  id: string;
  holderType: string;
  holderName: string | null;
  holderRelationship: string | null;
  visaType: string;
  country: string;
  nationality: string | null;
  issueDate: string | null;
  expiryDate: string;
  workPermitExpiryDate: string | null;
  status: string;
  documentUrl: string | null;
  documents: VisaDocumentRecord[];
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  entityId: string | null;
  entityName: string | null;
}

export interface ListVisaFilters {
  employeeId: string;
  status?: string;
  search?: string;
}

export interface VisaStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findMany(
    filters: ListVisaFilters,
    page: number,
    limit: number,
  ): Promise<{ data: VisaListRecord[]; total: number }>;
}
