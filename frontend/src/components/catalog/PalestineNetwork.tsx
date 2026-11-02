import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, ExternalLink } from "lucide-react";
import { realCatalogService } from "@/lib/catalog/service";
import { useLocale } from "@/components/LocaleProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiJson } from "@/lib/account/api";

type CampusFollow = {
  universityId: string;
  followedAt: string;
  seenAt: string;
  newOpportunityIds: string[];
};

export function PalestineNetwork({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { language, t } = useLocale();
  const auth = useAuth();
  const client = useQueryClient();
  const accountId = auth?.user?.id;
  const followsKey = ["account", accountId, "campus-follows"];
  const follows = useQuery({
    queryKey: followsKey,
    queryFn: () => apiJson<CampusFollow[]>("/campus-follows"),
    enabled: !!accountId,
    retry: false,
    refetchInterval: 300000,
  });
  const change = useMutation({
    mutationFn: ({ id, following }: { id: string; following: boolean }) =>
      apiJson(`/campus-follows/${encodeURIComponent(id)}`, "PUT", {
        following,
        expectedAccountId: accountId,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: followsKey });
    },
  });
  const seen = useMutation({
    mutationFn: (id: string) =>
      apiJson(`/campus-follows/${encodeURIComponent(id)}/seen`, "PUT", {
        expectedAccountId: accountId,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: followsKey });
    },
  });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const network = useQuery({
    queryKey: ["palestine-network"],
    queryFn: realCatalogService.network,
    staleTime: 300000,
    retry: false,
  });
  const status = useQuery({
    queryKey: ["source-collection-status"],
    queryFn: realCatalogService.collectionStatus,
    enabled: open,
    staleTime: 300000,
    retry: false,
  });
  const institutions = network.data?.institutions ?? [];
  const organizations = network.data?.organizations ?? [];
  const selectedUniversity = institutions.find((u) => u.id === selected);
  return (
    <section
      className="glass rounded-3xl p-5"
      aria-label={t("Palestinian university network", "شبكة الجامعات الفلسطينية")}
    >
      <button
        type="button"
        className="flex min-h-12 w-full items-center gap-3 text-start"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Building2 className="size-6 text-primary" aria-hidden />
        <span className="flex-1">
          <strong className="block">
            {t("Your campus, connected.", "جامعتك وجمعياتها، بمكان واحد.")}
          </strong>
          <span className="text-sm text-muted-foreground">
            {institutions.length} {t("universities", "جامعة")} · {organizations.length}{" "}
            {t("groups & chapters", "جمعيات وفروع مرصودة")}
          </span>
        </span>
        <span className="text-sm text-primary">
          {open ? t("Close", "إغلاق") : t("Explore network", "استكشف الشبكة")}
        </span>
      </button>
      {selected !== "all" && (
        <button type="button" className="detail-secondary mt-3" onClick={() => onSelect("all")}>
          {selectedUniversity && (
            <span>
              {language === "ar" ? selectedUniversity.arabicName : selectedUniversity.name} ·{" "}
            </span>
          )}
          {t("Show all universities", "اعرض كل الجامعات")}
        </button>
      )}
      {open && (
        <div className="mt-5 space-y-4">
          {(change.isError || seen.isError || follows.isError) && (
            <p role="alert" className="prep-error">
              {t(
                "Could not update followed universities. Your last saved choices are preserved. Retry the action.",
                "تعذّر تحديث متابعة الجامعات. اختياراتك المحفوظة ما تغيّرت؛ أعد المحاولة.",
              )}
            </p>
          )}
          {follows.isError && (
            <button
              type="button"
              className="detail-secondary"
              onClick={() => void follows.refetch()}
            >
              {t("Retry followed universities", "أعد تحميل الجامعات المتابَعة")}
            </button>
          )}
          {status.isError && (
            <button
              type="button"
              className="detail-secondary"
              onClick={() => void status.refetch()}
            >
              {t("Retry collection status", "أعد تحميل حالة الجمع")}
            </button>
          )}
          {accountId && (
            <p role="status" className="text-sm text-primary">
              {follows.data?.reduce((total, row) => total + row.newOpportunityIds.length, 0) ?? 0}{" "}
              {t(
                "new source listings from followed universities since last seen",
                "إعلانات جديدة من الجامعات المتابَعة منذ آخر مشاهدة",
              )}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t(
              "Institution identities follow the Ministry directory. Branch references and actual collection results are separate. An unlisted branch is unverified, not assumed absent.",
              "الجامعات من دليل الوزارة. توثيق الجمعية منفصل عن نجاح جمع إعلاناتها. الجمعية غير المدرجة لسه غير موثّقة عندنا؛ مش معناها إنها مش موجودة.",
            )}
          </p>
          {status.data?.metaExtraction && (
            <p className="text-xs text-muted-foreground">
              {t("Meta source extraction", "استخراج الإعلانات عبر Meta")}:{" "}
              {status.data.metaExtraction.extractedCount}{" "}
              {t("source passages extracted", "إعلانات مستخرجة من نص المصدر")} ·{" "}
              {status.data.metaExtraction.requestsToday}/
              {status.data.metaExtraction.dailyRequestLimit} {t("requests today", "طلبات اليوم")}
              {status.data.metaExtraction.failedCount > 0 &&
                ` · ${status.data.metaExtraction.failedCount} ${t("failed extractions; retry after cooldown", "محاولات متعذّرة؛ تُعاد بعد فترة الانتظار")}`}
            </p>
          )}
          <label className="block text-sm font-semibold" htmlFor="campus-search">
            {t("Find a university or group", "دور على جامعة أو جمعية")}
          </label>
          <input
            id="campus-search"
            className="prep-input w-full"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {network.isPending && <p role="status">{t("Loading network…", "جار تحميل الشبكة…")}</p>}
          {network.isError && (
            <button
              type="button"
              className="detail-secondary"
              onClick={() => void network.refetch()}
            >
              {t("Retry network", "أعد تحميل الشبكة")}
            </button>
          )}
          <div className="grid gap-x-6 md:grid-cols-2">
            {institutions
              .filter((u) =>
                `${u.name} ${u.arabicName} ${organizations
                  .filter((o) => o.universityId === u.id)
                  .map((o) => `${o.name} ${o.arabicName}`)
                  .join(" ")}`
                  .toLowerCase()
                  .includes(search.trim().toLowerCase()),
              )
              .map((u) => {
                const groups = organizations.filter((o) => o.universityId === u.id);
                const check = status.data?.sources?.find(
                  (s) => s.sourceId === `university-${u.id}`,
                );
                const follow = follows.data?.find((f) => f.universityId === u.id);
                return (
                  <div key={u.id} className="border-b border-border/60 py-4">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        className={`min-h-11 flex-1 rounded-xl px-2 text-start font-semibold ${selected === u.id ? "bg-primary/15 text-primary ring-1 ring-primary" : "hover:bg-primary/10"}`}
                        aria-pressed={selected === u.id}
                        onClick={() => onSelect(u.id)}
                      >
                        {language === "ar" ? u.arabicName : u.name}
                      </button>
                      <a
                        className="detail-secondary p-3"
                        href={u.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`${u.name} — official website`}
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    </div>
                    <p className="my-2 px-2 text-xs text-muted-foreground">
                      {!check
                        ? t("Not checked yet", "لم يُفحص المصدر بعد")
                        : check.outcome === "checked"
                          ? t(
                              "Source reachable · announcements checked separately",
                              "المصدر متاح · الإعلانات تُفحص منفصلة",
                            )
                          : check.outcome === "manual_review_required"
                            ? t("Social source · manual review", "مصدر اجتماعي · مراجعة يدوية")
                            : check.outcome === "http_403" || check.outcome === "robots_disallowed"
                              ? t("Automatic access is restricted", "الوصول التلقائي مقيّد")
                              : check.outcome === "http_301" || check.outcome === "http_302"
                                ? t(
                                    "Official address needs an update",
                                    "العنوان الرسمي يحتاج تحديث",
                                  )
                                : t(
                                    "Automatic check unavailable · source link remains available",
                                    "تعذّر الفحص التلقائي · رابط المصدر موجود",
                                  )}
                    </p>
                    {accountId && (
                      <div className="mb-3 flex flex-wrap gap-2 px-2">
                        <button
                          type="button"
                          className="detail-secondary min-h-11"
                          aria-pressed={!!follow}
                          disabled={change.isPending || follows.isPending || follows.isError}
                          onClick={() => change.mutate({ id: u.id, following: !follow })}
                        >
                          {follow
                            ? t("Following", "متابَعَة")
                            : t("Follow university", "تابع الجامعة")}
                        </button>
                        {!!follow?.newOpportunityIds.length && (
                          <>
                            <button
                              type="button"
                              className="detail-secondary min-h-11"
                              onClick={() => onSelect(u.id)}
                            >
                              {follow.newOpportunityIds.length} {t("new listings", "إعلانات جديدة")}
                            </button>
                            <button
                              type="button"
                              className="detail-secondary min-h-11"
                              disabled={seen.isPending}
                              onClick={() => seen.mutate(u.id)}
                            >
                              {t("Mark seen", "تمت المشاهدة")}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <ul className="space-y-2 px-2">
                      {groups.map((o) => (
                        <li key={o.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="rounded-lg bg-primary/10 px-2 py-1 text-primary">
                            {o.family}
                          </span>
                          <a
                            className="underline underline-offset-4"
                            href={o.referenceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {language === "ar" ? o.arabicName : o.name}
                          </a>
                          {o.referenceKind &&
                            !["institutional_reference", "program_reference"].includes(
                              o.referenceKind,
                            ) && (
                              <span className="text-xs text-muted-foreground">
                                {o.referenceKind === "organization_self_report"
                                  ? t("Organization's own page", "صفحة الجهة نفسها")
                                  : t(
                                      "Partner / public republication reference",
                                      "مرجع شريك أو إعادة نشر عامة",
                                    )}
                              </span>
                            )}
                          {o.socialLinks?.map((link) => (
                            <a
                              key={link.url}
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex min-h-11 items-center rounded-lg border border-primary/20 px-2 text-xs text-primary"
                            >
                              {link.channel}
                            </a>
                          ))}
                          {o.channel === "instagram" && (
                            <span className="text-xs text-muted-foreground">
                              {t("Social source · manual review", "مصدر اجتماعي · مراجعة يدوية")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    {!groups.length && (
                      <p className="px-2 text-xs text-muted-foreground">
                        {t(
                          "Student branches still need a primary reference.",
                          "فروع الجمعيات لسه بتحتاج مرجع رسمي للتوثيق.",
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
          {network.data && (
            <a
              className="inline-flex min-h-11 items-center text-sm text-primary underline"
              href={network.data.referenceUrl}
              target="_blank"
              rel="noreferrer"
            >
              {t("Ministry institution directory", "دليل مؤسسات التعليم العالي — الوزارة")}
            </a>
          )}
        </div>
      )}
    </section>
  );
}
