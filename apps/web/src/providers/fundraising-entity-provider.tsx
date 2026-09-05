"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_FUNDRAISING_ENTITY,
  type FundraisingEntity,
  listFundraisingEntities,
} from "@/services/fundraising-entity.service";

interface FundraisingEntityContextValue {
  entities: FundraisingEntity[];
  entityKey: string;
  setEntityKey: (key: string) => void;
  /** Display label for a stored key; falls back to the raw key. */
  entityLabel: (key: string) => string;
  refresh: () => Promise<void>;
}

const FundraisingEntityContext =
  createContext<FundraisingEntityContextValue | null>(null);

export function FundraisingEntityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [entityKey, setEntityKeyState] = useState(DEFAULT_FUNDRAISING_ENTITY);
  const [ready, setReady] = useState(false);
  const [entities, setEntities] = useState<FundraisingEntity[]>([]);

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("entity");
    if (fromUrl) setEntityKeyState(fromUrl);
    setReady(true);
  }, []);

  const setEntityKey = useCallback((next: string) => {
    setEntityKeyState(next);
    const params = new URLSearchParams(window.location.search);
    params.set("entity", next);
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await listFundraisingEntities();
      setEntities(res.data);
    } catch {
      // Non-fatal: switcher falls back to the last loaded list / default key.
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refresh();
  }, [ready, refresh]);

  useEffect(() => {
    if (!ready || entities.length === 0) return;
    if (!entities.some((e) => e.key === entityKey)) {
      setEntityKey(entities[0]!.key);
    }
  }, [ready, entities, entityKey, setEntityKey]);

  // Resolves a stored key for display. Mirrors `useInvestorTypes().typeLabel`
  // — a key that's been deleted from the catalog degrades to itself rather
  // than rendering blank.
  const entityLabel = useCallback(
    (key: string) => entities.find((e) => e.key === key)?.label ?? key,
    [entities],
  );

  const value = useMemo(
    () => ({ entities, entityKey, setEntityKey, entityLabel, refresh }),
    [entities, entityKey, setEntityKey, entityLabel, refresh],
  );

  if (!ready) return null;

  return (
    <FundraisingEntityContext.Provider value={value}>
      {children}
    </FundraisingEntityContext.Provider>
  );
}

export function useFundraisingEntity(): FundraisingEntityContextValue {
  const ctx = useContext(FundraisingEntityContext);
  if (!ctx) {
    throw new Error(
      "useFundraisingEntity must be used within FundraisingEntityProvider",
    );
  }
  return ctx;
}
