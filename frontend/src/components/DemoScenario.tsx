import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FlaskConical, LoaderCircle } from "lucide-react";
import { loadFullDemo, restoreBeforeDemo, SCENARIO_KEY } from "@/lib/demo/scenario";
import { readRecord, subscribeStore } from "@/lib/storage/database";

export function DemoScenario() {
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const load = () => {
      void readRecord(SCENARIO_KEY, null)
        .then((value) => {
          if (alive) {
            setActive(!!value);
            setReady(true);
          }
        })
        .catch(() => {
          if (alive) setReady(true);
        });
    };
    load();
    const unsubscribe = subscribeStore(load);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  async function apply() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (active) await restoreBeforeDemo();
      else await loadFullDemo();
      window.location.assign("/");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Demo setup failed. Retry.");
      setBusy(false);
    }
  }
  return (
    <aside
      aria-label="Full website demo"
      className="glass mb-6 rounded-2xl border border-primary/20 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FlaskConical className="size-5 text-primary" aria-hidden />
          <div>
            <p className="text-sm font-semibold">
              {active ? "Full demo is active · Alex Morgan" : "Explore the complete demo"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {active
                ? "Fictional student, 3 saved opportunities, and 3 plans with sample progress."
                : "Load a student profile, projects, saved opportunities, and preparation progress. Saved data is backed up; unsaved edits are not included."}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="detail-secondary"
          disabled={busy || !ready}
          onClick={() => void apply()}
        >
          {busy && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
          {busy ? "Please wait…" : active ? "Restore my previous data" : "Load full website demo"}
        </button>
      </div>
      {active && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-primary">
          <Link to="/profile" search={{}}>
            1. Meet the student
          </Link>
          <Link to="/" search={{ event: "aurora-ai" }}>
            2. Explore Aurora & My Fit
          </Link>
          <Link to="/plans" search={{ event: "aurora-ai" }}>
            3. Continue the active plan
          </Link>
          <Link to="/plans" search={{}}>
            4. Compare all plans
          </Link>
        </div>
      )}
      {error && (
        <p role="alert" className="prep-error mt-3">
          {error}
        </p>
      )}
    </aside>
  );
}
