export interface DealRecord {
  id: string;
  company: string;
  contact: string | null;
  value: number;
  stage: string;
  probability: number;
  type: string | null;
  country: string | null;
  closeDate: string | null;
  notes: string | null;
  ownerId: string;
  ownerName: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ListDealsFilters {
  search?: string;
  stage?: string;
  type?: string;
  ownerScope?: string[];
}

export interface CreateDealStoreInput {
  company: string;
  contact?: string;
  value: number;
  stage: string;
  probability: number;
  type?: string;
  country?: string;
  partnerId?: string;
  closeDate?: string;
  notes?: string;
  ownerId: string;
}

export interface UpdateDealStoreInput {
  company?: string;
  contact?: string | null;
  value?: number;
  stage?: string;
  probability?: number;
  type?: string | null;
  country?: string | null;
  partnerId?: string | null;
  closeDate?: string | null;
  notes?: string | null;
}

export interface DealPipelineStageRecord {
  stage: string;
  count: number;
  totalValue: number;
}

export interface DealsStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findMany(
    filters: ListDealsFilters,
    page: number,
    limit: number,
  ): Promise<{ data: DealRecord[]; total: number }>;
  findById(id: string): Promise<DealRecord | null>;
  create(input: CreateDealStoreInput): Promise<DealRecord>;
  update(id: string, input: UpdateDealStoreInput): Promise<DealRecord>;
  pipelineSummary(ownerScope?: string[]): Promise<DealPipelineStageRecord[]>;
}
