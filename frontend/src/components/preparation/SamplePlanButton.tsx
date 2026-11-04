import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FlaskConical, LoaderCircle } from "lucide-react";
import { preparationRepository } from "@/lib/preparation/repository";

export function SamplePlanButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="my-4">
      <button
        type="button"
        className="detail-secondary"
        disabled={busy}
        onClick={async () => {
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const plan = await preparationRepository.loadSamplePlan();
            await navigate({ to: "/plans", search: { event: plan.context.opportunityId } });
          } catch (failure) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Sample plan could not be stored. Retry.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <FlaskConical className="size-4" aria-hidden />
        )}
        {busy ? "Loading sample…" : "Load sample plan"}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        Fictional demo tasks and progress. Your profile and existing plans stay intact.
      </p>
      {error && (
        <p role="alert" className="prep-error mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
