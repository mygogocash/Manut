import { ConfirmModalProvider, PromptModalProvider } from '@affine/component';
import { ProviderComposer } from '@affine/component/provider-composer';
import { ThemeProvider } from '@affine/core/components/theme-provider';
import {
  EditorSettingService,
  fontStyleOptions,
} from '@affine/core/modules/editor-setting';
import { useLiveData, useService } from '@toeverything/infra';
import type { createStore } from 'jotai';
import { Provider } from 'jotai';
import type { PropsWithChildren } from 'react';
import { useEffect, useMemo } from 'react';

import { useImageAntialiasing } from '../hooks/use-image-antialiasing';

export type AffineContextProps = PropsWithChildren<{
  store?: ReturnType<typeof createStore>;
}>;

/**
 * Mirrors the user's editor font-family setting onto `<html>` so the app
 * chrome (sidebar, settings dialog, menus) picks the same font as the doc
 * content. Without this, `--affine-font-family` is only set on the editor
 * Slot, leaving the rest of the UI on the default sans stack.
 *
 * Tradeoff is intentional: setting the variable at the root means every
 * styled-component that resolves to `var(--affine-font-family)` follows the
 * user's choice — including monospace, which can look unusual in chrome,
 * but matches what the user explicitly picked.
 */
function useGlobalFontFamilySync() {
  const editorSetting = useService(EditorSettingService).editorSetting;
  const settings = useLiveData(
    editorSetting.settings$.selector(s => ({
      fontFamily: s.fontFamily,
      customFontFamily: s.customFontFamily,
    }))
  );

  useEffect(() => {
    const fontStyle = fontStyleOptions.find(o => o.key === settings.fontFamily);
    if (!fontStyle) return;
    const value =
      settings.customFontFamily && fontStyle.key === 'Custom'
        ? `${settings.customFontFamily}, ${fontStyle.value}`
        : fontStyle.value;
    const root = document.documentElement;
    const previous = root.style.getPropertyValue('--affine-font-family');
    root.style.setProperty('--affine-font-family', value);
    return () => {
      // restore previous value on unmount so stories / embed contexts that
      // mount AffineContext multiple times don't leave stray overrides.
      if (previous) {
        root.style.setProperty('--affine-font-family', previous);
      } else {
        root.style.removeProperty('--affine-font-family');
      }
    };
  }, [settings.fontFamily, settings.customFontFamily]);
}

export function AffineContext(props: AffineContextProps) {
  useImageAntialiasing();
  useGlobalFontFamilySync();
  return (
    <ProviderComposer
      contexts={useMemo(
        () =>
          [
            <Provider key="JotaiProvider" store={props.store} />,
            <ThemeProvider key="ThemeProvider" />,
            <ConfirmModalProvider key="ConfirmModalProvider" />,
            <PromptModalProvider key="PromptModalProvider" />,
          ].filter(Boolean),
        [props.store]
      )}
    >
      {props.children}
    </ProviderComposer>
  );
}
