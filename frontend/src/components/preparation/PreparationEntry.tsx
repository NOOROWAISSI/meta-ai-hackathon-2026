import { Fragment, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  FileCheck2,
  LoaderCircle,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import { AccountReportedParticipation } from "@/components/catalog/ReportedParticipation";
import {
  CatalogRequestError,
  realCatalogService,
  type PreparationAccess,
} from "@/lib/catalog/service";

export function PreparationEntry({
  opportunityId,
  renderWorkspace,
}: {
  opportunityId: string;
  renderWorkspace: (planningOpportunityId: string) => ReactNode;
}) {
  const auth = useAuth();
  const { t } = useLocale();
  const access = useQuery({
    queryKey: ["preparation-access", opportunityId],
    queryFn: () => realCatalogService.preparationAccess(opportunityId),
    staleTime: 0,
    retry: false,
  });
  const back = (
    <Link to="/" search={{ opportunity: opportunityId }} className="prep-back">
      <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
      {t("Back to opportunity", "العودة للفرصة")}
    </Link>
  );
  if (access.isPending)
    return (
      <div className="space-y-5">
        {back}
        <p role="status" className="prep-loading">
          <LoaderCircle className="size-5 animate-spin" aria-hidden />
          {t("Checking preparation options…", "جارٍ فحص خيارات التحضير…")}
        </p>
      </div>
    );
  if (access.isError)
    return (
      <div className="space-y-5">
        {back}
        <section className="glass rounded-3xl p-7" role="alert">
          <h1 className="text-2xl font-bold">
            {access.error instanceof CatalogRequestError && access.error.status === 404
              ? t("Opportunity unavailable", "الفرصة غير متاحة")
              : t("Preparation could not be checked", "تعذّر فحص التحضير")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t(
              "Your saved plans and progress are unchanged. You can retry or return to the event.",
              "خططك وتقدّمك المحفوظين ما تغيّروا. جرّب مجددًا أو ارجع للفرصة.",
            )}
          </p>
          <button
            type="button"
            className="detail-secondary mt-5"
            onClick={() => void access.refetch()}
          >
            {t("Retry", "إعادة المحاولة")}
          </button>
        </section>
      </div>
    );
  const item = access.data;
  if (item.state === "workspace_available" && auth?.ready && auth.user) {
    return (
      <Fragment key={`${auth.user.id}:${item.planningOpportunityId}`}>
        {renderWorkspace(item.planningOpportunityId)}
      </Fragment>
    );
  }
  const reviewSteps: Record<
    PreparationAccess["reviewNeeds"][number],
    { label: string; detail: string; icon: typeof ShieldCheck }
  > = {
    participation_rules: {
      label: t("Participation conditions", "شروط المشاركة"),
      detail: t(
        "Published student, age, location and team conditions, where applicable.",
        "شروط الجهة المنشورة للدراسة والعمر والمكان والفريق، حسب الفرصة.",
      ),
      icon: ShieldCheck,
    },
    submission_requirements: {
      label: t("What needs to be submitted", "شو المطلوب تسليمه"),
      detail: t(
        "Required deliverables and the original requirement passages.",
        "المخرجات المطلوبة والنصوص الأصلية لشروط التسليم.",
      ),
      icon: FileCheck2,
    },
    source_evidence: {
      label: t("Source and timing review", "مراجعة المصدر والمواعيد"),
      detail: t(
        "Source evidence and published submission timing, with unknown dates kept unknown.",
        "توثيق المصدر وموعد التسليم المنشور؛ الموعد المجهول بظل مجهول.",
      ),
      icon: ScrollText,
    },
  };
  return (
    <div className="preparation-screen space-y-6">
      {back}
      <AccountReportedParticipation opportunityId={opportunityId} />
      <header className="prep-hero">
        <div>
          <p className="prep-eyebrow">
            <Sparkles className="size-4" aria-hidden />
            {t("Preparation", "التحضير")}
          </p>
          <h1 dir="auto">{item.title}</h1>
          <p className="prep-organizer" dir="auto">
            {item.organizer}
          </p>
        </div>
      </header>
      {item.state === "source_review_required" ? (
        <section className="glass relative overflow-hidden rounded-3xl border border-primary/20 p-6 sm:p-8">
          <div
            className="pointer-events-none absolute -end-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
            aria-hidden
          />
          <p className="prep-eyebrow">{t("Source review needed", "بانتظار مراجعة المصدر")}</p>
          <h2 className="mt-3 text-2xl font-bold">
            {t("A clearer starting point for your plan.", "نقطة بداية أوضح لخطتك.")}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            {t(
              "This hackathon is in Discover. Its planning information still needs source review before a personalised draft can be generated.",
              "الهاكاثون موجود في ديسكوفر. معلومات التحضير إله لسه بحاجة مراجعة من المصدر قبل توليد خطة شخصية.",
            )}
          </p>
          <ol className="relative mt-6 divide-y divide-border border-s border-primary/25 ps-5 sm:ps-7">
            {item.reviewNeeds.map((need, index) => {
              const step = reviewSteps[need];
              const Icon = step.icon;
              return (
                <li key={need} className="flex gap-4 py-5">
                  <span
                    className="mt-0.5 text-xs font-semibold tabular-nums text-primary"
                    aria-hidden
                  >
                    0{index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="flex items-center gap-2 font-semibold">
                      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                      {step.label}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            {t(
              "Source review is separate from your profile and participation checks. Your existing plans and progress stay saved.",
              "مراجعة المصدر منفصلة عن ملفك وفحص شروط المشاركة. خططك وتقدّمك السابق بظلوا محفوظين.",
            )}
          </p>
        </section>
      ) : item.state === "unsupported_kind" ? (
        <section className="glass rounded-3xl p-7">
          <h2 className="text-2xl font-bold">
            {t("Explore this learning opportunity.", "استكشف فرصة التعلّم.")}
          </h2>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {t(
              "Preparation plans currently support hackathons. You can read this opportunity, save it and check its original learning details.",
              "خطط التحضير حاليًا للهاكاثونات. بتقدر تقرأ هاي الفرصة وتحفظها وتراجع تفاصيل التعلّم من مصدرها.",
            )}
          </p>
        </section>
      ) : (
        <section className="glass rounded-3xl p-7">
          {!auth?.ready ? (
            <p role="status" className="prep-loading">
              {t("Loading your account…", "جارٍ تحميل حسابك…")}
            </p>
          ) : (
            <>
              <h2 className="text-2xl font-bold">
                {t("Sign in to prepare", "سجّل دخولك للتحضير")}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {t(
                  "Use your saved goals and availability, review a draft, and keep accepted progress in your account.",
                  "استخدم أهدافك ووقتك المحفوظين، راجع المسوّدة، واحفظ تقدّمك بحسابك.",
                )}
              </p>
              <Link
                to="/login"
                search={{ returnTo: `/plans?event=${encodeURIComponent(opportunityId)}` }}
                className="detail-primary mt-5"
              >
                {t("Sign in", "تسجيل الدخول")}
              </Link>
            </>
          )}
        </section>
      )}
      <div className="flex flex-wrap gap-3">
        <Link to="/" search={{ opportunity: opportunityId }} className="detail-primary">
          {t("View event details", "عرض تفاصيل الفرصة")}
        </Link>
        <a
          href={item.officialUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="detail-secondary"
        >
          {t("Open original source", "فتح المصدر الأصلي")}
          <ArrowUpRight className="size-4" aria-hidden />
        </a>
        {item.kind === "hackathon" && (
          <Link
            to="/profile"
            search={{ event: opportunityId, returnTo: "plans" }}
            className="detail-secondary"
          >
            {t("Edit my profile", "تعديل ملفي")}
          </Link>
        )}
      </div>
    </div>
  );
}
