export interface SoftDeleteQueryOptions {
  field?: string;
}

export interface SoftDeleteResponse<T> {
  data: T;
}

export interface BulkSoftDeleteOptions {
  ids: string[];
  deletedAtField?: string;
}

export interface RestoreOptions {
  id: string;
  deletedAtField?: string;
}

export type WithSoftDelete<T> = T & { deletedAt?: Date | null };

export interface BaseSoftDeleteRepository<T> {
  softDelete(id: string): Promise<T>;
  softDeleteMany(ids: string[]): Promise<void>;
  softDeleteByFilter(filter: Record<string, unknown>): Promise<number>;
  restore(id: string): Promise<T>;
  restoreMany(ids: string[]): Promise<number>;
  permanentDelete(id: string): Promise<T>;
  permanentDeleteMany(ids: string[]): Promise<number>;
  countActive(filter?: Record<string, unknown>): Promise<number>;
  countDeleted(filter?: Record<string, unknown>): Promise<number>;
}

export interface BaseSoftDeleteService<T, CreateInput, UpdateInput> {
  create(input: CreateInput): Promise<T>;
  update(id: string, input: UpdateInput): Promise<T>;
  remove(id: string): Promise<T>;
  restore(id: string): Promise<T>;
  permanentDelete(id: string): Promise<T>;
}
