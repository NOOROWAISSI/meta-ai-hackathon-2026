import { Link } from "@tanstack/react-router";
import { ArrowRight, TicketCheck } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { ReportedParticipation } from "@/components/catalog/ReportedParticipation";
import type { ListingSummary } from "@/lib/catalog/service";
import type { Plan, StudentProfile } from "@/lib/contract/types";
import { isContractInstant } from "@/lib/contract/time";

export function JoinedHackathons({
  answers,
  listings,
  plans,
}: {
  answers: StudentProfile["clarificationAnswers"];
  listings: ListingSummary[];
  plans: Pick<Plan, "context">[];
}) {
  const { t } = useLocale();
  const latest = new Map(answers.map((answer) => [answer.questionId, answer]));
  const joined = listings.filter((item) => {
    const answer = latest.get(`participation-selection:${item.id}`);
    return (
      item.kind === "hackathon" &&
      answer?.answer === "accepted" &&
      isContractInstant(answer.answeredAt) &&
      !plans.some((plan) => plan.context.opportunityId === item.id)
    );
  });
  if (!joined.length) return null;
  return (
    <section
      className="glass overflow-hidden rounded-3xl border border-primary/15 p-5 sm:p-7"
      aria-labelledby="joined-hackathons-title"
    >
      <div className="flex items-start gap-3">
        <TicketCheck className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 id="joined-hackathons-title" className="text-xl font-bold">
            {t("Your hackathons", "هاكاثوناتي")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {t(
              "Your reported participation, ready for a preparation next step.",
              "الفرص اللي أفدت بمشاركتك فيها، وخطوة التحضير الجاية إلها.",
            )}
          </p>
        </div>
      </div>
      <div className="mt-5 divide-y divide-border">
        {joined.map((item) => (
          <article key={item.id} className="py-5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-semibold" dir="auto">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground" dir="auto">
                  {item.organizer}
                </p>
                <ReportedParticipation opportunityId={item.id} answers={answers} />
                <p className="mt-3 text-sm text-muted-foreground">
                  {t("Preparation plan not created yet.", "لسه ما أنشأت خطة تحضير.")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-col">
                <Link to="/plans" search={{ event: item.id }} className="detail-primary">
                  {t("Open preparation", "فتح التحضير")}
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
                </Link>
                <Link to="/" search={{ opportunity: item.id }} className="detail-secondary">
                  {t("View details", "عرض التفاصيل")}
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
