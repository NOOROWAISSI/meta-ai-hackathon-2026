import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, ArrowRight, BookmarkCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLocale } from "@/components/LocaleProvider";
import {
  preparationSelectionsApi,
  usePreparationSelections,
  type PreparationSelection,
} from "@/lib/account/preparation-selections";
export function PreparationSelectionAction({
  opportunityId,
  navigateAfterSave = true,
}: {
  opportunityId: string;
  navigateAfterSave?: boolean;
}) {
  const auth = useAuth();
  const { t } = useLocale();
  if (!auth?.user)
    return (
      <Link
        to={navigateAfterSave ? "/plans" : "/login"}
        search={
          navigateAfterSave
            ? { event: opportunityId }
            : { returnTo: `/plans?event=${encodeURIComponent(opportunityId)}` }
        }
        className="detail-primary"
      >
        {navigateAfterSave
          ? t("Prepare for this opportunity", "حضّر لهذه الفرصة")
          : t("Sign in to add to My Plans", "سجّل دخولك لإضافتها إلى خططي")}
      </Link>
    );
  return (
    <SignedInSelectionAction
      key={`${auth.user.id}:${opportunityId}`}
      accountId={auth.user.id}
      opportunityId={opportunityId}
      navigateAfterSave={navigateAfterSave}
    />
  );
}
function SignedInSelectionAction({
  accountId,
  opportunityId,
  navigateAfterSave,
}: {
  accountId: string;
  opportunityId: string;
  navigateAfterSave: boolean;
}) {
  const { t } = useLocale();
  const navigate = useNavigate();
  const query = useQueryClient();
  const selections = usePreparationSelections();
  const existing = selections.data?.some((s) => s.opportunityId === opportunityId);
  const save = useMutation({
    mutationFn: () => preparationSelectionsApi.select(opportunityId, accountId),
    onSuccess: async (saved) => {
      query.setQueryData<PreparationSelection[]>(
        ["account", accountId, "preparation-selections"],
        (old = []) => [...old.filter((s) => s.opportunityId !== saved.opportunityId), saved],
      );
      void query.invalidateQueries({ queryKey: ["account", accountId, "preparation-selections"] });
      if (navigateAfterSave) await navigate({ to: "/plans", search: { event: opportunityId } });
    },
  });
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="detail-primary"
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? (
          <>
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            {t("Saving…", "جار الحفظ…")}
          </>
        ) : navigateAfterSave ? (
          t("Prepare for this opportunity", "حضّر لهذه الفرصة")
        ) : existing ? (
          <>
            <BookmarkCheck className="size-4" aria-hidden />
            {t("Added to My Plans", "أُضيفت إلى خططي")}
          </>
        ) : (
          t("Add to My Plans", "أضفها إلى خططي")
        )}
      </button>
      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t(
            "Could not save this choice. Retry; your existing plans are unchanged.",
            "تعذّر حفظ الاختيار. أعد المحاولة؛ خططك السابقة ما تغيّرت.",
          )}
        </p>
      )}
      {!navigateAfterSave && existing && (
        <p role="status" className="text-sm text-primary">
          {t(
            "Saved as a preparation starting point, not an accepted plan.",
            "محفوظة كنقطة بداية للتحضير، وليست خطة مقبولة بعد.",
          )}
        </p>
      )}
    </div>
  );
}
export function SelectedPreparations({
  acceptedOpportunityIds,
}: {
  acceptedOpportunityIds: string[];
}) {
  const auth = useAuth();
  const { t } = useLocale();
  const query = useQueryClient();
  const selections = usePreparationSelections();
  const remove = useMutation({
    mutationFn: (id: string) => preparationSelectionsApi.remove(id, auth!.user!.id),
    onSuccess: () => {
      void query.invalidateQueries({
        queryKey: ["account", auth?.user?.id, "preparation-selections"],
      });
    },
  });
  const rows =
    selections.data?.filter((s) => !acceptedOpportunityIds.includes(s.opportunityId)) ?? [];
  if (selections.isError)
    return (
      <div role="alert" className="prep-error">
        <p>{t("Your preparation choices could not load.", "تعذّر تحميل اختيارات التحضير.")}</p>
        <button
          type="button"
          className="detail-secondary mt-2"
          onClick={() => void selections.refetch()}
        >
          {t("Retry", "أعد المحاولة")}
        </button>
      </div>
    );
  if (!rows.length) return null;
  return (
    <section className="space-y-4" aria-labelledby="selected-preparations">
      <h2 id="selected-preparations" className="text-xl font-bold">
        {t("Selected for preparation", "فرص اخترت التحضير إلها")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          "Your saved starting points. Accepted plans and task progress are shown separately.",
          "نقاط بداية محفوظة بحسابك. الخطط المقبولة وتقدّم المهام إلها قسم منفصل.",
        )}
      </p>
      {remove.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t(
            "Removal failed. Your saved choice is preserved; retry.",
            "تعذّر الحذف. اختيارك لسه محفوظ؛ أعد المحاولة.",
          )}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((s) => (
          <article key={s.opportunityId} className="glass rounded-3xl p-6">
            <p className="prep-eyebrow">
              {s.accessState === "source_review_required"
                ? t("Planning details need review", "تفاصيل التحضير بحاجة مراجعة")
                : s.accessState === "unavailable"
                  ? t("Opportunity unavailable", "الفرصة غير متاحة حاليًا")
                  : t("Preparation not generated yet", "لم تُولّد خطة بعد")}
            </p>
            <h3 className="mt-3 text-lg font-bold" dir="auto">
              {s.title}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground" dir="auto">
              {s.organizer}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/plans" search={{ event: s.opportunityId }} className="detail-primary">
                {t("Continue preparation", "تابع التحضير")}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <button
                type="button"
                className="detail-secondary"
                disabled={remove.isPending}
                onClick={() => remove.mutate(s.opportunityId)}
              >
                {t("Remove selection", "احذف الاختيار")}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
