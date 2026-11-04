import { useCallback, useEffect, useRef, useState } from "react";
import { preparationRepository } from "@/lib/preparation/repository";
import type { PreparationBundle } from "@/lib/preparation/logic";
import { subscribeStore } from "@/lib/storage/database";

export function usePreparation(opportunityId: string) {
  const [bundle, setBundle] = useState<PreparationBundle | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const serial = useRef(0);
  const reload = useCallback(async () => {
    const request = ++serial.current;
    try {
      const next = await preparationRepository.load(opportunityId);
      if (request === serial.current) {
        setBundle(next);
        setError("");
        setLoading(false);
      }
    } catch (failure) {
      if (request === serial.current) {
        setError(
          failure instanceof Error ? failure.message : "Preparation data could not be loaded.",
        );
        setLoading(false);
      }
    }
  }, [opportunityId]);
  useEffect(() => {
    void reload();
    const unsubscribe = subscribeStore(() => void reload());
    const focus = () => void reload();
    window.addEventListener("focus", focus);
    return () => {
      serial.current++;
      unsubscribe();
      window.removeEventListener("focus", focus);
    };
  }, [reload]);
  return { bundle, error, loading, reload };
}
