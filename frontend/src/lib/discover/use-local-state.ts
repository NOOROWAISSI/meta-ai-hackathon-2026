import { useCallback, useEffect, useRef, useState } from "react";
import type { SetStateAction } from "react";
import { readRecord, subscribeStore, updateRecord } from "../storage/database";

/** Compatibility hook for the existing screen view models; IndexedDB is authoritative. */
export function useLocalState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState("");
  const initialRef = useRef(initial);
  useEffect(() => {
    let alive = true;
    const sync = () =>
      void readRecord<T>(key, initialRef.current)
        .then((stored) => {
          if (alive) {
            setValue(stored);
            setError("");
            setHydrated(true);
          }
        })
        .catch((failure: unknown) => {
          if (alive) {
            setError(failure instanceof Error ? failure.message : "Storage unavailable");
            setHydrated(true);
          }
        });
    sync();
    const unsubscribe = subscribeStore(sync);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [key]);
  const persist = useCallback(
    async (update: SetStateAction<T>): Promise<boolean> => {
      try {
        const next = await updateRecord<T>(key, initialRef.current, (current) =>
          typeof update === "function" ? (update as (previous: T) => T)(current) : update,
        );
        setValue(next);
        setError("");
        return true;
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : "Storage unavailable");
        return false;
      }
    },
    [key],
  );
  return [value, persist, hydrated, error] as const;
}
