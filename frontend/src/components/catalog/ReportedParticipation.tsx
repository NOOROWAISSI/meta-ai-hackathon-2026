import { TicketCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadAccountProfile } from "@/lib/catalog/briefing";
import { useLocale } from "@/components/LocaleProvider";
import type { StudentProfile } from "@/lib/contract/types";
import { isContractInstant } from "@/lib/contract/time";

export function AccountReportedParticipation({ opportunityId }: { opportunityId: string }) {
  const auth = useAuth();
  const profile = useQuery({
    queryKey: ["account-profile-facts", auth?.user?.id],
    queryFn: ({ signal }) => loadAccountProfile(signal),
    enabled: !!auth?.ready && !!auth.user,
    retry: false,
  });
  return (
    <ReportedParticipation
      opportunityId={opportunityId}
      answers={profile.data?.clarificationAnswers}
    />
  );
}

/** An answer confirmed by the student, not organizer verification or an eligibility decision. */
export function ReportedParticipation({
  opportunityId,
  answers,
}: {
  opportunityId: string;
  answers?: StudentProfile["clarificationAnswers"] | undefined;
}) {
  const { t } = useLocale();
  const report = answers
    ?.slice()
    .reverse()
    .find((answer) => answer.questionId === `participation-selection:${opportunityId}`);
  if (!report || report.answer !== "accepted" || !isContractInstant(report.answeredAt)) return null;
  return (
    <div
      className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3"
      aria-label={t("Your participation", "مشاركتك")}
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-primary">
        <TicketCheck className="size-4" aria-hidden />
        {t("Accepted participant", "مشاركة مقبولة")}
      </span>
      <span className="text-xs leading-6 text-muted-foreground">
        {t("Reported by you · not independently verified", "حسب إفادتك · بدون تحقق مستقل من الجهة")}
      </span>
    </div>
  );
}
