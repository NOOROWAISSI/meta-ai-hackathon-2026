import { ExternalLink, Link2Off } from "lucide-react";
import type { ReviewedResource } from "@/lib/contract/types";
import { currentResource } from "@/lib/preparation/logic";

export function TaskResources({
  ids,
  catalog,
  compact = false,
}: {
  ids: string[];
  catalog: ReviewedResource[];
  compact?: boolean;
}) {
  if (!ids.length)
    return (
      <p className="prep-resource-empty">
        <Link2Off className="size-4" aria-hidden />
        No reviewed learning resources attached.
      </p>
    );
  if (compact)
    return (
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-primary">Learning resources ({ids.length})</summary>
        <div className="mt-3">
          <TaskResources ids={ids} catalog={catalog} />
        </div>
      </details>
    );
  return (
    <div className="space-y-3">
      {ids.map((id) => {
        const resource = catalog.find((r) => r.id === id);
        if (!resource)
          return (
            <p key={id} className="prep-resource-empty">
              This resource is unavailable.
            </p>
          );
        const fictional = /(^|\.)example\.(org|com|net)$/.test(
          (() => {
            try {
              return new URL(resource.url).hostname;
            } catch {
              return "";
            }
          })(),
        );
        return (
          <div key={id} className="prep-resource">
            <p className="text-sm font-semibold">{resource.title}</p>
            {fictional && (
              <p className="mt-1 text-[10px] text-[var(--galaxy-copper-ink)]">
                Fictional placeholder · not genuinely reviewed
              </p>
            )}
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Why this resource?</summary>
              <p className="mt-2 leading-5">{resource.relevanceNote}</p>
            </details>
            {currentResource(resource) ? (
              <>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary"
                >
                  Open learning resource
                  <ExternalLink className="size-3.5" aria-hidden />
                </a>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Reviewed {new Date(resource.checkedAt!).toLocaleDateString()}
                </p>
              </>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">
                {resource.status === "stale"
                  ? "Review is stale. The recommendation link is withheld."
                  : "Current review unavailable. This is not a recommended link."}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
