"use client";

import { isLocale } from "@nexora/i18n";
import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";

import i18n from "@/i18n/config";

/** localStorage key for the persisted UI language preference. */
export const LOCALE_STORAGE_KEY = "manut.locale";

/**
 * Applies the stored language preference on the client after mount (so the
 * first paint still matches the server's DEFAULT_LOCALE render), and keeps
 * <html lang> in sync so screen readers and hyphenation follow the language.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (isLocale(stored) && stored !== i18n.language) {
        void i18n.changeLanguage(stored);
      }
    } catch {
      // localStorage can throw in private mode; the default locale still works.
    }
  }, []);

  useEffect(() => {
    const onChange = (lng: string) => {
      document.documentElement.lang = lng;
    };
    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
