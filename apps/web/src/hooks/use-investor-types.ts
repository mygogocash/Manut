"use client";

import { useCallback, useEffect, useState } from "react";

import {
  type InvestorTypeOption,
  listInvestorTypes,
  prettifyTypeKey,
} from "@/services/investor-type.service";

// Fetches the configurable investor type list once and exposes a label
// resolver (dynamic label → prettified key fallback for legacy keys).
export function useInvestorTypes() {
  const [types, setTypes] = useState<InvestorTypeOption[]>([]);

  const refresh = useCallback(async () => {
    try {
      const res = await listInvestorTypes();
      setTypes(res.data);
    } catch {
      // Non-fatal: pickers fall back to whatever's loaded; labels
      // degrade to the prettified key.
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const typeLabel = useCallback(
    (key: string) =>
      types.find((t) => t.key === key)?.label ?? prettifyTypeKey(key),
    [types],
  );

  return { types, typeLabel, refresh };
}
