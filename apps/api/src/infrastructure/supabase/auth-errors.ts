/** Supabase Auth admin API returns an error when the UUID is not a known auth user. */
export function isSupabaseAuthUserMissingError(
  error: { message?: string; status?: number } | null | undefined,
): boolean {
  if (!error) return false;
  const msg = (error.message ?? "").toLowerCase();
  return (
    error.status === 404 ||
    msg.includes("not found") ||
    msg.includes("user not found") ||
    msg.includes("no user found") ||
    msg.includes("database error finding user")
  );
}
