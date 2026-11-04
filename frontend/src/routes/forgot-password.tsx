import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordScreen } from "@/components/auth/ForgotPasswordScreen";
import { safeReturn } from "@/lib/auth/service";

export const Route = createFileRoute("/forgot-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturn(typeof search["returnTo"] === "string" ? search["returnTo"] : undefined),
  }),
  head: () => ({ meta: [{ title: "Reset password · NextStep" }] }),
  component: RecoveryRoute,
});
function RecoveryRoute() {
  const { returnTo } = Route.useSearch();
  return <ForgotPasswordScreen returnTo={returnTo} />;
}
