import { Award, Clock3, ExternalLink, Scale } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import type { Opportunity, TimelineKind } from "@/lib/contract/types";
import { isContractInstant } from "@/lib/contract/time";

export function PublishedEventOverview({ event }: { event: Opportunity }) {
  const { language, t } = useLocale();
  const labels: Record<TimelineKind, string> = {
    registration_open: t("Applications open", "فتح التقديم"),
    registration_close: t("Applications close", "إغلاق التقديم"),
    build_start: t("Hackathon begins", "بداية الهاكاثون"),
    build_end: t("Build phase ends", "نهاية مرحلة البناء"),
    submission_open: t("Submissions open", "فتح التسليم"),
    submission_close: t("Project submission", "تسليم المشروع"),
    judging_start: t("Judging begins", "بداية التحكيم"),
    judging_end: t("Judging ends", "نهاية التحكيم"),
    results: t("Results", "النتائج"),
  };
  const rubric = event.requirements
    .filter(
      (rule) =>
        rule.kind === "preparation_advice" &&
        rule.id.startsWith(`${event.id}-judging-`) &&
        rule.sourceStatus === "reviewed",
    )
    .map((rule) => {
      const match = (rule.claims[0]?.value ?? "").match(/^(.*): (\d{1,3})%$/);
      return { rule, label: match?.[1] ?? rule.statement, weight: match ? Number(match[2]) : null };
    })
    .filter((item) => item.weight !== null && item.weight >= 0 && item.weight <= 100);
  return (
    <div className="space-y-6">
      {!!event.benefits.length && (
        <section
          className="border-y border-primary/15 py-6"
          aria-labelledby="published-benefits-title"
        >
          <h2 id="published-benefits-title" className="flex items-center gap-2 text-xl font-bold">
            <Award className="size-5 text-primary" aria-hidden />
            {t("What you can gain", "شو ممكن تستفيد")}
          </h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {event.benefits.map((benefit, index) => (
              <li key={benefit} className="border-s-2 border-primary/25 ps-4">
                <span className="text-xs font-semibold tabular-nums text-primary" aria-hidden>
                  0{index + 1}
                </span>
                <p className="mt-2 text-sm leading-7" dir="auto">
                  {benefit}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div
        className={`grid gap-7 ${rubric.length ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : ""}`}
      >
        {!!event.timelineEvents.length && (
          <section
            id="published-event-timeline"
            className="glass scroll-mt-24 rounded-3xl p-5 sm:p-7"
            aria-labelledby="published-timeline-title"
          >
            <h2 id="published-timeline-title" className="flex items-center gap-2 text-xl font-bold">
              <Clock3 className="size-5 text-primary" aria-hidden />
              {t("Published timeline", "المواعيد المنشورة")}
            </h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {t(
                "Original timing stays visible. Dates without a confirmed instant are not used for countdowns or a timed preparation promise.",
                "التوقيت الأصلي ظاهر. التاريخ اللي ما إله لحظة زمنية مؤكدة ما بنستخدمه بعدّاد أو بوعد بخطة موقّتة.",
              )}
            </p>
            <ol className="mt-6 border-s border-primary/25 ps-5">
              {event.timelineEvents
                .filter((milestone) => milestone.claims.length)
                .map((milestone) => (
                  <li key={milestone.id} className="relative pb-6 last:pb-0">
                    <span
                      className="absolute -start-[25px] top-1 size-2 rounded-full bg-primary"
                      aria-hidden
                    />
                    <h3 className="text-sm font-semibold">{labels[milestone.kind]}</h3>
                    {milestone.sourceStatus === "conflicting" && (
                      <span className="mt-2 inline-block rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        {t(
                          "Source conflict — exact cutoff unconfirmed",
                          "تعارض بين المصادر — التوقيت الدقيق غير مؤكد",
                        )}
                      </span>
                    )}
                    {milestone.claims.map((claim) => (
                      <div key={claim.id} className="mt-2 text-sm leading-7 text-muted-foreground">
                        <p dir="auto">
                          {isContractInstant(claim.dateTime) &&
                          milestone.sourceStatus !== "conflicting"
                            ? new Date(claim.dateTime).toLocaleString(language)
                            : claim.publishedText}
                        </p>
                        <details className="mt-1 text-xs">
                          <summary className="cursor-pointer font-medium text-primary">
                            {t("Original timing & source", "التوقيت الأصلي والمصدر")}
                          </summary>
                          <p className="mt-2" dir="auto">
                            {claim.publishedText}
                            {claim.timeZone ? ` · ${claim.timeZone}` : ""}
                          </p>
                          {claim.evidenceIds
                            .map((id) => event.sourceEvidence.find((source) => source.id === id))
                            .filter((source) => !!source)
                            .map((source) => (
                              <a
                                key={source.id}
                                href={source.sourceUrl}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex min-h-11 items-center gap-1 underline underline-offset-4"
                              >
                                {source.sourceSection}
                                <ExternalLink className="size-3" aria-hidden />
                              </a>
                            ))}
                        </details>
                      </div>
                    ))}
                  </li>
                ))}
            </ol>
          </section>
        )}
        {!!rubric.length && (
          <section className="self-start py-2" aria-labelledby="published-rubric-title">
            <h2 id="published-rubric-title" className="flex items-center gap-2 text-xl font-bold">
              <Scale className="size-5 text-primary" aria-hidden />
              {t("How projects are judged", "كيف بيقيّموا المشاريع")}
            </h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {t(
                "Organizer-published judging weights, separate from student skills and application selection.",
                "أوزان التحكيم المنشورة من الجهة، منفصلة عن مهارات الطالب واختيار المشاركين.",
              )}
            </p>
            <div className="mt-6 space-y-6">
              {rubric.map(({ rule, label, weight }) => (
                <div key={rule.id}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <h3 className="font-semibold" dir="auto">
                      {label}
                    </h3>
                    <span className="font-semibold tabular-nums text-primary">{weight}%</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary/10" aria-hidden>
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${weight}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground" dir="auto">
                    {rule.statement}
                  </p>
                </div>
              ))}
            </div>
            <a
              href={event.rulesUrl ?? event.officialUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4"
            >
              {t("Read the official criteria", "اقرأ معايير التحكيم الرسمية")}
              <ExternalLink className="size-4" aria-hidden />
            </a>
          </section>
        )}
      </div>
      {event.sourceCoverage.submission.state === "incomplete" && (
        <details className="rounded-2xl border border-border p-4 text-sm">
          <summary className="cursor-pointer font-semibold">
            {t("Still needs confirmation", "معلومات لسه بحاجة تأكيد")}
          </summary>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-xs leading-6 text-muted-foreground">
            {[
              ...event.sourceCoverage.participation.missingChecks,
              ...event.sourceCoverage.submission.missingChecks,
              ...event.sourceCoverage.prize.missingChecks,
            ].map((note) => (
              <li key={note} dir="auto">
                {note}
              </li>
            ))}
          </ul>
        </details>
      )}
      <details className="rounded-2xl border border-border p-4 text-sm">
        <summary className="cursor-pointer font-semibold">
          {t("Sources and review", "المصادر والمراجعة")}
        </summary>
        <dl className="mt-4 grid gap-4 text-xs leading-6 sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">{t("Organizer", "الجهة المنظّمة")}</dt>
            <dd dir="auto">{event.organizer}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("Listing / submission host", "موقع العرض والتسليم")}
            </dt>
            <dd>{event.listingHost ?? t("Not specified", "غير محدد")}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("Last source review", "آخر مراجعة للمصدر")}
            </dt>
            <dd>
              {event.lastReviewedAt
                ? new Date(event.lastReviewedAt).toLocaleDateString(language)
                : t("Not specified", "غير محدد")}
            </dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-4">
          <a
            href={event.officialUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline"
          >
            {t("Official event page", "صفحة الحدث الرسمية")}
            <ExternalLink className="size-3" aria-hidden />
          </a>
          {event.rulesUrl && (
            <a
              href={event.rulesUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex min-h-11 items-center gap-1 font-semibold text-primary underline"
            >
              {t("Official rules and waiver", "الشروط الرسمية والإقرار")}
              <ExternalLink className="size-3" aria-hidden />
            </a>
          )}
        </div>
      </details>
    </div>
  );
}
