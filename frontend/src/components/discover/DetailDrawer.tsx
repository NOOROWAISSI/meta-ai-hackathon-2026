import {
  AlertTriangle,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatDate, formatEventDates, teamLabel } from "@/lib/discover/logic";
import type { Hackathon } from "@/lib/discover/types";
import { ACCENTS } from "./accents";
import { DeadlineLine } from "./HackathonCard";

const MODE_LABEL = { online: "Online", onsite: "On-site", hybrid: "Hybrid" } as const;

interface Props {
  h: Hackathon | null;
  reason?: string;
  saved: boolean;
  onToggleSave: () => void;
  onClose: () => void;
}

export function DetailDrawer({ h, reason, saved, onToggleSave, onClose }: Props) {
  return (
    <Sheet open={!!h} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto border-l-glass-border bg-popover/95 p-0 backdrop-blur-xl sm:max-w-lg">
        {h && (
          <>
            <div className={cn("h-28", ACCENTS[h.accent].strip)} />
            <div className="space-y-6 p-6">
              <SheetHeader className="space-y-1 p-0 text-left">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Demo opportunity · fictional
                </span>
                <SheetTitle className="text-2xl font-bold tracking-tight">{h.title}</SheetTitle>
                <SheetDescription>{h.organizer}</SheetDescription>
              </SheetHeader>

              <p className="leading-relaxed">{h.summary}</p>

              <dl className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Format", MODE_LABEL[h.mode] + (h.location ? ` · ${h.location}` : "")],
                  ["Registration deadline", <DeadlineLine key="d" h={h} />],
                  ["Event dates", formatEventDates(h)],
                  ["Team rules", teamLabel(h) ?? "Not listed"],
                  ["Topics", h.topics.join(", ")],
                  ["Demo snapshot (unverified)", formatDate(h.lastReviewed)],
                ].map(([k, v]) => (
                  <div key={k as string} className="rounded-2xl bg-muted p-3">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="mt-0.5 font-medium">{v}</dd>
                  </div>
                ))}
              </dl>

              {reason && (
                <section className={cn("rounded-2xl border p-4", ACCENTS[h.accent].tint)}>
                  <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                    <Sparkles className="size-4" aria-hidden /> Why this is for you
                    <span className="ml-auto text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      AI recommendation
                    </span>
                  </h3>
                  <p className="mt-1 text-sm">{reason}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Relevance, not eligibility. Confirm the rules with the organizer.
                  </p>
                </section>
              )}

              <section>
                <h3 className="text-sm font-semibold">Things to verify</h3>
                {h.uncertainties.length ? (
                  <ul className="mt-2 space-y-2">
                    {h.uncertainties.map((u) => (
                      <li
                        key={u}
                        className="flex items-start gap-2 rounded-xl bg-warning px-3 py-2 text-sm text-warning-ink"
                      >
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {u}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 flex items-center gap-2 text-sm text-teal-ink">
                    <CheckCircle2 className="size-4" aria-hidden /> No open questions in the demo
                    record. Still check official rules.
                  </p>
                )}
              </section>

              <section>
                <h3 className="text-sm font-semibold">Source</h3>
                <a
                  href={h.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {h.sourceUrl.replace("https://", "")}{" "}
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <p className="text-xs text-muted-foreground">
                  Placeholder link — not a real event page.
                </p>
              </section>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Preparation plans are coming soon", {
                      description:
                        "No plan has been generated. My Plans is a placeholder in this build.",
                    })
                  }
                  className="transition-soft inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-button hover:-translate-y-0.5 active:scale-95"
                >
                  <ListChecks className="size-4" aria-hidden /> Prepare for this opportunity
                </button>
                <button
                  type="button"
                  onClick={onToggleSave}
                  aria-pressed={saved}
                  className="transition-soft inline-flex items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 py-3 text-sm font-semibold hover:bg-accent active:scale-95"
                >
                  <Bookmark
                    className={cn("size-4", saved && "fill-current text-primary")}
                    aria-hidden
                  />{" "}
                  {saved ? "Saved" : "Save"}
                </button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
