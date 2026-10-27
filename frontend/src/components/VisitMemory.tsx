import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";

const VisitMemory = createContext<Map<string, unknown> | null>(null);

/** Per mounted application, never shared between SSR requests or browser visits. */
export function VisitMemoryProvider({ children }: { children: ReactNode }) {
  const values = useRef(new Map<string, unknown>());
  return <VisitMemory.Provider value={values.current}>{children}</VisitMemory.Provider>;
}

export function useVisitState<T>(key: string, initial: T) {
  const memory = useContext(VisitMemory);
  const [value, setValue] = useState<T>(() =>
    memory?.has(key) ? (memory.get(key) as T) : initial,
  );
  const current = useRef(value);
  const update = useCallback(
    (next: SetStateAction<T>) => {
      const resolved =
        typeof next === "function" ? (next as (value: T) => T)(current.current) : next;
      current.current = resolved;
      memory?.set(key, resolved);
      setValue(resolved);
    },
    [memory, key],
  );
  return [value, update] as const;
}
