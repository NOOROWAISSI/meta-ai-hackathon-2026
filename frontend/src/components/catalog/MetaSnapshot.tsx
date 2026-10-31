import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Compass,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { MetaBriefing } from "@/lib/catalog/briefing";

export function MetaSnapshot({
  briefing,
  interests,
  loading,
}: {
  briefing: MetaBriefing | undefined;
  interests: string[];
  loading: boolean;
}) {
  const { t, language } = useLocale();
  if (!briefing)
    return (
      <div className="meta-snapshot meta-snapshot-preview" aria-busy={loading}>
        <div className={`meta-snapshot-orb ${loading ? "animate-pulse" : ""}`} aria-hidden>
          <Sparkles className="size-6" />
        </div>
        <div>
          <p className="font-semibold">
            {loading
              ? t("Finding your starting point…", "بنجهّز نقطة البداية إلك…")
              : t("Less reading. A clearer next move.", "حكي أقل. خطوتك أوضح.")}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t(
              "Your connection, a first step, and what to check.",
              "شو بيربطك بالفرصة، أول خطوة، وشو تتأكد منه.",
            )}
          </p>
          <div className="meta-snapshot-preview-track" aria-hidden>
            <span>{t("Your interests", "اهتماماتك")}</span>
            <ArrowRight className="size-3 rtl:rotate-180" />
            <span>{t("Next step", "خطوتك")}</span>
            <ArrowRight className="size-3 rtl:rotate-180" />
            <span>{t("Open questions", "أسئلة مفتوحة")}</span>
          </div>
        </div>
      </div>
    );

  const topics = [...new Set(interests)];
  const [first, ...more] = briefing.preparationPriorities;
  return (
    <div className="meta-snapshot" aria-busy={loading}>
      <div className="meta-snapshot-main">
        <div className="meta-snapshot-connection">
          <p className="meta-snapshot-eyebrow">{t("THE CONNECTION", "نقطة الوصل")}</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
            {topics.length
              ? t("A shared starting point.", "نقطة بداية مشتركة.")
              : t("Explore your starting point.", "اكتشف نقطة البداية إلك.")}
          </h3>
          <div className="meta-snapshot-bridge" aria-hidden>
            <div className="meta-snapshot-endpoint">
              <Compass className="size-5" />
              <span>{t("Opportunity", "الفرصة")}</span>
            </div>
            <span className="meta-snapshot-wire" />
            <div className="meta-snapshot-orb">
              <Sparkles className="size-6" />
            </div>
            <span className="meta-snapshot-wire" />
            <div className="meta-snapshot-endpoint">
              <UserRound className="size-5" />
              <span>{t("You", "إنت")}</span>
            </div>
          </div>
          <div className="meta-snapshot-topics">
            {topics.length ? (
              topics.map((topic) => (
                <span key={topic} className="meta-snapshot-topic">
                  {topic}
                </span>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">
                {t(
                  "No shared topic tags in your saved information.",
                  "ما في مواضيع مشتركة مسجّلة بالمعلومات الحالية.",
                )}
              </span>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            {t(
              "Shared tags from the listing and your saved interests.",
              "المواضيع المشتركة بين الفرصة واهتماماتك المحفوظة.",
            )}
          </p>
          <details className="meta-snapshot-disclosure mt-5">
            <summary>
              {t("Why this connection?", "شو سبب هالارتباط؟")}
              <ChevronDown className="meta-snapshot-chevron size-4" aria-hidden />
            </summary>
            <p className="pt-3 text-sm leading-7 text-muted-foreground" dir="auto">
              {briefing.personalRelevance}
            </p>
          </details>
        </div>

        <div className="meta-snapshot-next">
          <div className="flex items-center gap-3">
            <span className="meta-snapshot-step" aria-hidden>
              01
            </span>
            <p className="meta-snapshot-eyebrow">{t("START HERE", "بلّش من هون")}</p>
          </div>
          <h3 className="mt-5 text-lg font-semibold leading-8" dir="auto">
            {first ??
              t("No preparation priority was returned.", "ما رجعت أولوية تحضير ضمن التفسير.")}
          </h3>
          {more.length > 0 && (
            <details className="meta-snapshot-disclosure mt-5">
              <summary>
                {t(
                  `${more.length} more ${more.length === 1 ? "priority" : "priorities"}`,
                  more.length === 1 ? "أولوية إضافية" : `${more.length} أولويات إضافية`,
                )}
                <ChevronDown className="meta-snapshot-chevron size-4" aria-hidden />
              </summary>
              <ol className="meta-snapshot-priorities" start={2}>
                {more.map((text, index) => (
                  <li key={index}>
                    <span aria-hidden>{String(index + 2).padStart(2, "0")}</span>
                    <p dir="auto">{text}</p>
                  </li>
                ))}
              </ol>
            </details>
          )}
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            {t(
              "Preparation advice. Participation checks stay separate.",
              "نصيحة للتحضير. شروط المشاركة إلها فحص منفصل.",
            )}
          </p>
        </div>
      </div>

      <details className="meta-snapshot-questions meta-snapshot-disclosure">
        <summary>
          <span className="flex min-w-0 items-center gap-3">
            <CircleHelp className="size-5 shrink-0" aria-hidden />
            <span>
              {t(
                `${briefing.questionsToClarify.length} ${briefing.questionsToClarify.length === 1 ? "question" : "questions"} to clear up`,
                briefing.questionsToClarify.length === 1
                  ? "سؤال بده توضيح"
                  : `${briefing.questionsToClarify.length} أسئلة بدها توضيح`,
              )}
            </span>
          </span>
          <ChevronDown className="meta-snapshot-chevron size-4 shrink-0" aria-hidden />
        </summary>
        {briefing.questionsToClarify.length ? (
          <ul className="space-y-3 pt-4 text-sm leading-7">
            {briefing.questionsToClarify.map((question, index) => (
              <li key={index} className="flex gap-3">
                <span className="mt-3 size-1 shrink-0 rounded-full bg-current" aria-hidden />
                <span dir="auto">{question}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pt-3 text-sm">
            {t("No clarification questions were returned.", "ما رجعت أسئلة توضيحية ضمن التفسير.")}
          </p>
        )}
      </details>

      <details className="meta-snapshot-sources meta-snapshot-disclosure">
        <summary>
          <span className="flex items-center gap-2">
            <BookOpen className="size-4" aria-hidden />
            {t("Overview & original sources", "الملخّص والمصادر الأصلية")}
          </span>
          <ChevronDown className="meta-snapshot-chevron size-4" aria-hidden />
        </summary>
        <p className="mt-4 text-sm leading-7 text-muted-foreground" dir="auto">
          {briefing.overview}
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
                    <ArrowRight className="size-3 -rotate-45 rtl:-rotate-135" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {briefing.generatedAt && (
          <p className="mt-3 text-xs text-muted-foreground">
            {t("Generated", "تم إنشاء التفسير")}:{" "}
            {new Date(briefing.generatedAt).toLocaleString(language)}
          </p>
        )}
      </details>
    </div>
  );
}
