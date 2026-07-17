export interface TransitionLock {
  current: boolean;
}

export function runLockedTransition(
  lock: TransitionLock,
  update: () => void,
): boolean {
  if (lock.current) return false;
  lock.current = true;
  update();
  return true;
}
