import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";

/** Confirm local persistence before updating the displayed state. */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const current = useRef(value);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const stored = JSON.parse(raw) as T;
        current.current = stored;
        setValue(stored);
      }
    } catch {
      // Browsing still works when browser storage is unavailable.
    }
  }, [key]);

  const persist = useCallback(
    (update: SetStateAction<T>): boolean => {
      const next =
        typeof update === "function" ? (update as (previous: T) => T)(current.current) : update;
      try {
        localStorage.setItem(key, JSON.stringify(next));
        current.current = next;
        setValue(next);
        return true;
      } catch {
        return false;
      }
    },
    [key],
  );

  return [value, persist] as const;
}
