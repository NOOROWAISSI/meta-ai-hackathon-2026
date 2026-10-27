import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  AlertCircle,
  Inbox,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
  Shuffle,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { fetchHackathons, fetchRecommendations } from "@/lib/discover/api";
import { ALL_TOPICS, DEFAULT_PROFILE } from "@/lib/discover/demo-data";
import { activeFilterCount, applyFilters, isProfileComplete } from "@/lib/discover/logic";
import type {
  DeadlineFilter,
  DemoState,
  Filters,
  Hackathon,
  ParticipationFilter,
  ParticipationMode,
  TimingChip,
  UserProfile,
} from "@/lib/discover/types";
import { useLocalState } from "@/lib/discover/use-local-state";
import { CardSkeleton, HackathonCard } from "./HackathonCard";
import { HackathonDetails } from "@/components/details/HackathonDetails";
import { useVisitState } from "@/components/VisitMemory";
import { OpportunityGroups } from "./OpportunityGroups";

const EMPTY_FILTERS: Filters = { topics: [], modes: [], deadline: "any", participation: "any" };
const MODES: { v: ParticipationMode; l: string }[] = [
  { v: "online", l: "Online" },
  { v: "onsite", l: "On-site" },
  { v: "hybrid", l: "Hybrid" },
];
const DEADLINES: { v: DeadlineFilter; l: string }[] = [
  { v: "any", l: "Any time" },
  { v: "7", l: "Next 7 days" },
  { v: "30", l: "Next 30 days" },
  { v: "90", l: "Next 90 days" },
];
const PARTICIPATION: { v: ParticipationFilter; l: string }[] = [
  { v: "any", l: "Any" },
  { v: "solo", l: "Solo" },
  { v: "team", l: "Team" },
];
const DEMO_STATES: DemoState[] = [
  "normal",
  "loading",
  "empty",
  "error",
  "ai-unavailable",
  "incomplete-profile",
];

function Pill({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "transition-soft rounded-xl border px-3 py-1.5 text-sm font-medium active:scale-95",
        on
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-card/80 text-foreground hover:border-primary/50",
      )}
    >
      {on && <span aria-hidden>✓ </span>}
      {children}
    </button>
  );
}

