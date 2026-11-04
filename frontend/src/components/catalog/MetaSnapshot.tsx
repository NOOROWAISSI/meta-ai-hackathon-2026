import { ArrowUpRight, BookOpen, ChevronDown, CircleHelp, Sparkles } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { MetaBriefing } from "@/lib/catalog/briefing";
import { StartingPointComparison } from "./StartingPointComparison";

export function MetaSnapshot({
  briefing,
  loading,
}: {
  briefing: MetaBriefing | undefined;
  loading: boolean;
}) {
  const { t, language } = useLocale();
  if (!briefing)
    return (
      <div className="meta-snapshot meta-snapshot-preview" aria-busy={loading}>
        <div
          className={`meta-snapshot-orb ${loading ? "motion-safe:animate-pulse" : ""}`}
          aria-hidden
        >
          <Sparkles className="size-6" />
        </div>
        <div>
          <p className="font-semibold">
            {loading
              ? t("Reading your preparation context…", "بنقرأ سياق تجربتك والتحضير…")
              : t(
                  "Compare the challenge with what you have actually done.",
                  "قارن التحدي بالشغل اللي جرّبته فعلًا.",
                )}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {t(
              "Your goal, project descriptions and confirmed hands-on experience determine a starting point. A shared topic does not determine your level.",
              "هدفك ووصف مشاريعك وتجربتك العملية المؤكدة بيحددوا نقطة البداية. تشابه الموضوع ما بيحدد مستواك.",
            )}
          </p>
        </div>
      </div>
    );
  const first = briefing.startingPoint?.nextAction ?? briefing.preparationPriorities[0];
  const more = briefing.preparationPriorities.filter((item) => item !== first);
  return (
    <div className="meta-snapshot" aria-busy={loading}>
      {briefing.startingPoint ? (
        <StartingPointComparison
          key={`${briefing.context.profileVersion}:${briefing.context.language}`}
          data={briefing.startingPoint}
          context={briefing.context}
        />
      ) : (
        <div className="p-6">
          <h3 className="font-semibold">
            {t("Experience comparison not available yet", "مقارنة التجربة لسه مش متوفرة")}
          </h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {t(
              "No hands-on starting point was returned. An interest tag alone cannot establish a level or suitability.",
              "ما رجعت معلومات عن نقطة البداية العملية. وسم الاهتمام لحاله ما بحدد مستوى أو ملاءمة.",
            )}
          </p>
        </div>
      )}
      <div className="starting-point-action">
        <span className="meta-snapshot-step" aria-hidden>
          01
        </span>
        <div className="min-w-0 flex-1">
          <p className="meta-snapshot-eyebrow">
            {t("YOUR NEXT USEFUL STEP", "خطوتك العملية الجاية")}
          </p>
          <h3 className="mt-3 text-base font-semibold leading-8" dir="auto">
            {first ?? t("No preparation action was returned.", "ما رجعت خطوة تحضير.")}
          </h3>
          {more.length > 0 && (
            <details className="meta-snapshot-disclosure mt-3">
              <summary>
                {t(
                  `${more.length} other preparation ${more.length === 1 ? "direction" : "directions"}`,
                  more.length === 1 ? "اتجاه تحضير إضافي" : `${more.length} اتجاهات تحضير إضافية`,
                )}
                <ChevronDown className="meta-snapshot-chevron size-4" aria-hidden />
              </summary>
              <ol className="meta-snapshot-priorities">
                {more.map((item, index) => (
                  <li key={index}>
                    <span aria-hidden>{String(index + 2).padStart(2, "0")}</span>
                    <p dir="auto">{item}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            {t(
              "Confirmed self-report guides preparation. Organizer participation requirements are checked separately.",
              "التحضير مبني على وصفك المؤكد لتجربتك. شروط المشاركة إلها فحص منفصل.",
            )}
          </p>
        </div>
      </div>
      <details className="meta-snapshot-questions meta-snapshot-disclosure">
        <summary>
          <span className="flex items-center gap-3">
            <CircleHelp className="size-5 shrink-0" aria-hidden />
            {t("Questions that still need an answer", "أسئلة لسه بدها جواب")}
          </span>
          <ChevronDown className="meta-snapshot-chevron size-4" aria-hidden />
        </summary>
        {briefing.questionsToClarify.length ? (
          <ul className="space-y-3 pt-4 text-sm leading-7">
            {briefing.questionsToClarify.map((item, index) => (
              <li key={index} dir="auto">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-3 text-sm">
            {t("No additional questions were returned.", "ما رجعت أسئلة إضافية.")}
          </p>
        )}
      </details>
      <details className="meta-snapshot-sources meta-snapshot-disclosure">
        <summary>
          <span className="flex items-center gap-2">
            <BookOpen className="size-4" aria-hidden />
            {t("Analysis context & original sources", "سياق المقارنة والمصادر الأصلية")}
          </span>
          <ChevronDown className="meta-snapshot-chevron size-4" aria-hidden />
        </summary>
        <p className="mt-3 text-sm leading-7 text-muted-foreground" dir="auto">
          {briefing.overview}
        </p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground" dir="auto">
          {briefing.personalRelevance}
        </p>
        {!!briefing.sources?.length && (
          <div className="mt-4">
            <p className="text-xs font-semibold">
              {t("Original sources used for this explanation", "المصادر الأصلية لهذا التفسير")}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {briefing.sources.map((source) => (
                <li key={source.url}>
                  <a
                    className="meta-snapshot-source"
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {source.label}
                    <ArrowUpRight className="size-3 rtl:-scale-x-100" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {briefing.generatedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Generated", "تم إنشاء المقارنة")}:{" "}
            {new Date(briefing.generatedAt).toLocaleString(language)}
          </p>
        )}
      </details>
    </div>
  );
}
