"use client";

import { useTheme } from "next-themes";
import { useEffect } from "react";

/** Landing is designed light-only; lock theme while /welcome is mounted. */
export function ForceLightTheme() {
  const { setTheme } = useTheme();

  useEffect(() => {
    setTheme("light");
  }, [setTheme]);

  return null;
}
