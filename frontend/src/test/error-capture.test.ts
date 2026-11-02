import { afterEach, expect, it, vi } from "vitest";
import { describeError } from "@/lib/error-capture";

afterEach(() => {
  vi.unstubAllEnvs();
});

function leakyError(): Error {
  const cause = new Error("database said no at https://db.test/x?token=cause-secret");
  const error = new Error("Request failed for https://app.test/api/plans?candidateId=top-secret", {
    cause,
  });
  error.stack =
    "Error: Request failed\n    at secretFrame (/srv/app/server.ts:10:5)\n    at otherFrame (/srv/app/router.ts:3:1)";
  return error;
}

it("development capture keeps the stack and cause chain for local debugging", () => {
  const text = describeError(leakyError());
  expect(text).toContain("secretFrame");
  expect(text).toContain("caused by:");
});

it("production capture drops stacks and strips URL query parameters", () => {
  vi.stubEnv("NODE_ENV", "production");
  const text = describeError(leakyError());
  expect(text).toContain("Error: Request failed for https://app.test/api/plans");
  expect(text).not.toContain("secretFrame");
  expect(text).not.toContain("candidateId=top-secret");
  expect(text).not.toContain("token=cause-secret");
  expect(text).toContain("caused by: Error: database said no at https://db.test/x");
});
