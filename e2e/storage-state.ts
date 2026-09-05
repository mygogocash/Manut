/**
 * Where the authenticated Playwright session is written.
 *
 * Its own module because `playwright.config.ts` needs the path and importing it
 * from `auth.setup.ts` would execute that file's `setup()` call while the config
 * is being loaded — Playwright rejects that with "did not expect test() to be
 * called here".
 *
 * The file itself holds live session cookies and is gitignored.
 */
export const STORAGE_STATE = "playwright/.auth/user.json";
