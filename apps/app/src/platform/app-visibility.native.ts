import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";

export function useAppBecameActive(callback: () => void): void {
  const previousState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (previousState.current !== "active" && nextState === "active") {
        callback();
      }
      previousState.current = nextState;
    });
    return () => subscription.remove();
  }, [callback]);
}
