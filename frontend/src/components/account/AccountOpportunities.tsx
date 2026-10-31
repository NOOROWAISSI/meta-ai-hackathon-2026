import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bookmark, EyeOff, RotateCcw, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import { AppShell } from "@/components/discover/AppShell";
import { accountApi } from "@/lib/account/api";
import { realCatalogService, type ListingSummary } from "@/lib/catalog/service";

export function useAccountPreferences() {
  const auth = useAuth();
  return useQuery({
    queryKey: ["account", auth?.user?.id, "preferences"],
    queryFn: accountApi.preferences,
    enabled: !!auth?.user,
    retry: false,
  });
}
export function PreferenceActions({
  item,
  restore = false,
}: {
  item: ListingSummary;
  restore?: boolean;
}) {
  const auth = useAuth();
  const { t } = useLocale();
  const query = useQueryClient();
  const preferences = useAccountPreferences();
  const current = preferences.data?.find((p) => p.opportunityId === item.id);
  const ownerId = auth?.user?.id;
  const mutation = useMutation({
    mutationFn: (change: { saved?: boolean; notInterested?: boolean }) =>
      accountApi.preference(item.id, change, ownerId!),
    onSuccess: () => {
      void query.invalidateQueries({ queryKey: ["account", ownerId, "preferences"] });
    },
  });
  if (!ownerId)
    return (
      <Link
        to="/login"
        search={{ returnTo: `/?opportunity=${item.id}` }}
        className="detail-secondary min-h-11 !px-3"
        aria-label={t(`Sign in to save ${item.title}`, `ادخل لحفظ ${item.title}`)}
      >
        <Bookmark className="size-4" aria-hidden />
      </Link>
    );
  const perform = async (change: { saved?: boolean; notInterested?: boolean }, label: string) => {
    const previous =
      change.saved !== undefined
        ? { saved: current?.saved ?? false }
        : { notInterested: current?.notInterested ?? false };
    try {
      await mutation.mutateAsync(change);
      toast.success(label, {
        action: {
          label: t("Undo", "تراجع"),
          onClick: () => {
            void accountApi
              .preference(item.id, previous, ownerId)
              .then(() =>
                query.invalidateQueries({ queryKey: ["account", ownerId, "preferences"] }),
              )
              .catch((error) =>
                toast.error(error instanceof Error ? error.message : "Undo failed."),
              );
          },
        },
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("The change was not saved.", "التغيير ما انحفظ."),
      );
    }
  };
  const disabled = mutation.isPending || preferences.isPending || preferences.isError;
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled}
        aria-busy={mutation.isPending}
        aria-pressed={current?.saved ?? false}
        aria-label={
          current?.saved
            ? t(`Unsave ${item.title}`, `إلغاء حفظ ${item.title}`)
            : t(`Save ${item.title}`, `حفظ ${item.title}`)
        }
        className="detail-secondary min-h-11 !px-3"
        onClick={() =>
          void perform(
            { saved: !current?.saved },
            current?.saved
              ? t("Removed from Saved", "انشالت من المحفوظات")
              : t("Saved to your account", "انحفظت بحسابك"),
          )
        }
      >
        <Bookmark className={`size-4 ${current?.saved ? "fill-current" : ""}`} aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        className="detail-secondary min-h-11 !px-3"
        onClick={() =>
          void perform(
            { notInterested: !restore },
            restore
              ? t("Restored to Discover", "رجعت للاستكشاف")
              : t("Hidden from Discover", "انخفت من الاستكشاف"),
          )
        }
      >
        {restore ? (
          <RotateCcw className="size-4" aria-hidden />
        ) : (
          <EyeOff className="size-4" aria-hidden />
        )}
        <span className="text-xs">
          {restore ? t("Restore", "استرجاع") : t("Not interested", "مش مهتم")}
        </span>
      </button>
      {preferences.isError && (
        <button
          type="button"
          className="text-xs text-primary underline"
          onClick={() => void preferences.refetch()}
        >
          {t("Retry saved state", "إعادة تحميل المحفوظات")}
        </button>
      )}
    </div>
  );
}
export function AccountSaved() {
  const auth = useAuth();
  const { t } = useLocale();
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState("all");
  const [sort, setSort] = useState("recent");
  const preferences = useAccountPreferences();
  const plans = useQuery({
    queryKey: ["account", auth?.user?.id, "plans"],
    queryFn: accountApi.plans,
    retry: false,
    enabled: !!auth?.user,
  });
  const catalog = useQuery({
    queryKey: ["real-listings"],
    queryFn: realCatalogService.listings,
    staleTime: 300000,
    retry: false,
  });
  const saved = (catalog.data ?? []).filter((item) =>
    preferences.data?.some((p) => p.opportunityId === item.id && p.saved),
  );
  const rows = saved
    .filter(
      (item) =>
        (format === "all" || item.format === format) &&
        `${item.title} ${item.organizer}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "deadline"
        ? (a.registrationDeadline ? Date.parse(a.registrationDeadline) : Infinity) -
          (b.registrationDeadline ? Date.parse(b.registrationDeadline) : Infinity)
        : Date.parse(
            preferences.data?.find((p) => p.opportunityId === b.id)?.savedAt ?? "1970-01-01",
          ) -
          Date.parse(
            preferences.data?.find((p) => p.opportunityId === a.id)?.savedAt ?? "1970-01-01",
          ),
    );
  return (
    <AppShell>
      <div className="space-y-6">
        <header className="prep-hero">
          <div>
            <p className="prep-eyebrow">
              <Bookmark className="size-4" aria-hidden />
              {t("Saved Opportunities", "الفرص المحفوظة")}
            </p>
            <h1>{t("A shortlist worth keeping.", "فرص تستاهل تحتفظ فيها.")}</h1>
            <p className="prep-organizer">
              {t(
                "Keep interesting opportunities together and decide what to pursue next.",
                "اجمع الفرص اللي بتهمك وحدّد خطوتك الجاية.",
              )}
            </p>
          </div>
          <span className="prep-index-count">{saved.length}</span>
        </header>
        {preferences.isPending || catalog.isPending ? (
          <p role="status" className="prep-loading">
            {t("Loading your saved opportunities…", "جارٍ تحميل محفوظاتك…")}
          </p>
        ) : preferences.isError || catalog.isError ? (
          <div role="alert" className="prep-error">
            {t(
              "Saved opportunities could not be refreshed. Your account data was not changed.",
              "تعذّر تحميل المحفوظات؛ بياناتك ما تغيّرت.",
            )}
            <button
              type="button"
              className="detail-secondary mt-3"
              onClick={() => {
                void preferences.refetch();
                void catalog.refetch();
              }}
            >
              {t("Retry", "إعادة المحاولة")}
            </button>
          </div>
        ) : !saved.length ? (
          <div className="prep-empty">
            <Bookmark className="size-10 text-primary" aria-hidden />
            <h2>{t("No saved opportunities yet.", "ما عندك فرص محفوظة بعد.")}</h2>
            <p>
              {t(
                "Save an opportunity while exploring to find it here.",
                "احفظ فرصة أثناء الاستكشاف لتلاقيها هون.",
              )}
            </p>
            <Link to="/" search={{}} className="detail-primary">
              {t("Explore opportunities", "استكشف الفرص")}
            </Link>
          </div>
        ) : (
          <>
            <div className="glass grid gap-4 rounded-3xl p-5 sm:grid-cols-3">
              <label className="text-sm font-semibold">
                {t("Search saved opportunities", "ابحث بالمحفوظات")}
                <input
                  className="prep-input mt-2 w-full"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label className="text-sm font-semibold">
                {t("Format", "طريقة المشاركة")}
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                  className="prep-input mt-2 w-full"
                >
                  <option value="all">{t("All", "الكل")}</option>
                  <option value="online">{t("Online", "أونلاين")}</option>
                  <option value="in_person">{t("In person", "وجاهي")}</option>
                  <option value="hybrid">{t("Hybrid", "مدمج")}</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                {t("Sort", "الترتيب")}
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                  className="prep-input mt-2 w-full"
                >
                  <option value="recent">{t("Recently saved", "الأحدث حفظًا")}</option>
                  <option value="deadline">
                    {t("Nearest registration deadline", "أقرب موعد تسجيل")}
                  </option>
                </select>
              </label>
            </div>
            {!rows.length ? (
              <div className="prep-empty">
                <Search className="size-8 text-primary" aria-hidden />
                <h2>{t("No matching opportunities", "ما في نتائج مطابقة")}</h2>
                <button
                  type="button"
                  className="detail-secondary"
                  onClick={() => {
                    setSearch("");
                    setFormat("all");
                  }}
                >
                  {t("Clear filters", "مسح الفلاتر")}
                </button>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                {rows.map((item) => (
                  <article key={item.id} className="glass rounded-3xl p-6">
                    <p className="prep-eyebrow">{item.kind}</p>
                    <h2 className="mt-3 text-xl font-bold">{item.title}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{item.organizer}</p>
                    <p className="my-4 text-sm leading-7">{item.summary}</p>
                    <p className="mb-4 text-xs text-muted-foreground">
                      {t("Registration deadline:", "آخر موعد تسجيل:")}{" "}
                      {item.registrationDeadline
                        ? new Date(item.registrationDeadline).toLocaleString()
                        : t("Not specified", "غير محدد")}
                    </p>
                    <PreferenceActions item={item} />
                    <Link to="/" search={{ opportunity: item.id }} className="detail-primary mt-4">
                      {t("View details", "عرض التفاصيل")}
                    </Link>
                    {item.kind === "hackathon" && (
                      <Link
                        to="/plans"
                        search={{ event: item.id }}
                        className="detail-secondary ms-2 mt-4"
                      >
                        {plans.data?.some((plan) => plan.context.opportunityId === item.id)
                          ? t("Continue preparation", "كمّل التحضير")
                          : t("Explore preparation", "استكشف التحضير")}
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
