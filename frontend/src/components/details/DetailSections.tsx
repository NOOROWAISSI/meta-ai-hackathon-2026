import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Clock3,
  ExternalLink,
  FileText,
  ShieldQuestion,
} from "lucide-react";
import type { ReactNode } from "react";
import { formatDate } from "@/lib/discover/logic";
import type { EventDetails, FitMatch, FitStatus } from "@/lib/details/types";

export function DetailPanel({
  title,
  eyebrow,
  children,
  className = "",
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`glass-strong rounded-3xl p-5 sm:p-6 ${className}`}>
      {eyebrow && (
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">
          {eyebrow}
        </p>
      )}
      <h2 className="mb-4 text-lg font-bold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
export function FitBadge({ status }: { status: FitStatus }) {
  const Icon =
    status === "Supported"
      ? Check
      : status === "Not met" || status === "Source conflict"
        ? AlertCircle
        : ShieldQuestion;
  return (
    <span className={`fit-badge fit-${status.toLowerCase().replaceAll(" ", "-")}`}>
      <Icon className="size-3.5" aria-hidden />
      {status}
    </span>
  );
}
export function RequirementRow({ match }: { match: FitMatch }) {
  const r = match.requirement;
  return (
    <article className="rounded-2xl border border-glass-border bg-card/35 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {r.lane === "preparation"
              ? "Preparation advice"
              : r.mandatory
                ? "Mandatory condition · completeness unverified"
                : "Practical check"}
          </p>
          <h4 className="text-sm font-semibold leading-relaxed">{r.statement}</h4>
        </div>
        <FitBadge status={match.status} />
      </div>
      <details className="mt-3 rounded-xl border border-primary/10 p-3 text-xs">
        <summary className="cursor-pointer font-semibold text-primary">
          Explanation, next step & source
        </summary>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{match.explanation}</p>
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <FileText className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {match.profileEvidence}
        </p>
        {match.nextAction && (
          <p className="mt-3 rounded-xl bg-secondary/65 px-3 py-2 text-xs leading-relaxed">
            <span className="font-semibold">Next check: </span>
            {match.nextAction}
          </p>
        )}
        <p className="mt-3 font-medium">Original organizer passage: not available.</p>
        <p className="mt-1 leading-relaxed text-muted-foreground">
          {r.sourceStatus === "reviewed-demo"
            ? "Simulated reviewed condition for state testing only. This is not a verified organizer rule."
            : "No reviewed organizer evidence is attached to this synthetic record."}
        </p>
        {r.passage && (
          <blockquote className="mt-3 border-l-2 border-primary/30 pl-3 leading-relaxed text-muted-foreground">
            <span className="mb-1 block text-[10px] font-semibold uppercase">
              Demo record excerpt
            </span>
            {r.passage}
          </blockquote>
        )}
        {r.conflictingPassage && (
          <blockquote className="mt-3 border-l-2 border-destructive/40 pl-3 leading-relaxed">
            <span className="mb-1 block font-semibold">Conflicting demo claim</span>
            {r.conflictingPassage}
          </blockquote>
        )}
        <a
          href={r.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 font-semibold text-primary underline underline-offset-4"
        >
          Open placeholder source <ExternalLink className="size-3" aria-hidden />
        </a>
      </details>
    </article>
  );
}
export function EventTimeline({ details }: { details: EventDetails }) {
  return (
    <DetailPanel title="The event, step by step" eyebrow="Published milestones">
      <ol className="space-y-0">
        {details.timeline.map((milestone, index) => (
          <li key={milestone.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="relative flex w-8 shrink-0 justify-center">
              {index < details.timeline.length - 1 && (
                <span aria-hidden className="absolute bottom-[-8px] top-8 w-px bg-primary/20" />
              )}
              <span className="relative grid size-8 place-items-center rounded-full border border-primary/20 bg-secondary text-primary">
                <Clock3 className="size-3.5" aria-hidden />
              </span>
            </div>
            <div className="pt-1">
              <p className="text-sm font-semibold">{milestone.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(milestone.date)} · time zone not specified
              </p>
              {milestone.conflictingDate && (
                <p className="mt-2 rounded-lg bg-warning p-2 text-xs text-warning-ink">
                  Source conflict: another simulated claim says{" "}
                  {formatDate(milestone.conflictingDate)}. Neither date is confirmed.
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!details.timeline.length && (
        <p className="text-sm text-muted-foreground">No milestones are specified.</p>
      )}
      <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
        Unverified demo dates. Registration opening, project submission, and results are not
        specified and have not been added to this timeline. No countdown is shown.
      </p>
    </DetailPanel>
  );
}
export function SourcesPanel({ details }: { details: EventDetails }) {
  const h = details.event;
  return (
    <DetailPanel title="Know where it comes from" eyebrow="Sources & freshness">
      <dl className="space-y-3 text-sm">
        {[
          ["Organizer", h.organizer],
          ["Listing website / host", details.listingHost ?? "Not specified"],
          [
            "Last-reviewed date",
            `${formatDate(h.lastReviewed)} · fictional snapshot, not a verified source review`,
          ],
          ["Rules page", details.rulesUrl ?? "Not specified"],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-1 leading-relaxed">{value}</dd>
          </div>
        ))}
      </dl>
      <a
        href={h.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 break-all text-sm font-semibold text-primary underline underline-offset-4"
      >
        Official-page placeholder <ArrowUpRight className="size-4 shrink-0" aria-hidden />
      </a>
      <p className="mt-2 break-all text-xs text-muted-foreground">{h.sourceUrl}</p>
      <p className="mt-3 rounded-xl bg-warning p-3 text-xs leading-relaxed text-warning-ink">
        All events and links are fictional. No live organizer page, listing host, review, or rule
        passage has been verified. A source-link failure does not invalidate this dated demo
        snapshot.
      </p>
      {h.uncertainties.length > 0 && (
        <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground">
          {h.uncertainties.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
      {details.sourceState === "conflicting" && (
        <p className="mt-3 text-xs text-warning-ink">
          Conflicting claims remain visible in the timeline and requirement source disclosures.
        </p>
      )}
    </DetailPanel>
  );
}
