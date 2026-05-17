const SLUG_MAX_LENGTH = 64;

/**
 * Turn a workspace display name into a URL segment (lowercase, hyphenated).
 */
export function slugifyWorkspaceName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH);

  return slug.length > 0 ? slug : 'workspace';
}

export function buildWorkspaceSlugSeed(
  name: string | null | undefined,
  id: string
) {
  const base = slugifyWorkspaceName(name ?? 'workspace');
  const suffix = id.replace(/-/g, '').slice(0, 8);
  return `${base}-${suffix}`.slice(0, SLUG_MAX_LENGTH);
}
