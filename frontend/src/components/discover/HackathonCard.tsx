import {
  AlertTriangle,
  Bookmark,
  CalendarClock,
  CalendarDays,
  ChevronDown,
  Globe,
  MapPin,
  MoreHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDate, formatEventDates, teamLabel } from "@/lib/discover/logic";
import type { Hackathon } from "@/lib/discover/types";
import { ACCENTS } from "./accents";

const MODE_LABEL = { online: "Online", onsite: "On-site", hybrid: "Hybrid" } as const;
export const NOT_INTERESTED_REASONS = [
  "Not my topic",
  "Dates don't work",
  "Format doesn't suit me",
  "Already seen it",
];

interface Props {
  h: Hackathon;
  reason?: string | undefined;
  saved: boolean;
  onToggleSave: () => void;
  onDismiss: (reason?: string) => void;
  onView: () => void;
}

export function DeadlineLine({ h }: { h: Hackathon }) {
  return (
    <span className="font-medium text-foreground">
      {formatDate(h.registrationDeadline)}
      {h.registrationDeadline && (
        <span className="block text-xs font-normal text-muted-foreground">
          Unverified demo date · timezone unknown
        </span>
      )}
    </span>
  );
}

export function HackathonCard({ h, reason, saved, onToggleSave, onDismiss, onView }: Props) {
  const a = ACCENTS[h.accent];
  const [open, setOpen] = useState(false);
  const [pop, setPop] = useState(false);
  const team = teamLabel(h);

  return (
    <article
      className={cn(
        "group glass-strong transition-soft flex min-w-0 flex-col overflow-hidden rounded-3xl hover:-translate-y-1 hover:shadow-lift focus-within:shadow-lift",
        a.hoverBorder,
      )}
    >
      <div className={cn("relative h-16", a.strip)}>
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,oklch(1_0_0/0.45),transparent_55%)]"
        />
        <div className="absolute -bottom-5 left-5 flex items-end">
          <span
            className={cn(
              "grid size-11 place-items-center rounded-2xl border-2 border-card text-sm font-bold shadow-md",
              a.badge,
            )}
          >
            {h.initials}
          </span>
        </div>
        <div className="absolute right-3 top-3 flex gap-1.5">
          <button
            type="button"
            onClick={() => {
              onToggleSave();
              setPop(true);
            }}
            onAnimationEnd={() => setPop(false)}
            aria-pressed={saved}
            aria-label={saved ? `Unsave ${h.title}` : `Save ${h.title}`}
            className={cn(
              "transition-soft grid size-9 place-items-center rounded-xl backdrop-blur-md active:scale-90",
              saved ? "bg-card text-primary" : "bg-card/70 text-foreground hover:bg-card",
            )}
          >
            <Bookmark
              className={cn("size-4", saved && "fill-current", pop && "animate-save-pop")}
              aria-hidden
            />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`More options for ${h.title}`}
              className="transition-soft grid size-9 place-items-center rounded-xl bg-card/70 text-foreground backdrop-blur-md hover:bg-card active:scale-90"
            >
              <MoreHorizontal className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl">
              <DropdownMenuItem onSelect={() => onDismiss()}>Not interested</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Tell us why (optional)
              </DropdownMenuLabel>
              {NOT_INTERESTED_REASONS.map((r) => (
                <DropdownMenuItem key={r} onSelect={() => onDismiss(r)}>
                  {r}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 pt-8">
        <div>
          <h3 className="text-lg font-semibold leading-snug tracking-tight">{h.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">{h.organizer}</p>
        </div>

        <ul className="flex flex-wrap gap-1.5" aria-label="Topics">
          {h.topics.map((t) => (
            <li
              key={t}
              className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", a.tint, a.ink)}
            >
              {t}
            </li>
          ))}
        </ul>

        <a
          href={h.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`Placeholder source for ${h.title} (opens in a new tab)`}
          className="w-fit rounded text-xs font-medium text-primary underline underline-offset-4"
        >
          Demo source · example.org ↗
        </a>

        <dl className="grid gap-1.5 text-sm">
          <div className="flex items-start gap-2">
            {h.mode === "online" ? (
              <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <dt className="sr-only">Format</dt>
            <dd>
              <span className="font-medium">{MODE_LABEL[h.mode]}</span>
              {h.location && <span className="text-muted-foreground"> · {h.location}</span>}
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="shrink-0 whitespace-nowrap text-muted-foreground">Register by</dt>
            <dd>
              <DeadlineLine h={h} />
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="shrink-0 whitespace-nowrap text-muted-foreground">Event</dt>
            <dd>{formatEventDates(h)}</dd>
          </div>
          <div className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dt className="sr-only">Team rules</dt>
            <dd className={team ? "" : "text-muted-foreground italic"}>
              {team ?? "Team rules not listed"}
            </dd>
          </div>
        </dl>

        {h.uncertainties[0] && (
          <p className="flex items-start gap-2 rounded-xl bg-warning px-3 py-2 text-xs text-warning-ink">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">Check: </span>
              {h.uncertainties[0]}
            </span>
          </p>
        )}

        {reason && (
          <div className={cn("rounded-2xl border p-3", a.tint)}>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold">Why it's here</p>
              <span
                className={cn(
                  "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide",
                  a.ink,
                )}
              >
                <Sparkles className="size-3" aria-hidden /> Generic suggestion
              </span>
            </div>
            <p
              className={cn(
                "mt-1 text-sm leading-relaxed text-foreground",
                !open && "line-clamp-1",
              )}
            >
              {reason}
            </p>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded text-xs font-semibold",
                a.ink,
              )}
            >
              {open ? "Show less" : "Why this?"}
              <ChevronDown
                className={cn("size-3 transition-transform", open && "rotate-180")}
                aria-hidden
              />
            </button>
            {open && (
              <p className="mt-1 text-xs text-muted-foreground">
                Relevance only — this doesn't confirm you're eligible. Always check the organizer's
                rules.
              </p>
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 pt-2">
          <span className="text-xs text-muted-foreground">
            Unverified fixture
            <br /> Snapshot {formatDate(h.lastReviewed)}
          </span>
          <button
            type="button"
            onClick={onView}
            className="transition-soft whitespace-nowrap rounded-xl bg-foreground px-3.5 py-2 text-sm font-semibold text-background hover:bg-primary active:scale-95"
          >
            View opportunity
          </button>
        </div>
      </div>
    </article>
  );
}

export function CompactCard({ h, onView }: { h: Hackathon; onView: () => void }) {
  const a = ACCENTS[h.accent];
  return (
    <button
      type="button"
      onClick={onView}
      className={cn(
        "glass-strong transition-soft flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:-translate-y-0.5 hover:shadow-lift",
        a.hoverBorder,
      )}
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl text-sm font-bold",
          a.badge,
        )}
      >
        {h.initials}
      </span>
      <span className="min-w-0">
        <span className="block truncate font-semibold">{h.title}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {h.topics.join(" · ")} · Register by {formatDate(h.registrationDeadline)}
        </span>
      </span>
    </button>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-strong overflow-hidden rounded-3xl" aria-hidden>
      <div className="skeleton-glass h-16" />
      <div className="space-y-3 p-5 pt-8">
        <div className="skeleton-glass h-5 w-3/4 rounded-lg" />
        <div className="skeleton-glass h-4 w-1/2 rounded-lg" />
        <div className="flex gap-2">
          <div className="skeleton-glass h-5 w-14 rounded-full" />
          <div className="skeleton-glass h-5 w-16 rounded-full" />
        </div>
        <div className="skeleton-glass h-16 rounded-2xl" />
        <div className="skeleton-glass ml-auto h-9 w-32 rounded-xl" />
      </div>
    </div>
  );
}
