import {
  DEFAULT_LOCAL_PREFERENCES,
  parseLocalPreferences,
  type LocalPreferences,
} from "@manut/app-core";

const STORAGE_KEY = "manut_preferences";

export function loadLocalPreferences(): LocalPreferences {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCAL_PREFERENCES;
    return parseLocalPreferences(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_LOCAL_PREFERENCES;
  }
}

export function saveLocalPreferences(preferences: LocalPreferences): void {
  globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(preferences));
}
