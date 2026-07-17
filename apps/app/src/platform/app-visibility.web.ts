import { useEffect } from "react";

export function useAppBecameActive(callback: () => void): void {
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") callback();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [callback]);
}
