import { redirect } from "next/navigation";

// Magic-link sign-in is disabled during phased rollout. The route is
// preserved (rather than deleted) so any bookmarked URL or in-flight
// email link lands somewhere sane instead of a 404. To re-enable:
// restore the form-rendering implementation from git history (the
// component lives at @/components/auth/auth-email-form mode="magic-link")
// and broaden MAGIC_LINK_ALLOWED_ROLES on the backend.
export default function MagicLinkPage(): never {
  redirect("/sign-in");
}
