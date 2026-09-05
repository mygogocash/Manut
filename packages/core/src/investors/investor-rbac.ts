import { PERMISSIONS } from "@nexora/contracts";

export function canReadAllInvestors(permissions: string[]): boolean {
  return permissions.includes(PERMISSIONS.INVESTORS_READ_ALL);
}

export function investorAddedByScope(userId: string, permissions: string[]): string | undefined {
  return canReadAllInvestors(permissions) ? undefined : userId;
}

export function investorOwnerScope(userId: string, permissions: string[]): string[] | undefined {
  return canReadAllInvestors(permissions) ? undefined : [userId];
}
