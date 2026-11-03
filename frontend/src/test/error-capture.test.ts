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

it("production capture excludes messages, stacks and every cause instead of trying to redact their contents", () => {
  vi.stubEnv("NODE_ENV", "production");
  const text = describeError(leakyError());
  expect(text).toBe("Error: Application request failed");
  expect(text).not.toContain("secretFrame");
  expect(text).not.toContain("candidateId=top-secret");
  expect(text).not.toContain("token=cause-secret");
  expect(text).not.toContain("caused by:");
  expect(text).not.toContain("database said no");
});
it("production capture does not serialize profile or authorization data in plain-object causes", () => {
  vi.stubEnv("NODE_ENV", "production");
  const text = describeError(
    new Error("PRIVATE_TOP_LEVEL", {
      cause: { profileText: "PRIVATE_SYNTHETIC_CV", authorization: "SYNTHETIC_AUTHORIZATION" },
    }),
  );
  for (const marker of ["PRIVATE_TOP_LEVEL", "PRIVATE_SYNTHETIC_CV", "SYNTHETIC_AUTHORIZATION"])
    expect(text).not.toContain(marker);
  expect(describeError({ profileText: "PRIVATE_SYNTHETIC_CV" })).toBe(
    "Error: Application request failed",
  );
});
it("production capture keeps only an allowlisted error name and valid HTTP status", () => {
  vi.stubEnv("NODE_ENV", "production");
  const error = Object.assign(new TypeError("PRIVATE_PROFILE"), { status: 503 });
  expect(describeError(error)).toBe("TypeError: Application request failed (status 503)");
  error.name = "PRIVATE_NAME";
  error.status = 123456;
  expect(describeError(error)).toBe("Error: Application request failed");
});
it("the Vite production flag also protects browser-side capture", () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("PROD", true);
  expect(describeError("PRIVATE_PROFILE_STRING")).toBe("Error: Application request failed");
});
