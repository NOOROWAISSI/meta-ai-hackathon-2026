import { useVisitState } from "@/components/VisitMemory";
import {
  ArrowLeft,
  ArrowUpRight,
  Braces,
  BrainCircuit,
  Layers3,
  LayoutGrid,
  ShieldCheck,
} from "lucide-react";
import { useRef, type CSSProperties, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

interface CollectionItem {
  id: string;
  title: string;
  topics: string[];
}
export interface OpportunityCollection {
  id: string;
  title: string;
  description: string;
  topics: readonly string[];
  icon: LucideIcon;
}

const GROUPS = [
  {
    id: "ai-data",
    title: "AI & Data",
    description: "Intelligent ideas. Real-world impact.",
    topics: ["AI", "Data"],
    icon: BrainCircuit,
  },
  {
    id: "web-creative",
    title: "Web & Creative",
    description: "Interfaces, games, and things people love.",
    topics: ["Web", "Games", "Creative coding"],
    icon: Braces,
  },
  {
    id: "fintech-security",
    title: "FinTech & Security",
    description: "Build trust. Rethink how money moves.",
    topics: ["FinTech", "Security"],
    icon: ShieldCheck,
  },
  {
    id: "more",
    title: "More to explore",
    description: "A different direction for your next build.",
    topics: [],
    icon: Layers3,
  },
] as const;

function defaultGroupId(event: CollectionItem) {
  return (
    GROUPS.find((group) => group.topics.some((topic) => event.topics.includes(topic)))?.id ?? "more"
  );
}

export function OpportunityGroups<T extends CollectionItem>({
  items,
  renderCard,
  collections = GROUPS,
  classify = defaultGroupId,
  memoryKey = "discover.collection",
}: {
  items: T[];
  renderCard: (event: T) => ReactNode;
  collections?: readonly OpportunityCollection[];
  classify?: (event: T) => string;
  memoryKey?: string;
}) {
  const [selected, setSelected] = useVisitState<string | null>(memoryKey, null);
  const panel = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const group = collections.find((entry) => entry.id === selected);
  const shown = selected === "all" ? items : items.filter((event) => classify(event) === selected);
  const groups = collections.filter(
    (entry) => entry.id !== "more" || items.some((event) => classify(event) === "more"),
  );

  const select = (id: string | null) => {
    const previous = selected;
    setSelected(id);
    requestAnimationFrame(() => {
      if (id) heading.current?.focus({ preventScroll: true });
      else
        panel.current
          ?.querySelector<HTMLButtonElement>(`#group-${previous}`)
          ?.focus({ preventScroll: true });
      (id ? results.current : panel.current)?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  };

  return (
    <section
      ref={panel}
      aria-label="Opportunity groups"
      className="opportunity-groups scroll-mt-24"
    >
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        {selected ? (
          <button
            type="button"
            onClick={() => select(null)}
            className="glass transition-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary"
          >
            <ArrowLeft className="size-4" aria-hidden /> Back to groups
          </button>
        ) : (
          <p className="text-sm text-muted-foreground">Pick a stack. Let the cards unfold below.</p>
        )}
        <button
          type="button"
          aria-pressed={selected === "all"}
          onClick={() => select(selected === "all" ? null : "all")}
          className="glass transition-soft inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary"
        >
          {selected === "all" ? (
            <Layers3 className="size-4" aria-hidden />
          ) : (
            <LayoutGrid className="size-4" aria-hidden />
          )}
          {selected === "all" ? "Browse groups" : `View all ${items.length} opportunities`}
        </button>
      </div>

      <div className="collection-grid">
        {groups.map(({ id, title, description, topics, icon: Icon }, index) => {
          const events = items.filter((event) => classify(event) === id);
          return (
            <button
              key={id}
              id={`group-${id}`}
              data-galaxy-tone={["blue", "teal", "copper"][index % 3]}
              style={{ "--group-order": index * 2 } as CSSProperties}
              type="button"
              disabled={!events.length}
              onClick={() => select(selected === id ? null : id)}
              aria-expanded={selected === id}
              aria-pressed={selected === id}
              aria-controls="collection-results"
              className="collection-stack group text-left"
              aria-label={`Open ${title}: ${events.length} ${events.length === 1 ? "opportunity" : "opportunities"}`}
            >
              <span aria-hidden className="collection-sheet collection-sheet-back">
                <span className="collection-sheet-label">
                  {events[1]?.title ?? "Collection notes"}
                </span>
              </span>
              <span aria-hidden className="collection-sheet collection-sheet-middle">
                <span className="collection-sheet-label">{events[0]?.title ?? title}</span>
              </span>
              <span className="collection-front glass-strong">
                <span
                  className={`collection-cover event-cover event-cover-${["one", "two", "three", "four"][index % 4]}`}
                >
                  <span className="collection-icon relative z-10 grid size-12 place-items-center rounded-2xl border border-white/35 bg-white/15 text-white backdrop-blur">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="relative z-10 rounded-full border border-white/35 bg-black/15 px-3 py-1 text-xs font-semibold text-white">
                    {events.length} {events.length === 1 ? "opportunity" : "opportunities"}
                  </span>
                </span>
                <span className="flex flex-1 flex-col p-5">
                  <span className="text-xl font-bold tracking-tight">{title}</span>
                  <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </span>
                  <span className="mt-4 flex flex-wrap gap-1.5">
                    {topics.map((topic) => (
                      <span
                        key={topic}
                        className="collection-topic rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary"
                      >
                        {topic}
                      </span>
                    ))}
                  </span>
                  <span className="mt-5 border-t border-primary/10 pt-4">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Inside this collection
                    </span>
                    <span className="mt-2 block space-y-2">
                      {events.slice(0, 3).map((event) => (
                        <span
                          key={event.id}
                          className="flex items-start gap-2 text-xs leading-relaxed"
                        >
                          <span
                            aria-hidden
                            className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60"
                          />
                          {event.title}
                        </span>
                      ))}
                    </span>
                    {!events.length && (
                      <span className="mt-2 block text-xs text-muted-foreground">
                        No matches for your current filters.
                      </span>
                    )}
                  </span>
                  <span className="collection-action mt-auto flex items-center justify-between pt-6 text-sm font-semibold text-primary">
                    {selected === id ? "Fold cards back" : "Unfold the cards"}{" "}
                    <ArrowUpRight
                      className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </span>
              </span>
            </button>
          );
        })}
        {selected && (
          <div
            ref={results}
            id="collection-results"
            className="collection-results scroll-mt-24"
            style={
              {
                "--selected-order":
                  selected === "all"
                    ? 99
                    : groups.findIndex((entry) => entry.id === selected) * 2 + 1,
              } as CSSProperties
            }
          >
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3
                  ref={heading}
                  tabIndex={-1}
                  className="rounded text-2xl font-bold tracking-tight"
                >
                  {group?.title ?? "All opportunities"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {group?.description ?? "Every opportunity in your current search."}
                </p>
              </div>
              <p role="status" className="text-sm text-muted-foreground">
                {shown.length} {shown.length === 1 ? "opportunity" : "opportunities"} · current
                search
              </p>
              <button
                type="button"
                onClick={() => select(null)}
                className="glass rounded-full px-4 py-2 text-xs font-semibold text-primary hover:bg-secondary"
              >
                <Layers3 className="mr-2 inline size-4" aria-hidden /> Fold back into stack
              </button>
            </div>
            {shown.length ? (
              <div className="opportunity-deck" data-spread="true">
                <div className="deck-layout">
                  {shown.map((event, index) => (
                    <div
                      key={event.id}
                      className="deck-card"
                      style={
                        {
                          "--card-index": index,
                          "--card-angle": `${index % 2 ? 4 : -4}deg`,
                        } as CSSProperties
                      }
                    >
                      {renderCard(event)}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass rounded-3xl p-8 text-center">
                <p className="font-semibold">No matches in this collection.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Your search and filters are still active. Try another collection or change the
                  filters above.
                </p>
                <button
                  type="button"
                  onClick={() => select(null)}
                  className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
                >
                  Choose another group
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
