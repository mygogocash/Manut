const STORAGE_KEY = "intranet.session.v1";

export type ExpoSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
};

type PersistMode = "local" | "session";

let memory: ExpoSession | null = null;
let persistMode: PersistMode = "local";

function storageFor(mode: PersistMode): Storage | null {
  if (typeof globalThis === "undefined") return null;
  const g = globalThis as { localStorage?: Storage; sessionStorage?: Storage };
  return (mode === "session" ? g.sessionStorage : g.localStorage) ?? null;
}

function parseSession(raw: string | null): ExpoSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ExpoSession>;
    if (typeof parsed.accessToken !== "string" || typeof parsed.refreshToken !== "string") {
      return null;
    }
    return {
      accessToken: parsed.accessToken,
      refreshToken: parsed.refreshToken,
      expiresIn: parsed.expiresIn,
    };
  } catch {
    return null;
  }
}

export function loadSession(): ExpoSession | null {
  if (memory) return memory;
  const fromLocal = parseSession(storageFor("local")?.getItem(STORAGE_KEY) ?? null);
  if (fromLocal) {
    persistMode = "local";
    memory = fromLocal;
    return memory;
  }
  const fromSession = parseSession(storageFor("session")?.getItem(STORAGE_KEY) ?? null);
  if (fromSession) {
    persistMode = "session";
    memory = fromSession;
    return memory;
  }
  return null;
}

/** `persist=false` keeps the session for this tab only (Remember me unchecked). */
export function saveSession(session: ExpoSession, persist = true): void {
  memory = session;
  persistMode = persist ? "local" : "session";
  try {
    storageFor(persistMode)?.setItem(STORAGE_KEY, JSON.stringify(session));
    storageFor(persist ? "session" : "local")?.removeItem(STORAGE_KEY);
  } catch {
    // Private browsing / quota — memory still works for this tab.
  }
}

export function clearSession(): void {
  memory = null;
  persistMode = "local";
  try {
    storageFor("local")?.removeItem(STORAGE_KEY);
    storageFor("session")?.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isSessionPersistent(): boolean {
  loadSession();
  return persistMode === "local";
}

export function getAccessToken(): string | null {
  return loadSession()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return loadSession()?.refreshToken ?? null;
}

export function resetSessionForTests(): void {
  memory = null;
  persistMode = "local";
}
