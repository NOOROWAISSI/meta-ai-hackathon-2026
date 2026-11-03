import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { apiJson } from "./api";

/** A saved intention to prepare, independent of accepted plans and participation reports. */
export interface PreparationSelection {
  opportunityId: string;
  title: string;
  organizer: string;
  selectedAt: string;
  accessState:
    "workspace_available" | "source_review_required" | "unsupported_kind" | "unavailable";
}
export const preparationSelectionsApi = {
  read: () => apiJson<PreparationSelection[]>("/preparation-selections"),
  select: (id: string, accountId: string) =>
    apiJson<PreparationSelection>(`/preparation-selections/${encodeURIComponent(id)}`, "PUT", {
      expectedAccountId: accountId,
    }),
  remove: (id: string, accountId: string) =>
    apiJson<{ confirmed: true }>(`/preparation-selections/${encodeURIComponent(id)}`, "DELETE", {
      expectedAccountId: accountId,
    }),
};
export function usePreparationSelections() {
  const auth = useAuth();
  return useQuery({
    queryKey: ["account", auth?.user?.id, "preparation-selections"],
    queryFn: preparationSelectionsApi.read,
    enabled: !!auth?.user,
    retry: false,
  });
}
