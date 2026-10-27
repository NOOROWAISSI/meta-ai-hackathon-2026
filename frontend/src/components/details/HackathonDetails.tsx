import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CalendarDays,
  Clock3,
  ExternalLink,
  Globe2,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVisitState } from "@/components/VisitMemory";
import { askOpportunity, fetchEventDetails, requestPersonalAnalysis } from "@/lib/details/api";
import {
  analysisContext,
  evaluateRequirement,
  hasHardBlocker,
  hasPersonalProfile,
  startTimeInZone,
} from "@/lib/details/logic";
import type { AnalysisSnapshot, DetailsState, Lane, OpportunityAnswer } from "@/lib/details/types";
import { formatDate, teamLabel } from "@/lib/discover/logic";
import type { UserProfile } from "@/lib/discover/types";
import { DetailPanel, EventTimeline, SourcesPanel } from "./DetailSections";
import { AnalysisInsights, FitMap } from "./FitMap";
import { PreparationPanel } from "./PreparationPanel";

const PREVIEW_STATES: DetailsState[] = [
  "normal",
  "loading",
  "unavailable",
  "source-unavailable",
  "stale",
  "conflicting-dates",
  "incomplete-profile",
  "ai-error",
  "hard-blocker",
];
const QUESTIONS = [
  "What are the most important requirements?",
  "Can I participate on my own?",
  "What should I prepare first?",
];
const LANES: { id: Lane; title: string; description: string }[] = [
  {
    id: "participation",
    title: "Participation eligibility",
    description:
      "Who may enter. Only checked mandatory conditions can establish a blocker; incomplete coverage stays uncertain.",
  },
  {
    id: "submission",
    title: "Mandatory submission items",
    description:
      "What a project must include. An unanswered checklist is unknown, not evidence that an item is missing.",
  },
  {
    id: "access",
    title: "Practical access constraints",
    description: "Attendance, venue, travel, equipment, and other arrangements to verify.",
  },
  {
    id: "preparation",
    title: "Useful preparation skills",
    description:
      "Advisory skills from the fictional record. These are separate from participation conditions.",
  },
];
const EMPTY_PROFILE: UserProfile = { interests: [], skills: [], weeklyHours: null };
const date = (value: string | null) => (value ? formatDate(value) : "Not specified");

