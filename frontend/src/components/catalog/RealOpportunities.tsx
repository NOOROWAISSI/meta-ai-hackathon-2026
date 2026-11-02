import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Globe,
  GraduationCap,
  Layers3,
  MapPin,
  Search,
  Trophy,
  BrainCircuit,
  Braces,
} from "lucide-react";
import { AppShell } from "@/components/discover/AppShell";
import { CardSkeleton } from "@/components/discover/HackathonCard";
import { OpportunityGroups } from "@/components/discover/OpportunityGroups";
import { useVisitState } from "@/components/VisitMemory";
import { realCatalogService, type ListingSummary } from "@/lib/catalog/service";
import { useLocale } from "@/components/LocaleProvider";
import { formatContractInstant } from "@/lib/contract/time";
import { SourceFreshness } from "./SourceFreshness";
import { PalestineNetwork } from "./PalestineNetwork";
import { isCatalogTranslationEnabled, translateCatalog } from "@/lib/catalog/translation";
import {
  PreferenceActions,
  useAccountPreferences,
} from "@/components/account/AccountOpportunities";

const kinds = [
  { value: "all", label: "All opportunities", icon: Layers3 },
  { value: "course", label: "Courses", icon: BookOpen },
  { value: "hackathon", label: "Hackathons", icon: Trophy },
  { value: "competition", label: "Competitions", icon: GraduationCap },
  { value: "workshop", label: "Workshops", icon: GraduationCap },
  { value: "training", label: "Training", icon: GraduationCap },
] as const;
export function RealOpportunities() {
  const { language, t } = useLocale();
  const preferences = useAccountPreferences();
  const [query, setQuery] = useVisitState("real.query", "");
  const [kind, setKind] = useVisitState<string>("real.kind", "all");
  const [scope, setScope] = useVisitState("real.scope", "all");
  const [university, setUniversity] = useVisitState("real.university", "all");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const catalog = useQuery({
    queryKey: ["real-listings"],
    queryFn: realCatalogService.listings,
    staleTime: 300000,
    refetchInterval: 300000,
    retry: false,
  });
  const collection = useQuery({
    queryKey: ["source-collection-status"],
    queryFn: realCatalogService.collectionStatus,
    staleTime: 300000,
    refetchInterval: 300000,
    retry: false,
  });
  const sources = useQuery({
    queryKey: ["real-sources"],
    queryFn: realCatalogService.sources,
    enabled: sourcesOpen,
    staleTime: 300000,
    retry: false,
  });
  const translation = useQuery({
    queryKey: ["catalog-translation", language, catalog.data],
    queryFn: ({ signal }) => translateCatalog(language, signal),
    enabled: language === "ar" && !!catalog.data && isCatalogTranslationEnabled(),
    staleTime: 1800000,
    retry: false,
  });
  const translated = new Map<
    string,
    Pick<ListingSummary, "id" | "title" | "summary" | "verificationNote">
  >(language === "ar" ? translation.data?.items.map((item) => [item.id, item]) : []);
  const displayRows = (catalog.data ?? []).map((item) => ({ ...item, ...translated.get(item.id) }));
  const rows = displayRows.filter(
    (item) =>
      !preferences.data?.some((p) => p.opportunityId === item.id && p.notInterested) &&
      (kind === "all" || item.kind === kind) &&
      (scope === "all" || item.scope === scope) &&
      (university === "all" || item.universityId === university) &&
      `${item.title} ${item.organizer} ${item.topics.join(" ")}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const collections = [
    {
      id: "ai-data",
      title: t("AI & Data", "الذكاء الاصطناعي والبيانات"),
      description: t(
        "Explore AI challenges and learning paths.",
        "تحديات الذكاء الاصطناعي ومسارات التعلّم.",
      ),
      topics: ["AI", "Data", "Machine learning"],
      icon: BrainCircuit,
    },
    {
      id: "web-code",
      title: t("Code & Create", "برمج وابنِ"),
      description: t(
        "Programming, web and computer-science foundations.",
        "البرمجة والويب وأساسيات علم الحاسوب.",
      ),
      topics: ["Web", "Programming", "Python", "SQL", "Computer science"],
      icon: Braces,
    },
    {
      id: "more",
      title: t("More to explore", "فرص ثانية تستكشفها"),
      description: t("More challenges from the source catalog.", "تحديات وفرص ثانية من المصادر."),
      topics: [],
      icon: Layers3,
    },
  ];
  const classify = (item: ListingSummary) =>
    collections.find((group) => group.topics.some((topic) => item.topics.includes(topic)))?.id ??
    "more";
  return (
    <AppShell>
      <section className="space-y-6">
        <header className="prep-hero">
          <div>
            <p className="prep-eyebrow">
              <Globe className="size-4" aria-hidden />
              {t("Palestine & online worldwide", "فلسطين وفرص عالمية أونلاين")}
            </p>
            <h1>
              {t("Discover opportunities.", "اكتشف الفرص.")}
              <br />
              {t("Your next possibility.", "خطوتك القادمة.")}
            </h1>
            <p className="prep-organizer">
              {t(
                "Discover courses, hackathons, competitions, and workshops from real organizations.",
                "اكتشف دورات وهاكاثونات ومسابقات وورش عمل من جهات حقيقية.",
              )}
            </p>
          </div>
          <div className="prep-header-metric">
            <span
              className="prep-index-count"
              aria-label={`${catalog.data?.length ?? 0} source-backed listings`}
            >
              {catalog.data?.length ?? "—"}
            </span>
            <span>{t("Opportunities", "فرص متاحة")}</span>
          </div>
        </header>
        {collection.data && (
          <p
            className="flex flex-wrap items-center gap-2 px-1 text-xs leading-6 text-muted-foreground"
            role="status"
          >
            <span
              className={`size-2 rounded-full ${collection.data.enabled ? "bg-primary" : "bg-muted-foreground"}`}
              aria-hidden
            />
            {collection.data.enabled
              ? t(
                  `Official sources checked every ${collection.data.intervalHours} hours while the server is running.`,
                  `فحص المصادر الرسمية كل ${collection.data.intervalHours} ساعة أثناء تشغيل السيرفر.`,
                )
              : t("Scheduled source checks are paused.", "الفحص الدوري للمصادر متوقف.")}
            {collection.data.lastAttemptAt
              ? t(
                  `Last attempt: ${new Date(collection.data.lastAttemptAt).toLocaleString(language)}`,
                  `آخر محاولة: ${new Date(collection.data.lastAttemptAt).toLocaleString(language)}`,
                )
              : t("First check pending.", "بانتظار أول فحص.")}
          </p>
        )}
        {language === "ar" && (
          <div className="prep-demo-notice" role="status">
            {!isCatalogTranslationEnabled()
              ? "ترجمة المحتوى قيد الربط مع خدمة Meta؛ النص الأصلي ظاهر."
              : translation.isFetching
                ? "جارٍ ترجمة محتوى الفرص عبر Meta…"
                : translation.isError
                  ? "ترجمة المحتوى غير متاحة حاليًا؛ النص الأصلي ظاهر. تحقق من إعدادات الخادم أو حاول لاحقًا."
                  : translation.data
                    ? "ترجمة آلية عبر Meta للعرض فقط؛ النصوص الأصلية وشروط الجهة هي المرجع."
                    : "المحتوى الأصلي ظاهر."}
            {isCatalogTranslationEnabled() && translation.isError && (
              <button
                type="button"
                className="detail-secondary ms-3"
                onClick={() => void translation.refetch()}
              >
                إعادة المحاولة
              </button>
            )}
          </div>
        )}
        <p className="prep-demo-notice">
          {t(
            "Real source snapshots · registration, access, and personal participation conditions must be checked separately. Automatically extracted listings may appear before human review and are labelled as needing verification.",
            "معلومات من مصادر حقيقية؛ التسجيل وإمكانية الوصول وشروط المشاركة تُراجع بشكل منفصل. قد تظهر الإعلانات المستخرجة آليًا قبل المراجعة البشرية، وتُوسم بأنها بحاجة للتحقق.",
          )}
        </p>
        <PalestineNetwork selected={university} onSelect={setUniversity} />
        <div className="glass rounded-3xl p-5">
          <div className="grid gap-4 sm:grid-cols-[1fr_230px]">
            <div>
              <label htmlFor="real-search" className="mb-2 block text-sm font-semibold">
                {t("Search real opportunities", "ابحث عن فرصة")}
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3.5 top-3.5 size-4 text-muted-foreground"
                  aria-hidden
                />
                <input
                  id="real-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("Topic, course, or organizer", "موضوع أو دورة أو جهة منظّمة")}
                  className="prep-input w-full"
                  style={{ paddingLeft: "2.5rem" }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="real-scope" className="mb-2 block text-sm font-semibold">
                {t("Where to participate", "مكان المشاركة")}
              </label>
              <select
                id="real-scope"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="prep-input w-full"
              >
                <option value="all">{t("Palestine + online", "فلسطين وأونلاين")}</option>
                <option value="palestine">{t("Palestine", "فلسطين")}</option>
                <option value="global_online">{t("Global online", "عالمية أونلاين")}</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Opportunity type">
            {kinds.map((item) => (
              <button
                key={item.value}
                type="button"
                aria-pressed={kind === item.value}
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${kind === item.value ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card/60 text-muted-foreground"}`}
                onClick={() => setKind(item.value)}
              >
                <item.icon className="size-4" aria-hidden />
                {t(
                  item.label,
                  {
                    all: "كل الفرص",
                    course: "دورات",
                    hackathon: "هاكاثونات",
                    competition: "مسابقات",
                    workshop: "ورش عمل",
                    training: "تدريبات",
                  }[item.value],
                )}
              </button>
            ))}
          </div>
        </div>
        {catalog.isError && (
          <div role="alert" className="prep-error">
            <p>
              {catalog.data
                ? t(
                    "The latest refresh failed. The previous source snapshot stays visible.",
                    "تعذّر التحديث؛ تبقى آخر معلومات متاحة ظاهرة.",
                  )
                : t("Real opportunities are unavailable right now.", "الفرص غير متاحة حاليًا.")}
            </p>
            <button
              type="button"
              className="detail-secondary mt-3"
              onClick={() => void catalog.refetch()}
            >
              {t("Retry opportunities", "إعادة المحاولة")}
            </button>
          </div>
        )}
        {catalog.isPending ? (
          <div
            role="status"
            aria-label="Loading real opportunities"
            className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          >
            {[0, 1, 2].map((id) => (
              <CardSkeleton key={id} />
            ))}
          </div>
        ) : (
          catalog.data && (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                {rows.length} {t("opportunities", "فرصة")} ·{" "}
                {catalog.data.filter((item) => item.kind === "course").length}{" "}
                {t("courses in the source catalog", "دورة في المصادر")}
              </p>
              {!rows.length ? (
                <div className="prep-empty">
                  <MapPin className="size-10 text-primary" aria-hidden />
                  <h2>
                    {scope === "palestine"
                      ? t(
                          "Local announcements are being reviewed.",
                          "الإعلانات المحلية قيد المراجعة.",
                        )
                      : t("No matching opportunities.", "لا توجد فرص مطابقة.")}
                  </h2>
                  <p>
                    {scope === "palestine"
                      ? t(
                          "The local source list includes EWB An-Najah, Prime Academy, Knowledge Academy, and Birzeit. We will not invent a course or registration date from a profile name.",
                          "المصادر المحلية تشمل EWB النجاح وPrime Academy وKnowledge Academy وبيرزيت. نتحقق من الإعلان نفسه قبل عرض الدورة وتواريخها.",
                        )
                      : t(
                          "Try another topic or clear your filters.",
                          "جرّب موضوعًا آخر أو امسح الفلاتر.",
                        )}
                  </p>
                  <button
                    type="button"
                    className="detail-secondary"
                    onClick={() => {
                      setKind("all");
                      setScope("all");
                      setUniversity("all");
                      setQuery("");
                    }}
                  >
                    {t("Clear filters", "مسح الفلاتر")}
                  </button>
                </div>
              ) : (
                <OpportunityGroups
                  items={rows}
                  collections={collections}
                  classify={classify}
                  memoryKey="real.collection"
                  renderCard={(item) => (
                    <article
                      key={item.id}
                      className="glass-strong flex min-w-0 flex-col overflow-hidden rounded-3xl"
                    >
                      <div
                        className={`relative h-16 ${item.kind === "course" ? "event-cover event-cover-two" : "event-cover event-cover-one"}`}
                        aria-hidden
                      >
                        <span className="absolute -bottom-5 start-5 grid size-11 place-items-center rounded-2xl border-2 border-card bg-card text-sm font-bold text-primary shadow-md">
                          {item.organizer
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((word) => word[0])
                            .join("")}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-4 p-5 pt-8">
                        <SourceFreshness item={item} />
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="prep-priority">
                            {t(
                              item.kind,
                              {
                                course: "دورة",
                                hackathon: "هاكاثون",
                                competition: "مسابقة",
                                workshop: "ورشة عمل",
                                training: "تدريب",
                              }[item.kind] ?? item.kind,
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.format === "online"
                              ? t("Online", "أونلاين")
                              : item.format === "in_person"
                                ? t("In person", "وجاهي")
                                : item.format === "hybrid"
                                  ? t("Hybrid", "مدمج")
                                  : t("Format not specified", "طريقة المشاركة غير محددة")}
                          </span>
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold leading-snug">{item.title}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">{item.organizer}</p>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{item.summary}</p>
                        {language === "ar" && translated.has(item.id) && (
                          <details className="text-xs text-muted-foreground">
                            <summary className="cursor-pointer">عرض النص الأصلي</summary>
                            <p className="mt-2" dir="auto">
                              {catalog.data?.find((original) => original.id === item.id)?.title}
                            </p>
                            <p className="mt-2 leading-6" dir="auto">
                              {catalog.data?.find((original) => original.id === item.id)?.summary}
                            </p>
                          </details>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {item.topics.map((topic) => (
                            <span
                              key={topic}
                              className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs"
                            >
                              {topic}
                            </span>
                          ))}
                        </div>
                        <div className="space-y-2 text-xs">
                          <p
                            className={
                              item.registrationState === "closed"
                                ? "font-semibold text-[var(--galaxy-copper-ink)]"
                                : "text-muted-foreground"
                            }
                          >
                            {item.registrationState === "closed"
                              ? t("Applications closed · ", "التقديم مغلق · ")
                              : t("Registration deadline · ", "آخر موعد للتسجيل · ")}
                            {item.registrationDeadline
                              ? formatContractInstant(
                                  item.registrationDeadline,
                                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                                  language,
                                ) + ` (${Intl.DateTimeFormat().resolvedOptions().timeZone})`
                              : t("Not specified", "غير محدد")}
                          </p>
                          <p className="text-muted-foreground">
                            {t("Cost", "التكلفة")} ·{" "}
                            {item.costStatus === "unknown"
                              ? t("Not specified", "غير محددة")
                              : item.costStatus === "free"
                                ? t(
                                    "Free entry, subject to the organizer’s conditions",
                                    "مجانًا وفق شروط الجهة المنظّمة",
                                  )
                                : t("Paid", "مدفوعة")}
                          </p>
                        </div>
                        <details className="rounded-xl border border-border p-3 text-xs">
                          <summary className="cursor-pointer font-semibold">
                            {item.sourceStatus === "reviewed"
                              ? t("Source page checked", "تمت مراجعة صفحة المصدر")
                              : t("Source review incomplete", "مراجعة المصدر غير مكتملة")}
                          </summary>
                          <p className="mt-2 leading-6 text-muted-foreground">
                            {item.verificationNote}
                          </p>
                          {item.sourcePassage && (
                            <blockquote
                              dir="auto"
                              className="mt-2 border-s-2 border-primary ps-3 leading-6"
                            >
                              {item.sourcePassage}
                            </blockquote>
                          )}
                          <p className="mt-2 text-muted-foreground">
                            {t("Snapshot:", "آخر مراجعة:")}{" "}
                            {item.lastReviewedAt
                              ? new Date(item.lastReviewedAt).toLocaleDateString(language)
                              : t("Not specified", "غير محدد")}
                          </p>
                        </details>
                        <Link
                          to="/"
                          search={{ opportunity: item.id }}
                          className="detail-primary mt-auto min-h-11"
                        >
                          {t("Understand this opportunity", "تعرّف على الفرصة")}
                          <ArrowUpRight className="size-4" aria-hidden />
                        </Link>
                        <PreferenceActions item={item} />
                      </div>
                    </article>
                  )}
                />
              )}
            </>
          )
        )}
        <details
          className="glass rounded-3xl p-5"
          onToggle={(event) => setSourcesOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer rounded-xl font-semibold">
            {t(
              "Our sources · Universities, companies & student societies",
              "مصادرنا · جامعات وشركات وجمعيات طلابية",
            )}
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">
            {t(
              "Discovery can begin with a social post or a search result. Specific announcements still need an attributable source and a dated review.",
              "قد يبدأ اكتشاف الفرصة بمنشور أو نتيجة بحث. كل إعلان يحتاج مصدرًا واضحًا ومراجعة بتاريخ محدد.",
            )}
          </p>
          {sources.isPending && sourcesOpen && (
            <p role="status" className="mt-4 text-sm">
              {t("Loading sources…", "جارٍ تحميل المصادر…")}
            </p>
          )}
          {sources.isError && (
            <button
              type="button"
              className="detail-secondary mt-4"
              onClick={() => void sources.refetch()}
            >
              {t("Retry sources", "إعادة تحميل المصادر")}
            </button>
          )}
          <div className="mt-4 divide-y divide-border">
            {sources.data?.map((source) => (
              <div key={source.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="font-semibold">{source.name}</h3>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex min-h-11 items-center gap-1 rounded-xl text-sm font-semibold text-primary"
                  >
                    {t("Visit source", "زيارة المصدر")}
                    <ArrowUpRight className="size-4" aria-hidden />
                  </a>
                </div>
                <p className="mt-1 text-xs leading-6 text-muted-foreground">{source.note}</p>
                {collection.data?.sources
                  ?.filter((check) => check.sourceId === source.id)
                  .map((check) => (
                    <p
                      key={check.sourceId}
                      className="mt-2 text-xs leading-6 text-muted-foreground"
                    >
                      {check.outcome === "checked"
                        ? t("Page retrieved", "تم جلب الصفحة")
                        : check.outcome === "manual_review_required"
                          ? t(
                              "Requires a public source or platform integration",
                              "بحاجة لمصدر عام أو ربط مع المنصة",
                            )
                          : t(
                              "Source could not be checked; previous information retained",
                              "تعذّر فحص المصدر؛ احتفظنا بالمعلومات السابقة",
                            )}
                      {" · "}
                      <time dateTime={check.lastAttemptAt}>
                        {new Date(check.lastAttemptAt).toLocaleString(language)}
                      </time>
                    </p>
                  ))}
                {source.verificationUrl && (
                  <a
                    href={source.verificationUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-1 inline-flex min-h-11 items-center text-xs text-primary underline"
                  >
                    {t("Institution reference", "مرجع المؤسسة")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </details>
        {!!preferences.data?.some((p) => p.notInterested) && (
          <details className="glass rounded-3xl p-5">
            <summary className="cursor-pointer font-semibold">
              {t("Not interested · hidden opportunities", "مش مهتم · الفرص المخفية")}
            </summary>
            <div className="mt-4 divide-y divide-border">
              {catalog.data
                ?.filter((item) =>
                  preferences.data?.some((p) => p.opportunityId === item.id && p.notInterested),
                )
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-4 py-4"
                  >
                    <Link
                      to="/"
                      search={{ opportunity: item.id }}
                      className="text-sm font-semibold text-primary"
                    >
                      {item.title}
                    </Link>
                    <PreferenceActions item={item} restore />
                  </div>
                ))}
            </div>
          </details>
        )}
      </section>
    </AppShell>
  );
}