export function DiscoverScreen() {
  const { event: eventId, analysis: analysisAction } = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const discoveryScroll = useRef(0);
  const discoveryFocus = useRef<HTMLElement | null>(null);
  const previousEvent = useRef(eventId);
  useEffect(() => {
    if (previousEvent.current && !eventId)
      requestAnimationFrame(() => {
        discoveryFocus.current?.focus({ preventScroll: true });
        window.scrollTo(0, discoveryScroll.current);
      });
    previousEvent.current = eventId;
  }, [eventId]);
  const [demoState, setDemoState] = useState<DemoState>("normal");
  const [storedProfile, , profileReady] = useLocalState<UserProfile>(
    "nextstep.profile",
    DEFAULT_PROFILE,
  );
  const [saved, setSaved] = useLocalState<string[]>("nextstep.saved", []);
  const [dismissed, setDismissed] = useVisitState<string[]>("discover.dismissed", []);
  const [queryDraft, setQueryDraft] = useVisitState("discover.queryDraft", "");
  const [query, setQuery] = useVisitState("discover.query", "");
  const [filters, setFilters] = useVisitState<Filters>("discover.filters", EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useVisitState<"for-you" | "all">("discover.tab", "for-you");
  const [timing, setTiming] = useVisitState<TimingChip>("discover.timing", null);
  const openProfile = () =>
    void navigate({ to: "/profile", search: eventId ? { event: eventId } : {} });

  const profile: UserProfile =
    demoState === "incomplete-profile"
      ? { interests: [], skills: [], weeklyHours: null }
      : storedProfile;
  const complete = isProfileComplete(profile);

  const catalog = useQuery({
    queryKey: ["hackathons", demoState],
    queryFn: () => fetchHackathons(demoState),
    retry: false,
  });
  const list = useMemo(() => catalog.data ?? [], [catalog.data]);
  const recs = useQuery({
    queryKey: ["recs", demoState, profile, list.length],
    queryFn: () => fetchRecommendations(list, profile, demoState),
    enabled: list.length > 0,
    retry: false,
  });
  const aiAvailable = !recs.isError;

  const visible = useMemo(() => list.filter((h) => !dismissed.includes(h.id)), [list, dismissed]);
  const filtered = useMemo(
    () => applyFilters(visible, filters, query, timing),
    [visible, filters, query, timing],
  );

  const forYou = useMemo(() => {
    if (!aiAvailable || !recs.data) return filtered;
    const order = recs.data.map((r) => r.hackathonId);
    return filtered
      .filter((h) => order.includes(h.id))
      .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  }, [filtered, recs.data, aiAvailable]);

  const isForYou = tab === "for-you";
  // Synthetic tags have no reviewed evidence: keep suggestions generic.
  const generic = !recs.data?.length;
  const gridItems = isForYou && !generic ? forYou : filtered;

  const filterCount = activeFilterCount(filters);
  const anyNarrowing = filterCount > 0 || !!query || !!timing;

  const clearAll = () => {
    setFilters(EMPTY_FILTERS);
    setQuery("");
    setQueryDraft("");
    setTiming(null);
  };
  const toggleSave = (id: string) => {
    const removing = saved.includes(id);
    if (setSaved((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))) {
      toast.success(removing ? "Removed from saved" : "Saved in this browser");
    } else {
      toast.error("Couldn't save your change", {
        description: "Browser storage is unavailable. Please try again.",
      });
    }
  };
  const openOpportunity = (event: Hackathon | null) => {
    if (!event) return;
    discoveryScroll.current = window.scrollY;
    discoveryFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void navigate({ to: "/", search: { event: event.id }, resetScroll: true });
  };
  const dismiss = (h: Hackathon, reason?: string) => {
    setDismissed((d) => [...d, h.id]);
    toast(`Hidden “${h.title}”`, {
      description: reason ? `Reason: ${reason}` : "We'll show fewer like this.",
      action: { label: "Undo", onClick: () => setDismissed((d) => d.filter((x) => x !== h.id)) },
    });
  };

  const chips: { label: string; remove: () => void }[] = [
    ...filters.topics.map((t) => ({
      label: t,
      remove: () => setFilters((f) => ({ ...f, topics: f.topics.filter((x) => x !== t) })),
    })),
    ...filters.modes.map((m) => ({
      label: MODES.find((x) => x.v === m)!.l,
      remove: () => setFilters((f) => ({ ...f, modes: f.modes.filter((x) => x !== m) })),
    })),
    ...(filters.deadline !== "any"
      ? [
          {
            label: `Deadline: ${DEADLINES.find((d) => d.v === filters.deadline)!.l}`,
            remove: () => setFilters((f) => ({ ...f, deadline: "any" as const })),
          },
        ]
      : []),
    ...(filters.participation !== "any"
      ? [
          {
            label: filters.participation === "solo" ? "Solo-friendly" : "Team",
            remove: () => setFilters((f) => ({ ...f, participation: "any" as const })),
          },
        ]
      : []),
    ...(query
      ? [
          {
            label: `“${query}”`,
            remove: () => {
              setQuery("");
              setQueryDraft("");
            },
          },
        ]
      : []),
  ];

  return (
    <>
      <div hidden={!!eventId} className="space-y-6">
        {import.meta.env.DEV && (
          <details className="text-xs text-muted-foreground">
            <summary className="w-fit cursor-pointer rounded-lg px-2 py-1">
              Preview controls
            </summary>
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-card/60 px-3 py-2 text-xs">
              <label htmlFor="demo-state" className="font-semibold text-muted-foreground">
                Dev · preview state
              </label>
              <select
                id="demo-state"
                value={demoState}
                onChange={(e) => setDemoState(e.target.value as DemoState)}
                className="rounded-lg border border-input bg-card px-2 py-1"
              >
                {DEMO_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </details>
        )}

        {/* Header */}
        <header className="discovery-hero relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-primary/10 p-6 sm:flex-row sm:items-start sm:justify-between sm:p-8">
          <span aria-hidden className="ambient-bubble hero-orb" />
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-card/70 px-3 py-1 text-xs font-semibold text-violet-ink">
              <Sparkles className="size-3.5" aria-hidden />{" "}
              <span className="galaxy-text">Discover · Learn · Build</span>
            </span>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              Your next opportunity starts here.
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Find a hackathon worth building for. Explore the details, check the requirements, and
              take your next step.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openProfile()}
            aria-label="Edit profile"
            className="glass transition-soft grid size-12 shrink-0 place-items-center rounded-2xl hover:-translate-y-0.5"
          >
            <UserRound className="size-5 text-violet-ink" aria-hidden />
          </button>
        </header>

        {!complete && (
          <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-coral/20 text-coral-ink">
              <UserRound className="size-5" aria-hidden />
            </span>
            <p className="flex-1 text-sm">
              <span className="font-semibold">Start exploring. Make it personal later.</span>{" "}
              <span className="text-muted-foreground">
                Your profile is optional. Browse all five demo opportunities, or add your interests
                and availability.
              </span>
            </p>
            <button
              type="button"
              onClick={() => openProfile()}
              className="transition-soft rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-primary"
            >
              Add your interests
            </button>
          </div>
        )}

        {/* Search toolbar */}
        <section aria-label="Search and filters" className="glass rounded-3xl p-3">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(queryDraft);
            }}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search
                className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <label htmlFor="q" className="sr-only">
                Search hackathons
              </label>
              <input
                id="q"
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                placeholder="Search hackathons, organizers, or topics…"
                className="h-12 w-full rounded-2xl border border-input bg-card pl-10 pr-3 text-sm placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="transition-soft h-12 flex-1 rounded-2xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-button hover:-translate-y-0.5 active:scale-95 sm:flex-none"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen((o) => !o)}
                aria-expanded={filtersOpen}
                aria-controls="filter-panel"
                className={cn(
                  "transition-soft flex h-12 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold active:scale-95",
                  filtersOpen
                    ? "border-primary bg-secondary"
                    : "border-input bg-card hover:border-primary/50",
                )}
              >
                <SlidersHorizontal className="size-4" aria-hidden /> Filters
                {filterCount > 0 && (
                  <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {filterCount}
                  </span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-primary/8 px-1 pt-3">
            <span className="mr-1 text-xs font-medium text-muted-foreground">Pick your spark</span>
            {["AI", "Web", "Data", "Climate"].map((topic) => (
              <button
                key={topic}
                type="button"
                aria-pressed={filters.topics.includes(topic)}
                onClick={() =>
                  setFilters((f) => ({
                    ...f,
                    topics: f.topics.includes(topic)
                      ? f.topics.filter((t) => t !== topic)
                      : [...f.topics, topic],
                  }))
                }
                className="spark-chip transition-soft rounded-full border border-primary/15 bg-card/35 px-3 py-1.5 text-xs font-medium text-violet-ink hover:bg-primary/10 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {topic}
              </button>
            ))}
            <button
              type="button"
              disabled={!filtered.length}
              onClick={() =>
                openOpportunity(filtered[Math.floor(Math.random() * filtered.length)] ?? null)
              }
              className="transition-soft ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/8 disabled:opacity-40"
            >
              <Shuffle className="size-3.5" aria-hidden />{" "}
              <span className="galaxy-text">Surprise me</span>
            </button>
          </div>

          {filtersOpen && (
            <div
              id="filter-panel"
              className="mt-3 grid gap-5 rounded-2xl bg-card/70 p-4 md:grid-cols-2"
            >
              <fieldset>
                <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Topic
                </legend>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_TOPICS.map((t) => (
                    <Pill
                      key={t}
                      on={filters.topics.includes(t)}
                      onClick={() =>
                        setFilters((f) => ({
                          ...f,
                          topics: f.topics.includes(t)
                            ? f.topics.filter((x) => x !== t)
                            : [...f.topics, t],
                        }))
                      }
                    >
                      {t}
                    </Pill>
                  ))}
                </div>
              </fieldset>
              <div className="space-y-5">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Format
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {MODES.map((m) => (
                      <Pill
                        key={m.v}
                        on={filters.modes.includes(m.v)}
                        onClick={() =>
                          setFilters((f) => ({
                            ...f,
                            modes: f.modes.includes(m.v)
                              ? f.modes.filter((x) => x !== m.v)
                              : [...f.modes, m.v],
                          }))
                        }
                      >
                        {m.l}
                      </Pill>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Registration deadline
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {DEADLINES.map((d) => (
                      <Pill
                        key={d.v}
                        on={filters.deadline === d.v}
                        onClick={() => setFilters((f) => ({ ...f, deadline: d.v }))}
                      >
                        {d.l}
                      </Pill>
                    ))}
                  </div>
                </fieldset>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Participation
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {PARTICIPATION.map((p) => (
                      <Pill
                        key={p.v}
                        on={filters.participation === p.v}
                        onClick={() => setFilters((f) => ({ ...f, participation: p.v }))}
                      >
                        {p.l}
                      </Pill>
                    ))}
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 px-1">
              {chips.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={c.remove}
                  aria-label={`Remove filter ${c.label}`}
                  className="transition-soft inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground hover:bg-accent"
                >
                  {c.label} <X className="size-3" aria-hidden />
                </button>
              ))}
              <button
                type="button"
                onClick={clearAll}
                className="ml-1 rounded text-xs font-semibold text-primary hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </section>

        {/* Tabs + timing chips */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Discovery view"
            className="glass inline-flex w-fit rounded-2xl p-1"
          >
            {(
              [
                ["for-you", "For You"],
                ["all", "Explore All"],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                role="tab"
                aria-selected={tab === v}
                onClick={() => setTab(v)}
                className={cn(
                  "transition-soft rounded-xl px-4 py-2 text-sm font-semibold",
                  tab === v
                    ? "bg-primary text-primary-foreground shadow-button"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Timing">
            <Pill
              on={timing === "now"}
              onClick={() => setTiming((t) => (t === "now" ? null : "now"))}
            >
              Pursue Now
            </Pill>
            <Pill
              on={timing === "later"}
              onClick={() => setTiming((t) => (t === "later" ? null : "later"))}
            >
              Prepare for Later
            </Pill>
          </div>
        </div>

        {/* Section heading */}
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {isForYou ? "Your discovery shortlist" : "All demo opportunities"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isForYou
                ? "Explore demo events. Details still need verification."
                : "Five fictional hackathons. Explore freely, no profile required."}
            </p>
          </div>
          {catalog.isSuccess && list.length > 0 && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {gridItems.length} {gridItems.length === 1 ? "result" : "results"}
            </p>
          )}
        </div>

        {isForYou && catalog.isSuccess && list.length > 0 && !aiAvailable && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-2xl bg-warning p-4 text-sm text-warning-ink"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="font-semibold">AI recommendations are unavailable right now.</span>{" "}
              Showing all opportunities instead — search and filters still work.
            </p>
            <button
              type="button"
              onClick={() => recs.refetch()}
              className="ml-auto shrink-0 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Grid / states */}
        {catalog.isPending ? (
          <div
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
            aria-busy="true"
            aria-label="Loading opportunities"
          >
            {[0, 1, 2].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : catalog.isError ? (
          <StateCard
            icon={<AlertCircle className="size-6" aria-hidden />}
            title="Something went wrong"
            body={(catalog.error as Error).message + " Your saved items are safe."}
            action={{
              label: "Retry",
              icon: <RotateCcw className="size-4" aria-hidden />,
              onClick: () => catalog.refetch(),
            }}
          />
        ) : list.length === 0 ? (
          <StateCard
            icon={<Inbox className="size-6" aria-hidden />}
            title="No opportunities yet"
            body="The catalog is empty right now. New hackathons will appear here once they're reviewed."
          />
        ) : visible.length === 0 ? (
          <StateCard
            icon={<Inbox className="size-6" aria-hidden />}
            title="You've hidden every opportunity"
            body="Restore the demo catalog to explore these opportunities again."
            action={{ label: "Restore opportunities", onClick: () => setDismissed([]) }}
          />
        ) : gridItems.length === 0 ? (
          <StateCard
            icon={<SearchX className="size-6" aria-hidden />}
            title="No matching hackathons"
            body={
              isForYou && !anyNarrowing
                ? "Nothing matches your profile yet. Try Explore All or update your interests."
                : "Try removing a filter or searching a broader term."
            }
            action={
              anyNarrowing
                ? { label: "Clear filters", onClick: clearAll }
                : { label: "Explore All", onClick: () => setTab("all") }
            }
          />
        ) : (
          <OpportunityGroups
            items={gridItems}
            renderCard={(h) => (
              <HackathonCard
                key={h.id}
                h={h}
                reason={
                  isForYou
                    ? "A generic suggestion from the demo catalog. Topics and organizer rules still need source verification."
                    : undefined
                }
                saved={saved.includes(h.id)}
                onToggleSave={() => toggleSave(h.id)}
                onDismiss={(r) => dismiss(h, r)}
                onView={() => openOpportunity(h)}
              />
            )}
          />
        )}

        <p className="text-center text-xs text-muted-foreground">
          Demo opportunities. All events, organizers, and AI recommendations are fictional and not
          verified. Links point to example.org placeholders.
        </p>
      </div>
      {eventId && !profileReady && <p role="status">Loading your confirmed profile…</p>}
      {eventId && profileReady && (
        <HackathonDetails
          key={eventId}
          eventId={eventId}
          requestUpdate={analysisAction === "update"}
          profile={storedProfile}
          saved={saved.includes(eventId)}
          onToggleSave={() => toggleSave(eventId)}
          onEditProfile={openProfile}
          onBack={() => void navigate({ to: "/", search: {}, resetScroll: false })}
        />
      )}
    </>
  );
}

function StateCard({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: { label: string; onClick: () => void; icon?: React.ReactNode };
}) {
  return (
    <div className="glass flex flex-col items-center rounded-3xl px-6 py-12 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-violet-ink">
        {icon}
      </span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{body}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="transition-soft mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-button hover:-translate-y-0.5 active:scale-95"
        >
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}
