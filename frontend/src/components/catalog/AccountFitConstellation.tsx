import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FitMap } from "@/components/details/FitMap";
import { FitBadge } from "@/components/details/DetailSections";
import { useAuth } from "@/components/auth/AuthProvider";
import { accountApi } from "@/lib/account/api";
import type { FitStatus, Lane } from "@/lib/details/types";
import type { MatchStatus } from "@/lib/contract/types";
import type { AccountProfileFacts } from "@/lib/catalog/briefing";

const LABELS: Record<MatchStatus, FitStatus> = {
  supported: "Supported",
  not_met: "Not met",
  unknown: "Unknown",
  source_conflict: "Source conflict",
  not_applicable: "Not applicable",
};
const LANES: { id: Lane; title: string; description: string }[] = [
  {
    id: "participation",
    title: "Participation",
    description: "Published entry and prize conditions. Incomplete information remains unknown.",
  },
  {
    id: "submission",
    title: "Submission",
    description: "Submission evidence is checked separately from completed preparation tasks.",
  },
  {
    id: "access",
    title: "Practical access",
    description: "Published logistics and practical constraints to verify.",
  },
  {
    id: "preparation",
    title: "Preparation",
    description: "Useful preparation advice, separate from mandatory organizer conditions.",
  },
];
export function AccountFitConstellation({
  opportunityId,
  profile,
}: {
  opportunityId: string;
  profile?: AccountProfileFacts;
}) {
  const auth = useAuth();
  const canonical = /^E\d+$/.test(opportunityId);
  const opportunity = useQuery({
    queryKey: ["canonical-opportunity", opportunityId],
    queryFn: () => accountApi.opportunity(opportunityId),
    enabled: canonical,
    retry: false,
  });
  const comparison = useQuery({
    queryKey: ["account", auth?.user?.id, "fit", opportunityId, opportunity.data?.sourceRevision],
    queryFn: async () => {
      const [profile, submission] = await Promise.all([
        accountApi.profile(),
        accountApi.submission(opportunityId),
      ]);
      return accountApi.analyze(opportunity.data!, profile, submission);
    },
    enabled: canonical && !!opportunity.data && !!auth?.user,
    retry: false,
  });
  const matches = (opportunity.data?.requirements ?? []).map((requirement) => {
    const result = comparison.data?.matches.find((match) => match.requirementId === requirement.id);
    return {
      requirement: {
        ...requirement,
        lane: (requirement.lane === "logistics"
          ? "access"
          : requirement.lane === "prize"
            ? "participation"
            : requirement.lane) as Lane,
      },
      status: result
        ? LABELS[result.status]
        : requirement.sourceStatus === "conflicting"
          ? ("Source conflict" as const)
          : ("Unknown" as const),
      result,
    };
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Source-backed checks · no eligibility or readiness score
        </p>
        <Link to="/profile" search={{ event: opportunityId }} className="detail-secondary">
          Edit my profile
        </Link>
      </div>
      {(opportunity.isFetching || comparison.isFetching) && (
        <p role="status" className="text-sm text-muted-foreground">
          Updating source-backed checks…
        </p>
      )}
      {(opportunity.isError || comparison.isError) && (
        <div role="alert" className="prep-error">
          The checks could not be refreshed.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              void opportunity.refetch();
              void comparison.refetch();
            }}
          >
            Retry
          </button>
        </div>
      )}
      {!auth?.user && (
        <p className="text-sm text-muted-foreground">
          Sign in to compare your saved profile. Published rules remain available to read.
        </p>
      )}
      {!canonical && (
        <p className="text-sm text-muted-foreground">
          A reviewed requirement record is not available for this listing yet. Conditions remain
          unknown.
        </p>
      )}
      <FitMap
        matches={matches}
        lanes={LANES}
        renderMatch={({ requirement, result, status }) => (
          <article className="rounded-2xl border border-glass-border bg-card/35 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h4 className="flex-1 text-sm font-semibold">{requirement.statement}</h4>
              <FitBadge status={status} />
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {result?.explanation ??
                "Personal comparison is unavailable; no pass or failure is inferred."}
            </p>
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer font-semibold text-primary">
                Evidence & original source
              </summary>
              <p className="mt-3 text-muted-foreground">
                {result?.evidenceLevel.replaceAll("_", " ") ?? "No profile evidence"} · source{" "}
                {requirement.sourceStatus}
              </p>
              {requirement.sourceEvidenceIds
                .map((id) => opportunity.data?.sourceEvidence.find((source) => source.id === id))
                .filter((source) => !!source)
                .map((source) => (
                  <blockquote
                    key={source.id}
                    className="mt-3 border-s-2 border-primary/30 ps-3 leading-6"
                  >
                    <p>{source.passage}</p>
                    <a
                      className="text-primary underline"
                      href={source.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Original source
                    </a>
                  </blockquote>
                ))}
              {result?.clarificationQuestion && (
                <p className="mt-3">Next check: {result.clarificationQuestion.question}</p>
              )}
            </details>
          </article>
        )}
      />
      {profile && (
        <section className="fit-insights-journal" aria-label="Your confirmed profile context">
          {[
            {
              title: "Your interests & goals",
              text:
                [...profile.interests, ...profile.goals.map((goal) => goal.statement)].join(
                  " · ",
                ) || "Not provided",
            },
            {
              title: "Experience you reported",
              text:
                profile.skills
                  .filter((skill) => skill.state === "reported_has")
                  .map((skill) => skill.label)
                  .join(" · ") || "Not provided",
            },
            {
              title: "Your preparation time",
              text:
                profile.availableHoursPerWeek.state === "known"
                  ? `${profile.availableHoursPerWeek.value} hours per week`
                  : "Availability unknown",
            },
          ].map((entry, index) => (
            <details key={entry.title} className="fit-insight">
              <summary className="cursor-pointer list-none">
                <span className="fit-insight-number" aria-hidden>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="flex items-center justify-between gap-3 text-xs font-semibold">
                  {entry.title}
                  <span className="fit-insight-plus text-primary" aria-hidden>
                    +
                  </span>
                </span>
                <span className="mt-2 block truncate text-[11px] text-muted-foreground">
                  {entry.text}
                </span>
              </summary>
              <p className="mt-3 text-xs leading-7 text-muted-foreground">{entry.text}</p>
            </details>
          ))}
        </section>
      )}
      <button
        type="button"
        className="detail-secondary"
        disabled={!auth?.user || !canonical || comparison.isFetching}
        onClick={() => void comparison.refetch()}
      >
        Update analysis
      </button>
      <p className="text-xs text-muted-foreground">
        These are backend requirement checks. A Meta personal explanation is displayed separately
        when available.
      </p>
    </div>
  );
}
