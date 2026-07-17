import {
  DEFAULT_LOCAL_PREFERENCES,
  parseLocalPreferences,
  type LocalPreferences,
} from "@manut/app-core";

// Native keeps an in-memory preferences bag until a SecureStore-backed
// persistence adapter is wired for notification/theme prefs.
let memoryPreferences: LocalPreferences = DEFAULT_LOCAL_PREFERENCES;

export function loadLocalPreferences(): LocalPreferences {
  return parseLocalPreferences(memoryPreferences);
}

export function saveLocalPreferences(preferences: LocalPreferences): void {
  memoryPreferences = preferences;
}
