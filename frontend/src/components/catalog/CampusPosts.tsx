import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Radio, CalendarDays } from "lucide-react";
import { realCatalogService } from "@/lib/catalog/service";
import { useLocale } from "@/components/LocaleProvider";
import { isContractInstant } from "@/lib/contract/time";
import { useVisitState } from "@/components/VisitMemory";

export function CampusPosts({ university }: { university: string }) {
  const { language, t } = useLocale();
  const [channel, setChannel] = useVisitState<string>("campus.posts.channel", "all");
  const [view, setView] = useVisitState<string>("campus.posts.view", "all");
  const [visible, setVisible] = useVisitState<number>("campus.posts.visible", 6);
  const posts = useQuery({
    queryKey: ["campus-posts"],
    queryFn: realCatalogService.campusPosts,
    staleTime: 300000,
    refetchInterval: 300000,
    retry: false,
  });
  const network = useQuery({
    queryKey: ["palestine-network"],
    queryFn: realCatalogService.network,
    staleTime: 300000,
    retry: false,
  });
  const groups = network.data?.organizations ?? [];
  const eventLabel = (value: string) =>
    isContractInstant(value)
      ? `${new Intl.DateTimeFormat(language === "ar" ? "ar" : "en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value))} UTC`
      : value;
  const selectedPosts = (posts.data ?? [])
    .filter(
      (p) =>
        (university === "all" || p.universityIds.includes(university)) &&
        (channel === "all" || p.channel === channel) &&
        (view === "all" ||
          (view === "archive"
            ? p.availability === "ended" || p.postType === "recap"
            : p.availability !== "ended" && p.postType !== "recap")),
    )
    .sort(
      (a, b) =>
        Number(a.availability === "ended" || a.postType === "recap") -
        Number(b.availability === "ended" || b.postType === "recap"),
    );
  return (
    <section className="glass rounded-3xl p-5 sm:p-7" aria-labelledby="campus-posts-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="prep-eyebrow">
            <Radio className="size-4" aria-hidden />
            {t("From your communities", "من جمعياتك ومجتمعاتك")}
          </p>
          <h2 id="campus-posts-title" className="mt-2 text-2xl font-bold">
            {t("What are they organizing?", "شو عم بنظّموا؟")}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {t(
              "Read the announcement here. Past activities stay in the archive; a post alone does not confirm registration is open.",
              "اقرأ الإعلان هون. الفعاليات الماضية إلها أرشيف؛ وجود منشور ما يعني إن التسجيل لسه مفتوح.",
            )}
          </p>
        </div>
        <span role="status" className="text-3xl font-bold text-primary">
          {selectedPosts.length}
        </span>
      </div>
      <div className="my-5 flex flex-wrap gap-3">
        <div>
          <label htmlFor="campus-channel" className="mb-1 block text-xs font-semibold">
            {t("Published on", "نُشر على")}
          </label>
          <select
            id="campus-channel"
            className="prep-input min-h-11"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setVisible(6);
            }}
          >
            <option value="all">{t("All sources", "كل المصادر")}</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="linkedin">LinkedIn</option>
            <option value="official_website">{t("Organization websites", "مواقع الجهات")}</option>
          </select>
        </div>
        <div>
          <label htmlFor="campus-post-view" className="mb-1 block text-xs font-semibold">
            {t("Activity", "النشاط")}
          </label>
          <select
            id="campus-post-view"
            className="prep-input min-h-11"
            value={view}
            onChange={(e) => {
              setView(e.target.value);
              setVisible(6);
            }}
          >
            <option value="all">{t("All posts", "كل المنشورات")}</option>
            <option value="announcements">{t("Announcements to check", "إعلانات للمراجعة")}</option>
            <option value="archive">
              {t("Past activities & reports", "فعاليات ماضية وتقارير")}
            </option>
          </select>
        </div>
      </div>
      {posts.isPending && (
        <p role="status">{t("Loading organization posts…", "جار تحميل منشورات الجمعيات…")}</p>
      )}
      {posts.isError && (
        <div role="alert">
          <p>
            {t(
              "Posts could not refresh. The previous snapshot is preserved.",
              "تعذّر تحديث المنشورات. آخر نسخة بتضل ظاهرة.",
            )}
          </p>
          <button
            type="button"
            className="detail-secondary mt-2"
            onClick={() => void posts.refetch()}
          >
            {t("Retry posts", "أعد تحميل المنشورات")}
          </button>
        </div>
      )}
      {!posts.isPending && !posts.isError && !selectedPosts.length && (
        <p className="rounded-2xl bg-primary/5 p-5 text-sm text-muted-foreground">
          {t(
            "No collected posts match this selection yet.",
            "لسه ما في منشورات مجمّعة مطابقة لهالاختيار.",
          )}
        </p>
      )}
      <div className="divide-y divide-border/60">
        {selectedPosts.slice(0, visible).map((post) => (
          <article key={post.id} className="py-5 first:pt-0">
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                {post.channel === "official_website"
                  ? t("Official / organization site", "موقع الجهة")
                  : post.channel}
              </span>
              <span className="text-muted-foreground">
                {post.availability === "ended"
                  ? t("Past activity", "فعالية ماضية")
                  : post.postType === "recap"
                    ? t("Activity report", "تقرير نشاط")
                    : t("Registration needs checking", "التسجيل يحتاج تحقق")}
              </span>
              {post.verificationLevel === "secondary_excerpt" && (
                <span className="text-amber-700 dark:text-amber-300">
                  {t("Public republication · original not read", "إعادة نشر عامة · الأصل لم يُقرأ")}
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold" dir="auto">
              {post.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {groups
                .filter((g) => post.organizationIds.includes(g.id))
                .map((g) => (language === "ar" ? g.arabicName : g.name))
                .join(" · ")}
            </p>
            <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-7" dir="auto">
              {post.summary}
            </p>
            {post.eventDateText && (
              <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <CalendarDays className="size-4 shrink-0" aria-hidden />
                <span dir="auto">{eventLabel(post.eventDateText)}</span>
              </p>
            )}
            <details className="mt-3 text-sm">
              <summary className="min-h-11 cursor-pointer py-3 text-primary">
                {t("Read the source excerpt", "اقرأ المقتطف من المصدر")}
              </summary>
              <blockquote className="border-s-2 border-primary/30 ps-4 leading-7" dir="auto">
                {post.sourcePassage}
              </blockquote>
              <p className="mt-2 text-xs text-muted-foreground">
                {post.publishedDateText
                  ? `${t("Publication", "النشر")}: ${post.publishedDateText}`
                  : t("Publication date not provided.", "تاريخ النشر غير متوفر.")}
              </p>
              {post.contentUrl !== post.originalUrl && (
                <a
                  href={post.contentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex min-h-11 items-center text-primary underline"
                >
                  {t("Where this text was read", "المصدر اللي قرأنا منه النص")}
                </a>
              )}
            </details>
            {post.verificationLevel === "primary_source" &&
              post.availability !== "ended" &&
              post.postType !== "recap" &&
              ["hackathon", "training", "course", "competition", "workshop"].includes(
                post.kind,
              ) && (
                <Link
                  to="/"
                  search={{ opportunity: post.id }}
                  className="detail-cta me-2 mt-1 inline-flex min-h-11 items-center gap-2"
                >
                  {t("Understand this opportunity", "افهم هاي الفرصة")}
                </Link>
              )}
            <a
              href={post.originalUrl}
              target="_blank"
              rel="noreferrer"
              className="detail-secondary mt-1 inline-flex min-h-11 items-center gap-2"
            >
              {t("Visit original source", "افتح المصدر الأصلي")}
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          </article>
        ))}
      </div>
      {selectedPosts.length > visible && (
        <button
          type="button"
          className="detail-secondary mt-4 min-h-11"
          onClick={() => setVisible(visible + 6)}
        >
          {t("More posts", "منشورات أكثر")}
        </button>
      )}
    </section>
  );
}
