import { Link, useNavigate } from "@tanstack/react-router";
import {
  Bookmark,
  Search,
  SearchX,
  ArrowRight,
  RotateCcw,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/discover/AppShell";
import { CardSkeleton, HackathonCard } from "@/components/discover/HackathonCard";
import { useVisitMemory, useVisitState } from "@/components/VisitMemory";
import type { AnalysisSnapshot } from "@/lib/details/types";
import { hasPersonalProfile } from "@/lib/details/logic";
import {
  savedAnalysis,
  savedResults,
  savedService,
  type RemovalReceipt,
  type SavedFormat,
  type SavedSnapshot,
  type SavedSort,
} from "@/lib/saved/service";
import { subscribeStore } from "@/lib/storage/database";

type FailedAction = { kind: "remove"; id: string } | { kind: "undo"; receipt: RemovalReceipt };
const formats: { value: SavedFormat; label: string }[] = [
  { value: "all", label: "All" },
  { value: "online", label: "Online" },
  { value: "onsite", label: "In person" },
  { value: "hybrid", label: "Hybrid" },
];

export function SavedScreen() {
  const navigate = useNavigate();
  const memory = useVisitMemory();
  const [query, setQuery] = useVisitState("saved.query", "");
  const [format, setFormat] = useVisitState<SavedFormat>("saved.format", "all");
  const [sort, setSort] = useVisitState<SavedSort>("saved.sort", "recent");
  const [snapshot, setSnapshot] = useState<SavedSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [failed, setFailed] = useState<FailedAction | null>(null);
  const [undo, setUndo] = useState<RemovalReceipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const serial = useRef(0);
  const alive = useRef(true);
  const locked = useRef(false);
  const status = useRef<HTMLDivElement>(null);
  const reload = useCallback(async () => {
    const request = ++serial.current;
    try {
      const data = await savedService.load();
      if (alive.current && request === serial.current) {
        setSnapshot(data);
        setLoadError("");
        setLoading(false);
      }
    } catch (error) {
      if (alive.current && request === serial.current) {
        setLoadError(
          error instanceof Error ? error.message : "Saved opportunities could not be loaded.",
        );
        setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void reload();
    const unsubscribe = subscribeStore(() => void reload());
    const focus = () => void reload();
    window.addEventListener("focus", focus);
    return () => {
      alive.current = false;
      unsubscribe();
      window.removeEventListener("focus", focus);
    };
  }, [reload]);

  async function apply(action: FailedAction) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setActionError("");
    try {
      if (action.kind === "remove") {
        const receipt = await savedService.remove(action.id);
        if (!alive.current) return;
        setSnapshot((previous) =>
          previous ? { ...previous, ids: previous.ids.filter((id) => id !== action.id) } : previous,
        );
        setUndo(receipt.index >= 0 ? receipt : null);
        setMessage(
          receipt.index >= 0
            ? "Removed from Saved. Existing preparation plans are kept."
            : "This opportunity was already removed from Saved.",
        );
      } else {
        await savedService.undo(action.receipt);
        if (!alive.current) return;
        setSnapshot((previous) => {
          if (!previous || previous.ids.includes(action.receipt.id)) return previous;
          const ids = [...previous.ids];
          ids.splice(Math.min(action.receipt.index, ids.length), 0, action.receipt.id);
          return { ...previous, ids };
        });
        setUndo(null);
        setMessage("Restored to Saved.");
      }
      setFailed(null);
      requestAnimationFrame(() => status.current?.focus());
      void reload();
    } catch (error) {
      if (alive.current) {
        setFailed(action);
        setActionError(
          `${error instanceof Error ? error.message : "Your change could not be saved."} The last confirmed saved state is kept.`,
        );
      }
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const results = useMemo(
    () => (snapshot ? savedResults(snapshot, query, format, sort) : []),
    [snapshot, query, format, sort],
  );
  const clear = () => {
    setQuery("");
    setFormat("all");
  };
  const personalized = snapshot ? hasPersonalProfile(snapshot.profile) : false;
  const unavailable = snapshot
    ? snapshot.ids.filter((id) => !snapshot.catalog.some((event) => event.id === id)).length
    : 0;

  return (
    <AppShell>
      <section aria-labelledby="saved-title" className="space-y-6">
        <header className="prep-hero">
          <div>
            <p className="prep-eyebrow">
              <Bookmark className="size-4" aria-hidden /> Your shortlist
            </p>
            <h1 id="saved-title">Saved Opportunities</h1>
            <p className="prep-organizer">
              Keep interesting hackathons together and decide what to pursue next.
            </p>
          </div>
          <span
            className="prep-index-count"
            aria-label={
              snapshot ? `${snapshot.ids.length} saved opportunities` : "Loading saved count"
            }
          >
            {snapshot ? snapshot.ids.length : "—"}
          </span>
        </header>
        <p className="prep-demo-notice">
          Demo opportunities. All events, organizers, and sample explanations are fictional and
          unverified.
        </p>

        <div className="glass rounded-3xl p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="min-w-0 flex-1">
              <label htmlFor="saved-search" className="mb-2 block text-xs font-semibold">
                Search saved opportunities
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-3.5 size-4 text-muted-foreground"
                  aria-hidden
                />
                <input
                  id="saved-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Title or organizer"
                  className="prep-input w-full pl-10"
                  style={{ paddingLeft: "2.5rem" }}
                />
              </div>
            </div>
            <div className="sm:w-60">
              <label htmlFor="saved-sort" className="mb-2 block text-xs font-semibold">
                Sort by
              </label>
              <select
                id="saved-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SavedSort)}
                className="prep-input w-full"
              >
                <option value="recent">Recently saved</option>
                <option value="deadline">Nearest registration deadline</option>
              </select>
            </div>
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-xs font-semibold">Participation format</legend>
            <div className="flex flex-wrap gap-2">
              {formats.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={format === item.value}
                  onClick={() => setFormat(item.value)}
                  className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition-colors ${format === item.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card/70 hover:border-primary/60"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="mt-3 text-xs text-muted-foreground">
            {sort === "deadline"
              ? "Published registration dates first; unknown dates last. Demo dates remain unverified, with no countdown."
              : "New saves use their recorded save time. Earlier saves keep their stored order when the save time is unknown."}
          </p>
        </div>

        <div
          ref={status}
          role="status"
          tabIndex={-1}
          className={
            message ? "glass flex flex-wrap items-center gap-3 rounded-2xl p-4 text-sm" : "sr-only"
          }
        >
          {message}
          {undo && (
            <button
              type="button"
              className="detail-secondary min-h-11"
              disabled={busy}
              onClick={() => void apply({ kind: "undo", receipt: undo })}
            >
              <RotateCcw className="size-4" aria-hidden />
              Undo
            </button>
          )}
        </div>
        {actionError && (
          <div role="alert" className="prep-error">
            <p>{actionError}</p>
            <button
              type="button"
              className="detail-secondary mt-3"
              disabled={busy}
              onClick={() => failed && void apply(failed)}
            >
              Retry change
            </button>
          </div>
        )}
        {loadError && (
          <div role="alert" className="prep-error">
            <p>{loadError}</p>
            <button
              type="button"
              className="detail-secondary mt-3"
              onClick={() => {
                setLoading(!snapshot);
                void reload();
              }}
            >
              Retry loading
            </button>
          </div>
        )}

        {loading && !snapshot ? (
          <div role="status" aria-label="Loading saved opportunities">
            <span className="sr-only">Loading saved opportunities</span>
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <CardSkeleton key={index} />
              ))}
            </div>
          </div>
        ) : (
          snapshot && (
            <>
              {!personalized && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="flex items-center gap-2">
                    <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
                    Add a short profile for personalized explanations. Your saved hackathons stay
                    accessible.
                  </p>
                  <Link to="/profile" search={{}} className="detail-secondary">
                    Complete my profile
                  </Link>
                </div>
              )}
              {unavailable > 0 && (
                <p role="status" className="prep-warning">
                  {unavailable} saved {unavailable === 1 ? "record is" : "records are"} currently
                  unavailable. Your bookmarks are retained.
                </p>
              )}
              {!snapshot.ids.length ? (
                <div className="prep-empty py-12">
                  <Bookmark className="size-12 text-primary" aria-hidden />
                  <h2>No saved opportunities yet.</h2>
                  <p>Save a hackathon while exploring to find it here.</p>
                  <Link to="/" search={{}} className="detail-primary">
                    Explore opportunities
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </div>
              ) : !results.length ? (
                <div className="prep-empty py-12">
                  <SearchX className="size-12 text-primary" aria-hidden />
                  <h2>
                    {unavailable === snapshot.ids.length && !query && format === "all"
                      ? "Saved records are unavailable"
                      : "No matching saved opportunities"}
                  </h2>
                  <p>Try another title, organizer, or participation format.</p>
                  <button type="button" className="detail-secondary" onClick={clear}>
                    Clear filters
                  </button>
                </div>
              ) : (
                <>
                  <p role="status" className="text-sm text-muted-foreground">
                    {results.length} of {snapshot.ids.length} saved opportunities
                  </p>
                  <div className="grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
                    {results.map((event) => {
                      const analysis = savedAnalysis(
                        event,
                        snapshot.profile,
                        (memory?.get(`details.analysis.${event.id}`) as
                          AnalysisSnapshot | undefined) ?? null,
                      );
                      const planned = snapshot.plannedIds.includes(event.id);
                      return (
                        <HackathonCard
                          key={event.id}
                          h={event}
                          saved
                          reason={analysis?.reason}
                          reasonLabel="Demo explanation · existing analysis"
                          onToggleSave={() => void apply({ kind: "remove", id: event.id })}
                          savePending={busy}
                          viewLabel="View details"
                          onView={() => void navigate({ to: "/", search: { event: event.id } })}
                        >
                          {analysis && (
                            <div className="rounded-2xl border border-border p-3 text-xs">
                              <p className="flex items-center gap-2 font-semibold">
                                <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                                Participation check{analysis.outdated ? " · outdated" : ""}
                              </p>
                              <p className="mt-2 text-muted-foreground">{analysis.status}</p>
                              <p className="mt-1 text-muted-foreground">
                                {analysis.outdated
                                  ? "Review the current profile and sources in event details."
                                  : "Existing demo checks. Relevance does not confirm eligibility."}
                              </p>
                            </div>
                          )}
                          <button
                            type="button"
                            className="detail-secondary w-full min-h-11"
                            onClick={() =>
                              void navigate({ to: "/plans", search: { event: event.id } })
                            }
                          >
                            {planned ? "Continue preparation" : "Explore preparation"}
                            <ArrowRight className="size-4" aria-hidden />
                          </button>
                        </HackathonCard>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )
        )}
      </section>
    </AppShell>
  );
}
