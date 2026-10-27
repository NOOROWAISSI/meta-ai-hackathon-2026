import { FileCheck2, GraduationCap, MapPin, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import type { AnalysisSnapshot, FitMatch, Lane } from "@/lib/details/types";
import { RequirementRow } from "./DetailSections";

const ICONS = {
  participation: ShieldCheck,
  submission: FileCheck2,
  access: MapPin,
  preparation: GraduationCap,
};

export function FitMap({
  matches,
  lanes,
}: {
  matches: FitMatch[];
  lanes: { id: Lane; title: string; description: string }[];
}) {
  const [selected, setSelected] = useState<Lane | null>(null);
  const active = lanes.find((lane) => lane.id === selected);
  return (
    <section className="fit-observatory" aria-label="Explore your fit">
      <p className="text-[10px] uppercase tracking-[0.2em] text-primary">
        Your opportunity constellation
      </p>
      <h2 className="mt-1 text-xl font-bold">Explore your fit</h2>
      <div className="fit-map">
        <svg
          className="fit-orbits"
          viewBox="0 0 600 360"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <ellipse cx="300" cy="180" rx="248" ry="130" />
          <ellipse cx="300" cy="180" rx="180" ry="82" transform="rotate(-22 300 180)" />
          <path d="M300 180 L108 72 M300 180 L480 104 M300 180 L102 252 M300 180 L456 292" />
        </svg>
        <div className="fit-map-hub">
          <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
            <UserRound className="size-4" aria-hidden />
          </span>
          <span>
            <strong className="block text-sm">Your profile</strong>
            <span className="text-[10px] text-muted-foreground">
              Self-reported · no overall score
            </span>
          </span>
        </div>
        <div className="fit-map-branches" role="group" aria-label="Choose a requirement group">
          {lanes.map((lane) => {
            const entries = matches.filter((match) => match.requirement.lane === lane.id);
            const supported = entries.filter((match) => match.status === "Supported").length;
            const failed = entries.filter((match) => match.status === "Not met").length;
            const conflicts = entries.filter((match) => match.status === "Source conflict").length;
            const unknown = entries.filter((match) => match.status === "Unknown").length;
            const na = entries.filter((match) => match.status === "Not applicable").length;
            const Icon = ICONS[lane.id];
            return (
              <button
                key={lane.id}
                type="button"
                aria-pressed={selected === lane.id}
                aria-expanded={selected === lane.id}
                aria-controls="fit-group-details"
                onClick={() => setSelected(selected === lane.id ? null : lane.id)}
                className="fit-map-node"
              >
                <div className="fit-planet-wrap">
                  <span className="fit-map-icon">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {entries.length} {entries.length === 1 ? "check" : "checks"}
                  </span>
                </div>
                <span className="block text-sm font-semibold">{lane.title}</span>
                <span className="my-2 flex justify-center gap-1.5" aria-hidden>
                  {entries.map((match) => (
                    <span
                      key={match.requirement.id}
                      className={`fit-check-dot dot-${match.status.toLowerCase().replaceAll(" ", "-")}`}
                    />
                  ))}
                </span>
                <span className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-[10px] leading-relaxed text-muted-foreground">
                  {supported > 0 && (
                    <span className="text-[var(--galaxy-teal-ink)]">{supported} supported</span>
                  )}
                  {failed > 0 && <span className="text-destructive">{failed} not met</span>}
                  {conflicts > 0 && <span className="text-destructive">{conflicts} conflict</span>}
                  {unknown > 0 && <span>{unknown} unknown</span>}
                  {na > 0 && <span>{na} not applicable</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <p className="mb-5 text-[10px] text-muted-foreground">
        Each dot is one check. Planet sizes are decorative, not scores. Select a group to inspect it.
      </p>
      {active && (
        <section
          id="fit-group-details"
          aria-label={active.title}
          className="border-t border-primary/10 pt-5"
        >
          <h3 className="text-sm font-semibold">{active.title}</h3>
          <p className="mb-4 mt-1 text-xs leading-relaxed text-muted-foreground">
            {active.description}
          </p>
          <div className="space-y-2">
            {matches
              .filter((match) => match.requirement.lane === selected)
              .map((match) => (
                <RequirementRow key={match.requirement.id} match={match} />
              ))}
          </div>
        </section>
      )}
    </section>
  );
}

export function AnalysisInsights({
  snapshot,
  timeZone,
}: {
  snapshot: AnalysisSnapshot;
  timeZone: string;
}) {
  const teasers = [
    snapshot.profile.interests.length
      ? snapshot.profile.interests.join(" · ")
      : "Add your interests & goals",
    snapshot.profile.skills.length ? snapshot.profile.skills.join(" · ") : "No skills reported yet",
    "Rules · deadlines · time zone",
    "Project direction & skill practice",
    "Access · attendance · costs",
  ];
  return (
    <>
      <div className="fit-insights-journal">
        {snapshot.sections.map((section, index) => (
          <details key={section.title} className="fit-insight">
            <summary className="cursor-pointer list-none">
              <span className="fit-insight-number" aria-hidden>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold">{section.title}</span>
                <span aria-hidden className="fit-insight-plus text-base text-primary">
                  +
                </span>
              </span>
              <span className="mt-1.5 block truncate text-[11px] text-muted-foreground">
                {teasers[index]}
              </span>
            </summary>
            <p className="mt-3 whitespace-pre-wrap break-words border-t border-primary/10 pt-3 text-xs leading-relaxed text-muted-foreground">
              {section.text}
            </p>
          </details>
        ))}
      </div>
      <details className="mt-3 text-[10px] text-muted-foreground">
        <summary className="w-fit cursor-pointer">Analysis context</summary>
        <p className="mt-2">
          Demo generated {new Date(snapshot.generatedAt).toLocaleString("en-US", { timeZone })} (
          {timeZone}). Profile version: {snapshot.profile.version ?? 0}.
        </p>
      </details>
    </>
  );
}
