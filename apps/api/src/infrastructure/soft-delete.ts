export function excludeDeleted(
  deletedAtField: string = "deletedAt",
): Record<string, null> {
  return { [deletedAtField]: null };
}

export function softDeleteUpdate(
  deletedAtField: string = "deletedAt",
): Record<string, Date> {
  return { [deletedAtField]: new Date() };
}

export function restoreUpdate(
  deletedAtField: string = "deletedAt",
): Record<string, null> {
  return { [deletedAtField]: null };
}

export class SoftDeleteQuery<Field extends string = "deletedAt"> {
  constructor(private readonly field: Field = "deletedAt" as Field) {}

  excludeDeleted(): Record<Field, null> {
    return { [this.field]: null } as Record<Field, null>;
  }

  onlyDeleted(): Record<Field, { not: null }> {
    return { [this.field]: { not: null } } as Record<Field, { not: null }>;
  }

  softDelete(): Record<Field, Date> {
    return { [this.field]: new Date() } as Record<Field, Date>;
  }

  restore(): Record<Field, null> {
    return { [this.field]: null } as Record<Field, null>;
  }
}
