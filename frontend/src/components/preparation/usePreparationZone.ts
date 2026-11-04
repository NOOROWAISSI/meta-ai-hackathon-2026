import { useEffect, useState } from "react";

/** Display preference only; it never converts an uncertain date into a known instant. */
export function usePreparationZone() {
  const [zone, setZone] = useState("UTC");
  useEffect(() => {
    try {
      const selected =
        localStorage.getItem("nextstep.timezone") ??
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      new Intl.DateTimeFormat("en-US", { timeZone: selected });
      setZone(selected);
    } catch {
      /* UTC stays explicitly labelled. */
    }
  }, []);
  return {
    zone,
    formatInstant: (instant: string) =>
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: zone,
      }).format(new Date(instant)),
  };
}
