import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";

/** Confirm local persistence before updating the displayed state. */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const current = useRef(value);

  useEffect(() => {
    const sync = () => {
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
    };
    sync();
    setHydrated(true);
    window.addEventListener("storage", sync);
    window.addEventListener("nextstep:storage", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("nextstep:storage", sync);
    };
  }, [key]);

  const persist = useCallback(
    (update: SetStateAction<T>): boolean => {
      const next =
        typeof update === "function" ? (update as (previous: T) => T)(current.current) : update;
      try {
        localStorage.setItem(key, JSON.stringify(next));
        current.current = next;
        setValue(next);
        window.dispatchEvent(new Event("nextstep:storage"));
        return true;
      } catch {
        return false;
      }
    },
    [key],
  );

  return [value, persist, hydrated] as const;
}
