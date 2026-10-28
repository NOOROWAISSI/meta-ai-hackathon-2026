import { createFileRoute } from "@tanstack/react-router";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { safeReturn } from "@/lib/auth/service";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: safeReturn(typeof search["returnTo"] === "string" ? search["returnTo"] : undefined),
    ...(typeof search["error"] === "string" ? { error: search["error"] } : {}),
    ...(search["google"] === "complete" ? { google: "complete" as const } : {}),
  }),
  head: () => ({ meta: [{ title: "Sign in · NextStep" }] }),
  component: LoginRoute,
});
function LoginRoute() {
  const search = Route.useSearch();
  return (
    <LoginScreen
      returnTo={search.returnTo}
      {...(search.error ? { externalError: search.error } : {})}
      googleComplete={search.google === "complete"}
    />
  );
}
