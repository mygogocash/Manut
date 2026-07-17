export interface AuthenticationEligibleUser {
  isActive: boolean;
  deletedAt: Date | null;
}

/** Local lifecycle state is authoritative even when a provider session exists. */
export function isAuthenticationEligible(
  user: AuthenticationEligibleUser,
): boolean {
  return user.isActive && user.deletedAt === null;
}