export function HackathonDetails({
  eventId,
  profile,
  saved,
  onToggleSave,
  onEditProfile,
  requestUpdate = false,
  onBack,
}: {
  eventId: string;
  profile: UserProfile;
  saved: boolean;
  onToggleSave: () => void;
  onEditProfile?: () => void;
  requestUpdate?: boolean;
  onSaveProfile?: (profile: UserProfile) => boolean;
  onBack: () => void;
}) {
  const [state, setState] = useState<DetailsState>("normal");
  const [tab, setTab] = useVisitState(`details.tab.${eventId}`, "overview");

  const [timeZone, setTimeZone] = useState("UTC");
  const [snapshot, setSnapshot] = useVisitState<AnalysisSnapshot | null>(
    `details.analysis.${eventId}`,
    null,
  );
  const restoredSnapshot = useRef(snapshot);
  const explicitUpdateHandled = useRef(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<OpportunityAnswer | null>(null);
  const initialRequest = useRef("");
  const pageHeading = useRef<HTMLHeadingElement>(null);
  const query = useQuery({
    queryKey: ["event-details", eventId, state],
    queryFn: () => fetchEventDetails(eventId, state),
    retry: false,
  });
  const details = query.data;
  const eventTitle = details?.event.title;
  useEffect(() => {
    if (!eventTitle) return;
    const previousTitle = document.title;
    document.title = `${eventTitle} — NextStep`;
    const frame = requestAnimationFrame(() => pageHeading.current?.focus({ preventScroll: true }));
    return () => {
      cancelAnimationFrame(frame);
      document.title = previousTitle;
    };
  }, [eventTitle]);
  const effectiveProfile = useMemo(
    () =>
      state === "incomplete-profile"
        ? EMPTY_PROFILE
        : state === "hard-blocker"
          ? { ...profile, entrantType: "solo" as const, teamSize: 1 }
          : profile,
    [profile, state],
  );
  const context = details ? analysisContext(details, effectiveProfile) : "";
  const contextRef = useRef(context);
  contextRef.current = context;
  const analysis = useMutation({
    mutationFn: ({
      fail,
      record,
      facts,
    }: {
      fail: boolean;
      record: NonNullable<typeof details>;
      facts: UserProfile;
    }) => requestPersonalAnalysis(record, facts, fail),
    onSuccess: (result) => {
      if (contextRef.current === result.context) setSnapshot(result);
    },
  });
  const { mutate: generateAnalysis } = analysis;
  const qa = useMutation({
    mutationFn: ({
      text,
      record,
      facts,
    }: {
      text: string;
      record: NonNullable<typeof details>;
      facts: UserProfile;
    }) => askOpportunity(record, facts, text),
    onSuccess: (result) => {
      if (contextRef.current === result.context) setAnswer(result);
    },
  });
  const currentMatches = useMemo(
    () =>
      details?.requirements.map((requirement) =>
        evaluateRequirement(requirement, effectiveProfile),
      ) ?? [],
    [details, effectiveProfile],
  );
  const blocked = hasHardBlocker(currentMatches);
  const outdated = !!snapshot && snapshot.context !== context;
  const matches = snapshot?.matches ?? currentMatches;
  const hasProfile = hasPersonalProfile(effectiveProfile);

  useEffect(() => {
    try {
      const zone =
        localStorage.getItem("nextstep.timezone") ??
        Intl.DateTimeFormat().resolvedOptions().timeZone;
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      setTimeZone(zone);
    } catch {
      /* UTC remains an explicit fallback. */
    }
  }, []);
  useEffect(() => {
    if (!details) return;
    const key = `${details.event.id}:${details.revision}:${details.sourceState}:${state}`;
    if (initialRequest.current === key) return;
    const restored = initialRequest.current === "" && !!restoredSnapshot.current;
    initialRequest.current = key;
    if (restored && !requestUpdate) return;
    generateAnalysis({ fail: state === "ai-error", record: details, facts: effectiveProfile });
  }, [details, state, effectiveProfile, generateAnalysis, requestUpdate]);
  useEffect(() => {
    if (requestUpdate && details && !explicitUpdateHandled.current) {
      explicitUpdateHandled.current = true;
      setTab("fit");
    }
  }, [requestUpdate, details, setTab]);

  const updateAnalysis = () => {
    if (details) generateAnalysis({ fail: false, record: details, facts: effectiveProfile });
  };
  const ask = (text: string) => {
    if (!text.trim() || !details) return;
    setQuestion(text.trim());
    qa.mutate({ text: text.trim(), record: details, facts: effectiveProfile });
  };
  const openPreparation = () => {
    setTab("preparation");
    requestAnimationFrame(() => {
      document.getElementById("prep-heading")?.focus({ preventScroll: true });
      document.getElementById("detail-tabs")?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
    });
  };

  const preview = import.meta.env.DEV && (
    <details className="mb-5 text-xs text-muted-foreground">
      <summary className="w-fit cursor-pointer rounded-lg px-2 py-1">
        Details preview controls
      </summary>
      <label
        htmlFor="details-state"
        className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-card/40 p-3"
      >
        Preview details state
        <select
          id="details-state"
          value={state}
          onChange={(e) => setState(e.target.value as DetailsState)}
          className="rounded-lg border border-input bg-card p-2"
        >
          {PREVIEW_STATES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
  const back = (
    <button
      type="button"
      onClick={onBack}
      className="mb-5 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-primary hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden /> Back to Discover
    </button>
  );
  if (query.isPending)
    return (
      <div>
        {preview}
        {back}
        <div role="status" aria-label="Loading hackathon details" className="space-y-5">
          <div className="glass-strong space-y-4 rounded-3xl p-8">
            <div className="skeleton-glass h-6 w-32 rounded-lg" />
            <div className="skeleton-glass h-10 w-3/4 rounded-lg" />
            <div className="skeleton-glass h-20 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((key) => (
              <div key={key} className="skeleton-glass h-28 rounded-2xl" />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Loading event details…</p>
        </div>
      </div>
    );
  if (query.isError || !details)
    return (
      <div>
        {preview}
        {back}
        <DetailPanel title="Event unavailable" eyebrow="Your place is preserved">
          <AlertCircle className="mb-4 size-8 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {query.isError
              ? query.error.message
              : "This event could not be found in the demo catalog."}
          </p>
          <button
            type="button"
            onClick={() => (state === "unavailable" ? setState("normal") : query.refetch())}
            className="detail-primary mt-5"
          >
            <RefreshCw className="size-4" aria-hidden /> Retry loading
          </button>
        </DetailPanel>
      </div>
    );
  const h = details.event;
  const solo = !h.team
    ? "Not specified"
    : h.team.kind === "solo" || h.team.kind === "either" || h.team.min === 1
      ? "Solo participation listed in demo"
      : "Teams listed; solo not confirmed";
  const zones = [
    ...new Set([timeZone, "UTC", "Asia/Hebron", "Europe/London", "America/New_York", "Asia/Dubai"]),
  ];
  const info = [
    {
      label: "Participation format",
      value: ({ online: "Online", onsite: "On-site", hybrid: "Hybrid" } as const)[h.mode],
      Icon: Globe2,
    },
    { label: "Location", value: h.location ?? "Not specified", Icon: MapPin },
    {
      label: "Event dates",
      value: `${date(h.eventStart)} → ${date(h.eventEnd)}`,
      Icon: CalendarDays,
    },
    {
      label: "Start time",
      value: startTimeInZone(details, timeZone),
      note: `Selected: ${timeZone}. Original: ${details.originalZone ?? "Not specified"}.`,
      Icon: Clock3,
    },
    { label: "Event duration", value: details.duration ?? "Not specified", Icon: Clock3 },
    {
      label: "Registration deadline",
      value: date(h.registrationDeadline),
      note: "Not the project submission deadline.",
      Icon: CalendarDays,
    },
    { label: "Submission deadline", value: date(details.submissionDeadline), Icon: CalendarDays },
    { label: "Solo & team rules", value: teamLabel(h) ?? "Not specified", note: solo, Icon: Users },
    ...(details.entryCost ? [{ label: "Entry cost", value: details.entryCost, Icon: Trophy }] : []),
  ];

  return (
    <div className="details-screen space-y-6 pb-28 lg:pb-0">
      {preview}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {back}
        <span className="mb-5 rounded-full border border-primary/15 bg-card/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Fictional event · unverified snapshot
        </span>
      </div>
      <header className="discovery-hero relative overflow-hidden rounded-3xl border border-primary/15 p-6 sm:p-8">
        <span aria-hidden className="ambient-bubble hero-orb" />
        <div className="relative z-10 max-w-3xl">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {h.topics.map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-primary/20 bg-card/45 px-3 py-1 text-xs font-medium text-primary"
              >
                {topic}
              </span>
            ))}
          </div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Organized by {h.organizer}
          </p>
          <h1
            ref={pageHeading}
            tabIndex={-1}
            className="mt-3 rounded-lg text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
          >
            {h.title}
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            {h.summary}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Intended participants:{" "}
            {details.participants ??
              "Not specified. The demo summary does not establish who is eligible."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={openPreparation} className="detail-primary">
              <Sparkles className="size-4" aria-hidden /> Prepare for this opportunity
            </button>
            <button
              type="button"
              aria-pressed={saved}
              onClick={onToggleSave}
              className="detail-secondary"
            >
              <Bookmark className={`size-4 ${saved ? "fill-current" : ""}`} aria-hidden />
              {saved ? "Saved" : "Save opportunity"}
            </button>
            <a href={h.sourceUrl} target="_blank" rel="noreferrer" className="detail-secondary">
              Visit official event <ExternalLink className="size-3.5" aria-hidden />
            </a>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Official event link is an example.org placeholder, not a live organizer page.
          </p>
        </div>
      </header>

      {state === "hard-blocker" && (
        <div
          role="status"
          className="rounded-2xl border border-destructive/25 bg-warning p-4 text-sm text-warning-ink"
        >
          <strong>Simulated blocker fixture.</strong> This preview substitutes a solo entrant and
          synthetic reviewed team condition. It is not your saved profile or a verified real-event
          decision.
        </div>
      )}
      {(details.sourceState === "stale" ||
        details.sourceState === "unavailable" ||
        details.sourceState === "conflicting") && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-warning p-4 text-sm text-warning-ink"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div>
            <strong>
              {details.sourceState === "stale"
                ? "Source snapshot is stale."
                : details.sourceState === "unavailable"
                  ? "Source is unavailable; the dated snapshot is preserved."
                  : "Conflicting demo source claims."}
            </strong>
            <p className="mt-1 text-xs leading-relaxed">
              Last snapshot: {date(h.lastReviewed)}. Verify current rules and dates with the
              organizer; no confident countdown or approval is shown.
            </p>
          </div>
        </div>
      )}

      <section aria-label="Key event information" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold tracking-tight">A few things to know</h2>
          <label
            htmlFor="event-timezone"
            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            Your time zone
            <select
              id="event-timezone"
              value={timeZone}
              onChange={(e) => {
                setTimeZone(e.target.value);
                try {
                  localStorage.setItem("nextstep.timezone", e.target.value);
                } catch {
                  /* Keep session selection. */
                }
              }}
              className="rounded-lg border border-input bg-card/80 px-2 py-1.5"
            >
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
        </div>
        <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {info.map(({ label, value, note, Icon }) => (
            <div key={label} className="glass rounded-2xl p-4">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className="size-3.5 text-primary" aria-hidden />
                {label}
              </dt>
              <dd className="mt-3 text-sm font-semibold leading-relaxed">{value}</dd>
              {note && (
                <dd className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{note}</dd>
              )}
            </div>
          ))}
        </dl>
        <p className="text-xs text-muted-foreground">
          Dates and team rules above come from fictional records. Exact times and time zones are not
          specified, so no conversion or countdown is guessed.
        </p>
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          <Tabs value={tab} onValueChange={setTab} id="detail-tabs" className="scroll-mt-24">
            <TabsList className="glass mb-4 grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1.5">
              <TabsTrigger value="overview" className="detail-tab">
                Overview
              </TabsTrigger>
              <TabsTrigger value="fit" className="detail-tab whitespace-normal">
                Requirements & My Fit
              </TabsTrigger>
              <TabsTrigger value="preparation" className="detail-tab">
                Preparation
              </TabsTrigger>
            </TabsList>
            {outdated && (
              <div
                role="status"
                className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-warning p-4 text-sm text-warning-ink"
              >
                <div className="flex-1">
                  <strong>Analysis outdated.</strong>
                  <p className="mt-1 text-xs">
                    Your profile or source context changed. Previous results retain their old
                    context until a new response is validated.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={updateAnalysis}
                  disabled={analysis.isPending}
                  className="detail-secondary"
                >
                  {analysis.isPending ? "Updating…" : "Update analysis"}
                </button>
              </div>
            )}
            <TabsContent value="overview" className="space-y-5">
              <DetailPanel title="A challenge worth exploring" eyebrow="Overview">
                <dl className="space-y-5">
                  {[
                    ["Challenge / theme", h.summary],
                    ["Expected project or deliverable", details.deliverable ?? "Not specified"],
                    [
                      "Allowed tools / required technologies",
                      details.technologies ?? "Not specified",
                    ],
                    ["Judging criteria", details.judging ?? "Not specified"],
                    [
                      "Important rules",
                      `${teamLabel(h) ?? "Team rules: not specified"}. Complete participation and submission rules are not specified.`,
                    ],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="mb-1 text-sm font-semibold">{label}</dt>
                      <dd className="text-sm leading-relaxed text-muted-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
              </DetailPanel>
              <DetailPanel title="What you can gain" eyebrow="Published in the demo summary">
                {details.benefits.length ? (
                  <ul className="flex flex-wrap gap-3">
                    {details.benefits.map((benefit) => (
                      <li
                        key={benefit}
                        className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm font-medium"
                      >
                        <Trophy className="size-4 text-primary" aria-hidden />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Benefits are not specified in this record. Prizes, workshops, credits,
                    certificates, and networking opportunities are not assumed.
                  </p>
                )}
                <p className="mt-4 text-xs text-muted-foreground">
                  Fictional summary only; availability and conditions need organizer verification.
                </p>
              </DetailPanel>
              <button
                type="button"
                onClick={() => setTab("fit")}
                className="detail-secondary w-full"
              >
                Explore requirements & personal fit <ArrowRight className="size-4" aria-hidden />
              </button>
            </TabsContent>

            <TabsContent value="fit" className="space-y-5">
              <DetailPanel
                title="Your starting point"
                eyebrow="Quick snapshot"
                className="fit-editorial"
              >
                <div className="flex flex-wrap gap-2">
                  {[
                    ["Participation", blocked ? "Checked demo blocker" : "Needs verification"],
                    ["Submission readiness", "Needs verification"],
                    ["Preparation progress", "Tracked in your plan"],
                  ].map(([label, value]) => (
                    <span
                      key={label}
                      className="border-l-2 border-primary/20 pl-3 py-1 text-[10px] leading-relaxed"
                    >
                      <span className="text-muted-foreground">{label}: </span>
                      <span className="font-semibold">{value}</span>
                    </span>
                  ))}
                </div>
                {!hasProfile && (
                  <p className="mt-4 rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed">
                    Add a short profile for personal comparison. Public details and source
                    disclosures remain readable without one.
                  </p>
                )}
                <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                  Incomplete source coverage. These checks do not establish overall eligibility.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTab("fit");
                      onEditProfile?.();
                    }}
                    className="detail-secondary"
                  >
                    Edit my profile
                  </button>
                  <button
                    type="button"
                    onClick={updateAnalysis}
                    disabled={analysis.isPending}
                    className="detail-primary"
                  >
                    <RefreshCw
                      className={`size-4 ${analysis.isPending ? "animate-spin" : ""}`}
                      aria-hidden
                    />
                    {analysis.isPending ? "Updating analysis…" : "Update analysis"}
                  </button>
                </div>
              </DetailPanel>
              <FitMap matches={matches} lanes={LANES} />
              <DetailPanel
                title="Personal insights"
                eyebrow="Meta · Demo AI analysis"
                className="fit-editorial"
              >
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  Demo template · this event + your self-report. Open an insight for the full
                  explanation.
                </p>
                {analysis.isPending && (
                  <p
                    role="status"
                    className="mb-4 flex items-center gap-2 rounded-xl bg-secondary/60 p-3 text-sm"
                  >
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    Preparing demo analysis…
                  </p>
                )}
                {analysis.isError && (
                  <div
                    role="alert"
                    className="mb-4 rounded-xl bg-warning p-4 text-sm text-warning-ink"
                  >
                    <p>{analysis.error.message}</p>
                    <button
                      type="button"
                      onClick={updateAnalysis}
                      className="mt-2 font-semibold underline"
                    >
                      Retry analysis
                    </button>
                  </div>
                )}
                {snapshot ? (
                  <AnalysisInsights snapshot={snapshot} timeZone={timeZone} />
                ) : !analysis.isPending && !analysis.isError ? (
                  <p className="text-sm text-muted-foreground">
                    Analysis is not available yet. Use Update analysis.
                  </p>
                ) : null}
              </DetailPanel>
              <DetailPanel
                title="Ask about this opportunity"
                eyebrow="Context stays with this event"
              >
                <div className="flex flex-wrap items-start gap-2">
                  {QUESTIONS.map((text) => (
                    <button
                      key={text}
                      type="button"
                      onClick={() => ask(text)}
                      disabled={qa.isPending}
                      className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-left text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask(question);
                  }}
                  className="mt-4 flex gap-2"
                >
                  <label htmlFor="event-question" className="sr-only">
                    Your question about this opportunity
                  </label>
                  <input
                    id="event-question"
                    value={question}
                    maxLength={500}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question about this event…"
                    className="min-w-0 flex-1 rounded-xl border border-input bg-card p-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!question.trim() || qa.isPending}
                    aria-label="Ask question"
                    className="detail-primary px-3"
                  >
                    <Send className="size-4" aria-hidden />
                  </button>
                </form>
                {qa.isPending && (
                  <p
                    role="status"
                    className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    Reading the selected demo record…
                  </p>
                )}
                {qa.isError && (
                  <p role="alert" className="mt-4 text-sm text-warning-ink">
                    The demo answer could not be loaded. Try the question again.
                  </p>
                )}
                {answer && (
                  <div className="mt-4 rounded-2xl border border-primary/15 bg-secondary/50 p-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-primary">
                      Demo answer{answer.context !== context ? " · Outdated context" : ""}
                    </p>
                    <p className="text-sm font-semibold">{answer.question}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {answer.answer}
                    </p>
                    <a
                      href={answer.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary underline"
                    >
                      {answer.sourceLabel} <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </div>
                )}
              </DetailPanel>
            </TabsContent>
            <TabsContent value="preparation">
              <PreparationPanel
                details={details}
                profile={effectiveProfile}
                blocked={blocked}
                outdated={outdated}
                onOther={onBack}
                onUpdate={() => setTab("fit")}
              />
            </TabsContent>
          </Tabs>
        </div>
        <aside className="space-y-5">
          <details
            open={tab !== "fit"}
            className={tab === "fit" ? "glass rounded-3xl p-5" : "space-y-5"}
          >
            <summary
              className={
                tab === "fit" ? "cursor-pointer text-sm font-semibold text-primary" : "hidden"
              }
            >
              Timeline & sources
            </summary>
            <div className={tab === "fit" ? "mt-4 space-y-4" : "space-y-5"}>
              <EventTimeline details={details} />
              <SourcesPanel details={details} />
            </div>
          </details>
          <div className="glass rounded-3xl p-5">
            <ShieldCheck className="mb-3 size-6 text-primary" aria-hidden />
            <h2 className="text-sm font-semibold">Relevance is not eligibility</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              A useful connection to your interests can help you decide what to explore. Organizer
              rules, submission requirements, and practical access still need their own checks.
            </p>
          </div>
        </aside>
      </div>

      <div className="detail-mobile-action glass-strong fixed inset-x-4 bottom-[5.4rem] z-20 rounded-2xl p-2 lg:hidden">
        <button type="button" onClick={openPreparation} className="detail-primary w-full">
          <Sparkles className="size-4" aria-hidden />
          {blocked ? "Review participation blocker" : "Preparation options"}
          <ArrowRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
