// Soft-delete helpers. `deletedAtField` is a runtime column name (default
// "deletedAt"); a computed string key already types as a Record, so no cast
// is needed.

export function excludeDeleted(
  deletedAtField: string = "deletedAt",
): Record<string, unknown> {
  return { [deletedAtField]: null };
}

export function softDeleteUpdate(
  deletedAtField: string = "deletedAt",
): Record<string, unknown> {
  return { [deletedAtField]: new Date() };
}

export function restoreUpdate(
  deletedAtField: string = "deletedAt",
): Record<string, unknown> {
  return { [deletedAtField]: null };
}

export class SoftDeleteQuery {
  constructor(private field: string = "deletedAt") {}

  excludeDeleted(): Record<string, unknown> {
    return { [this.field]: null };
  }

  onlyDeleted(): Record<string, unknown> {
    return { [this.field]: { not: null } };
  }

  softDelete(): Record<string, unknown> {
    return { [this.field]: new Date() };
  }

  restore(): Record<string, unknown> {
    return { [this.field]: null };
  }
}
