export function PlanProgress({
  done,
  total,
  remainingHours,
}: {
  done: number;
  total: number;
  remainingHours: number;
}) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="plan-progress-summary">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <p className="font-semibold">
          Task progress <span className="text-primary">{percent}%</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {done} of {total} tasks completed
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Task progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${done} of ${total} tasks completed`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-3 text-sm">
        <strong>{remainingHours}h</strong>{" "}
        <span className="text-muted-foreground">estimated work remaining</span>
      </p>
    </div>
  );
}
