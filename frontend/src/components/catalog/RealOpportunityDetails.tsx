import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  Compass,
  LoaderCircle,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/discover/AppShell";
import { useLocale } from "@/components/LocaleProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { realCatalogService } from "@/lib/catalog/service";
import { PreferenceActions } from "@/components/account/AccountOpportunities";
import { SourceFreshness } from "./SourceFreshness";
import { MetaSnapshot } from "./MetaSnapshot";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVisitState } from "@/components/VisitMemory";
import { AccountFitConstellation } from "./AccountFitConstellation";
import { AccountPreparation } from "@/components/account/AccountPlans";
import { PreparationEntry } from "@/components/preparation/PreparationEntry";
import { ReportedParticipation } from "./ReportedParticipation";
import { PublishedEventOverview } from "./PublishedEventOverview";
import { accountApi, AccountApiError } from "@/lib/account/api";
import {
  briefingContext,
  loadAccountProfile,
  matchedInterests,
  metaBriefingService,
  validateBriefing,
  type MetaBriefingService,
} from "@/lib/catalog/briefing";

export function RealOpportunityDetails({
  opportunityId,
  analysisService = metaBriefingService,
}: {
  opportunityId: string;
  analysisService?: MetaBriefingService;
}) {
  const { language, t } = useLocale();
  const [tab, setTab] = useVisitState(`real.details.tab.${opportunityId}`, "overview");
  const auth = useAuth();
  const [requestedContext, setRequestedContext] = useState<string | null>(null);
  const catalog = useQuery({
    queryKey: ["real-listings"],
    queryFn: realCatalogService.listings,
    staleTime: 300000,
    retry: false,
  });
  const item = catalog.data?.find((row) => row.id === opportunityId);
  const planningRecord = useQuery({
    queryKey: ["canonical-opportunity", opportunityId],
    queryFn: () => accountApi.opportunity(opportunityId),
    enabled: item?.kind === "hackathon",
    retry: false,
  });
  const profile = useQuery({
    queryKey: ["account-profile-facts", auth?.user?.id],
    queryFn: ({ signal }) => loadAccountProfile(signal),
    enabled: !!auth?.user,
    retry: false,
  });
  const savedProfile = auth?.user ? profile.data : undefined;
  const publishedSubmission = planningRecord.data?.timelineEvents.find(
    (milestone) => milestone.kind === "submission_close" && milestone.claims.length,
  );
  const context =
    item && savedProfile
      ? briefingContext(item, savedProfile, language, planningRecord.data?.sourceRevision ?? null)
      : null;
  const contextKey = context ? JSON.stringify(context) : null;
  const analysis = useQuery({
    queryKey: ["real-opportunity-briefing", auth?.user?.id, contextKey],
    queryFn: async ({ signal }) =>
      validateBriefing(
        await analysisService.explain({ context: context!, listing: item! }, signal),
        context!,
      ),
    enabled: analysisService.available && !!context && requestedContext === contextKey,
    retry: false,
    staleTime: Infinity,
  });
  const interests = item && savedProfile ? matchedInterests(item, savedProfile) : [];
  const reportedSkills =
    savedProfile?.skills.filter((skill) => skill.state === "reported_has") ?? [];
  const back = (
    <Link to="/" search={{}} className="prep-back">
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {t("Back to opportunities", "العودة للفرص")}
    </Link>
  );
  if (!item)
    return (
      <AppShell>
        <div className="space-y-6">
          {back}
          <section className="glass rounded-3xl p-7" role={catalog.isPending ? "status" : "alert"}>
            <h1 className="text-2xl font-bold">
              {catalog.isPending
                ? t("Loading opportunity…", "جارٍ تحميل الفرصة…")
                : catalog.isError
                  ? t("We could not load this opportunity.", "تعذّر تحميل الفرصة.")
                  : t("This opportunity is unavailable.", "هذه الفرصة غير متاحة.")}
            </h1>
            {catalog.isError && (
              <button
                type="button"
                className="detail-secondary mt-4"
                onClick={() => void catalog.refetch()}
              >
                {t("Retry", "إعادة المحاولة")}
              </button>
            )}
          </section>
        </div>
      </AppShell>
    );
  const format =
    item.format === "online"
      ? t("Online", "أونلاين")
      : item.format === "in_person"
        ? t("In person", "وجاهي")
        : item.format === "hybrid"
          ? t("Hybrid", "مدمج")
          : t("Not specified", "غير محدد");
  return (
    <AppShell>
      <article className="details-screen mx-auto max-w-6xl space-y-7 pb-8">
        {back}
        <header className="discovery-hero relative overflow-hidden rounded-[2rem] border border-primary/15 p-6 sm:p-9">
          <span aria-hidden className="ambient-bubble hero-orb" />
          <div className="relative z-10">
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-[var(--galaxy-teal-ink)] to-[var(--galaxy-copper-ink)]"
            />
            <p className="prep-eyebrow">
              <Compass className="size-4" aria-hidden />
              {t("Understand it before you decide", "افهم الفرصة قبل ما تختار")}
            </p>
            <h1
              className="mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
              dir="auto"
            >
              {item.title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground" dir="auto">
              {item.organizer}
            </p>
            <ReportedParticipation
              opportunityId={item.id}
              answers={savedProfile?.clarificationAnswers}
            />
            <div className="mt-6 flex flex-wrap gap-2">
              {item.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-semibold"
                >
                  {topic}
                </span>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <PreferenceActions item={item} />
              {item.kind === "hackathon" && (
                <Link to="/plans" search={{ event: item.id }} className="detail-primary">
                  {t("Prepare for this opportunity", "حضّر لهذه الفرصة")}
                </Link>
              )}
              <Link to="/profile" search={{ event: item.id }} className="detail-secondary">
                {t("Edit my profile", "تعديل ملفي")}
              </Link>
            </div>
            <dl
              className={`mt-7 grid gap-5 border-t border-border pt-5 ${publishedSubmission ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}
            >
              <div className="fit-insight !border-0 !py-0">
                <span className="fit-insight-number !top-0" aria-hidden>
                  01
                </span>
                <dt className="text-xs text-muted-foreground">
                  {t("Participation", "طريقة المشاركة")}
                </dt>
                <dd className="mt-1 text-sm font-semibold">{format}</dd>
              </div>
              <div className="fit-insight !border-0 !py-0">
                <span className="fit-insight-number !top-0" aria-hidden>
                  02
                </span>
                <dt className="text-xs text-muted-foreground">
                  {t("Registration deadline", "آخر موعد للتسجيل")}
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {planningRecord.data?.timelineEvents.some(
                    (milestone) =>
                      milestone.kind === "registration_close" &&
                      milestone.sourceStatus === "conflicting",
                  ) ? (
                    <a
                      href="#published-event-timeline"
                      className="text-amber-700 underline underline-offset-4 dark:text-amber-300"
                    >
                      {t("Source conflict — see timeline", "تعارض بين المصادر — راجع المواعيد")}
                    </a>
                  ) : item.registrationDeadline ? (
                    `${new Date(item.registrationDeadline).toLocaleString(language)} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
                  ) : (
                    t("Not specified", "غير محدد")
                  )}
                </dd>
              </div>
              <div className="fit-insight !border-0 !py-0">
                <span className="fit-insight-number !top-0" aria-hidden>
                  03
                </span>
                <dt className="text-xs text-muted-foreground">
                  {t("Entry cost", "تكلفة المشاركة")}
                </dt>
                <dd className="mt-1 text-sm font-semibold">
                  {item.costStatus === "free"
                    ? t("Free, subject to organizer conditions", "مجانًا وفق شروط الجهة")
                    : item.costStatus === "paid"
                      ? t("Paid; check the published price", "مدفوعة؛ راجع السعر المنشور")
                      : t("Not specified", "غير محددة")}
                </dd>
              </div>
              {publishedSubmission && (
                <div className="fit-insight !border-0 !py-0">
                  <span className="fit-insight-number !top-0" aria-hidden>
                    04
                  </span>
                  <dt className="text-xs text-muted-foreground">
                    {t("Project submission · published timing", "تسليم المشروع · التوقيت المنشور")}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold" dir="auto">
                    {publishedSubmission.sourceStatus === "conflicting"
                      ? t("Conflicting source times", "تعارض بين المصادر")
                      : publishedSubmission.claims[0]?.publishedText}
                  </dd>
                  {!publishedSubmission.claims[0]?.dateTime && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("Exact instant not confirmed", "اللحظة الزمنية الدقيقة غير مؤكدة")}
                    </p>
                  )}
                </div>
              )}
            </dl>
          </div>
        </header>
        {item.registrationState === "closed" && (
          <p
            role="status"
            className="rounded-2xl border border-[var(--galaxy-copper-ink)]/25 bg-[var(--galaxy-copper-ink)]/5 p-4 text-sm text-[var(--galaxy-copper-ink)]"
          >
            {t(
              "Applications are recorded as closed. Interest in this opportunity does not mean you can register now.",
              "التقديم مسجّل كمغلق. مناسبة الموضوع لاهتماماتك لا تعني أن التسجيل متاح الآن.",
            )}
          </p>
        )}
        <Tabs value={tab} onValueChange={setTab} className="scroll-mt-24">
          <TabsList className="glass mb-5 grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1.5">
            <TabsTrigger value="overview" className="detail-tab">
              {t("Overview", "نظرة عامة")}
            </TabsTrigger>
            <TabsTrigger value="fit" className="detail-tab whitespace-normal">
              {t("Requirements & My Fit", "المتطلبات ومدى مناسبتي")}
            </TabsTrigger>
            <TabsTrigger value="preparation" className="detail-tab">
              {t("Preparation", "التحضير")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-6">
            {planningRecord.isError &&
              !(
                planningRecord.error instanceof AccountApiError &&
                planningRecord.error.status === 404
              ) && (
                <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {t(
                    "Detailed planning information could not be loaded.",
                    "تعذّر تحميل معلومات التخطيط التفصيلية.",
                  )}
                  <button
                    type="button"
                    className="min-h-11 font-semibold text-primary underline"
                    onClick={() => void planningRecord.refetch()}
                  >
                    {t("Retry details", "إعادة تحميل التفاصيل")}
                  </button>
                </p>
              )}
            <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <section className="space-y-5 px-1">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <BookOpen className="size-5" aria-hidden />
                  </span>
                  <h2 className="text-xl font-bold">{t("The short version", "الفرصة بالمختصر")}</h2>
                </div>
                <p className="text-base leading-8 text-foreground" dir="auto">
                  {item.summary}
                </p>
                {item.sourcePassage && (
                  <details className="border-s-2 border-primary/30 ps-4 text-sm">
                    <summary className="cursor-pointer rounded-md font-semibold">
                      {t("Read the original source passage", "اقرأ نص المصدر الأصلي")}
                    </summary>
                    <blockquote dir="auto" className="mt-3 leading-7 text-muted-foreground">
                      {item.sourcePassage}
                    </blockquote>
                  </details>
                )}
                <div className="border-t border-border pt-5">
                  <h3 className="font-semibold">
                    {t("What to check before committing", "شو تتأكد منه قبل ما تقرّر")}
                  </h3>
                  <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                    {item.verificationNote
                      .split(/(?<=[.!?؟])\s+|[;؛]\s*/u)
                      .filter(Boolean)
                      .map((point, index) => (
                        <li key={`source-${index}`} className="flex items-start gap-3">
                          <span
                            className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary"
                            aria-hidden
                          />
                          <span dir="auto">{point}</span>
                        </li>
                      ))}
                    {t(
                      "Unpublished details remain unknown. Confirm current benefits and participation conditions in the original source.",
                      "التفاصيل غير المنشورة بتظل غير معروفة. راجع المزايا وشروط المشاركة الحالية من المصدر الأصلي.",
                    )
                      .split(/(?<=[.!?؟])\s+|[;؛]\s*/u)
                      .filter(Boolean)
                      .map((point, index) => (
                        <li
                          key={`unknown-${index}`}
                          className="flex items-start gap-3 text-xs leading-6"
                        >
                          <span
                            className="mt-2.5 size-1.5 shrink-0 rounded-full bg-border"
                            aria-hidden
                          />
                          <span>{point}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </section>
              <section
                className="glass self-start rounded-3xl p-5 sm:p-6"
                aria-labelledby="personal-briefing-title"
              >
                <p className="prep-eyebrow">
                  <UserRound className="size-4" aria-hidden />
                  {t("Your perspective", "بالنسبة إلك")}
                </p>
                <h2 id="personal-briefing-title" className="mt-3 text-xl font-bold">
                  {t("How does this connect to you?", "شو علاقتها باهتماماتك؟")}
                </h2>
                {!(auth?.ready ?? true) || (auth?.user && profile.isPending) ? (
                  <p role="status" className="mt-4 text-sm text-muted-foreground">
                    {t("Loading your saved account profile…", "جارٍ تحميل ملف حسابك المحفوظ…")}
                  </p>
                ) : !auth?.user ? (
                  <div className="mt-4 space-y-4">
                    <p className="text-sm leading-7 text-muted-foreground">
                      {t(
                        "Read all public details freely. Sign in to use your saved account interests and experience for a personal explanation.",
                        "كل التفاصيل العامة متاحة. سجّل الدخول لاستخدام اهتمامات وخبرة حسابك المحفوظة بالتفسير الشخصي.",
                      )}
                    </p>
                    <Link
                      to="/login"
                      search={{ returnTo: `/?opportunity=${item.id}` }}
                      className="detail-secondary min-h-11"
                    >
                      {t("Sign in for a personal view", "ادخل لعرض شخصي")}
                    </Link>
                  </div>
                ) : profile.isError ? (
                  <div role="alert" className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "Your account profile could not be loaded. Public details are still available.",
                        "تعذّر تحميل ملف حسابك؛ التفاصيل العامة ما زالت متاحة.",
                      )}
                    </p>
                    <button
                      type="button"
                      className="detail-secondary mt-3"
                      onClick={() => void profile.refetch()}
                    >
                      {t("Retry profile", "إعادة تحميل الملف")}
                    </button>
                  </div>
                ) : (
                  savedProfile && (
                    <div className="mt-5 space-y-5">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        {t(
                          "Profile-based preview · not AI analysis",
                          "معاينة من ملف حسابك · ليست تحليل AI",
                        )}
                      </p>
                      <div>
                        <h3 className="text-sm font-semibold">
                          {t("Recorded topic overlap", "اهتمامات مشتركة مسجّلة")}
                        </h3>
                        {interests.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {interests.map((interest) => (
                              <span
                                key={interest}
                                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
                              >
                                <Check className="size-3" aria-hidden />
                                {interest}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {t(
                              "No exact topic overlap is recorded. This does not mean a participation condition is failed.",
                              "ما في تطابق موضوع مباشر مسجّل؛ هذا مش فشل بشرط مشاركة.",
                            )}
                          </p>
                        )}
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold">
                          {t("Experience you reported", "خبرة ذكرتها بملفك")}
                        </h3>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground" dir="auto">
                          {reportedSkills.length
                            ? reportedSkills.map((skill) => skill.label).join(" · ")
                            : t("Not provided", "غير مذكورة")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 border-t border-border pt-4 text-sm">
                        <Clock3 className="size-4 shrink-0 text-primary" aria-hidden />
                        <span>
                          {savedProfile.availableHoursPerWeek.state === "known"
                            ? t(
                                `${savedProfile.availableHoursPerWeek.value} preparation hours per week`,
                                `${savedProfile.availableHoursPerWeek.value} ساعات تحضير أسبوعيًا`,
                              )
                            : t("Preparation time is unknown", "وقت التحضير غير معروف")}
                        </span>
                      </div>
                      <p className="text-xs leading-6 text-muted-foreground">
                        {t(
                          "This uses your saved account facts. Participation conditions are checked separately.",
                          "المعاينة من حقائق ملف حسابك المحفوظة. شروط المشاركة إلها فحص منفصل.",
                        )}
                      </p>
                    </div>
                  )
                )}
              </section>
            </div>
            {planningRecord.data && <PublishedEventOverview event={planningRecord.data} />}
          </TabsContent>
          <TabsContent value="fit" className="space-y-6">
            <AccountFitConstellation
              opportunityId={opportunityId}
              kind={item.kind}
              {...(savedProfile ? { profile: savedProfile } : {})}
            />
            <section
              className="border-y border-primary/15 py-6"
              aria-labelledby="meta-briefing-title"
              dir={language === "ar" ? "rtl" : "ltr"}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="meta-briefing-title" className="flex items-center gap-2 text-lg font-bold">
                  <Sparkles className="size-5 text-primary" aria-hidden />
                  {t("Meta snapshot", "ملخّص Meta")}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {analysisService.available
                    ? t("AI explanation · check against sources", "تفسير AI · راجعه مع المصادر")
                    : t("Awaiting backend integration", "بانتظار ربط خدمة التحليل")}
                </span>
              </div>
              {!analysisService.available ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                  {t(
                    "Personal snapshots are not connected yet. Public event details remain available above.",
                    "الملخّص الشخصي لسه مش موصول. تفاصيل الفرصة العامة متاحة فوق.",
                  )}
                </p>
              ) : (
                <>
                  <button
                    type="button"
                    className="detail-secondary mt-4"
                    disabled={!context || analysis.isFetching}
                    onClick={() => {
                      setRequestedContext(contextKey);
                      if (requestedContext === contextKey) void analysis.refetch();
                    }}
                  >
                    {analysis.isFetching && (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    )}
                    {analysis.isFetching
                      ? t("Preparing explanation…", "جارٍ تجهيز التفسير…")
                      : t("Explain this opportunity for me", "اشرحلي الفرصة بالنسبة إلي")}
                  </button>
                  {analysis.isError && (
                    <p role="alert" className="prep-error mt-4">
                      {analysis.error.message}{" "}
                      {t(
                        "The explanation failed. Your profile and original opportunity details are unchanged. Retry when ready.",
                        "تعذّر التفسير. ملفك والتفاصيل الأصلية ما تغيّروا؛ جرّب مجددًا.",
                      )}
                    </p>
                  )}
                  {requestedContext && requestedContext !== contextKey && (
                    <p role="status" className="mt-3 text-sm text-muted-foreground">
                      {t(
                        "The context changed. Request a new explanation.",
                        "المعلومات تغيّرت؛ اطلب تفسيرًا محدّثًا.",
                      )}
                    </p>
                  )}
                  <MetaSnapshot
                    briefing={analysis.data}
                    interests={interests}
                    loading={analysis.isFetching}
                  />
                </>
              )}
            </section>
          </TabsContent>
          <TabsContent value="preparation" className="space-y-6">
            <PreparationEntry
              embedded
              opportunityId={item.id}
              renderWorkspace={(id) => <AccountPreparation opportunityId={id} embedded />}
            />
          </TabsContent>
        </Tabs>
        <section className="flex flex-wrap items-center justify-between gap-5 rounded-3xl border border-border bg-card/40 p-5 sm:p-6">
          <div className="max-w-2xl">
            <SourceFreshness item={item} />
            {item.sourcePageUrl && item.sourcePageUrl !== item.officialUrl && (
              <a
                href={item.sourcePageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 inline-flex min-h-11 items-center text-xs text-primary underline underline-offset-4"
              >
                {t("Page containing the published information", "الصفحة التي نُشرت فيها المعلومات")}
              </a>
            )}
            <h2 className="font-semibold">
              {t("Want the organizer’s full details?", "بدك التفاصيل الكاملة من الجهة؟")}
            </h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              {t(
                "You have the overview here. Use the original page to confirm current requirements, availability and registration.",
                "أخذت الملخص هون. راجع الصفحة الأصلية لتأكيد المتطلبات الحالية والتوفر والتسجيل.",
              )}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("Source snapshot:", "تاريخ لقطة المصدر:")}{" "}
              {item.lastReviewedAt
                ? new Date(item.lastReviewedAt).toLocaleDateString(language)
                : t("Not specified", "غير محدد")}
            </p>
          </div>
          <a
            href={item.officialUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="detail-primary min-h-11"
          >
            {t("Open original source", "فتح المصدر الأصلي")}
            <ArrowUpRight className="size-4" aria-hidden />
          </a>
        </section>
      </article>
    </AppShell>
  );
}
