import { z } from "zod";

const userSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  hasPassword: z.boolean(),
  hasGoogle: z.boolean(),
});
export type AccountUser = z.infer<typeof userSchema>;
export const safeReturn = (value?: string) =>
  value &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.includes("\\") &&
  !Array.from(value).some((character) => character.charCodeAt(0) < 32) &&
  ["/", "/saved", "/plans", "/profile", "/opportunities"].includes(value.split("?")[0]!)
    ? value
    : "/";
async function request(path: string, body?: unknown) {
  const response = await fetch(`/api/auth/${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: {
      "X-NextStep-Request": "1",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 204) return null;
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = z.object({ message: z.string() }).safeParse(data);
    throw new Error(
      error.success ? error.data.message : "Account service is unavailable. Please retry.",
    );
  }
  return data;
}
/** Replaceable HTTP boundary. No password/token is written to browser storage. */
export const authService = {
  async requestPasswordCode(email: string, language: "ar" | "en") {
    return z
      .object({
        challengeId: z.string(),
        expiresInSeconds: z.number(),
        resendAfterSeconds: z.number(),
      })
      .parse(await request("request-password-reset", { email, language }));
  },
  async verifyPasswordCode(challengeId: string, code: string) {
    return z
      .object({ resetToken: z.string() })
      .parse(await request("verify-password-reset", { challengeId, code })).resetToken;
  },
  async resetPassword(challengeId: string, resetToken: string, password: string) {
    await request("reset-password", { challengeId, resetToken, password });
  },
  async me() {
    return z.object({ user: userSchema.nullable() }).parse(await request("me")).user;
  },
  async config() {
    return z
      .object({ googleEnabled: z.boolean(), passwordEnabled: z.boolean() })
      .parse(await request("config"));
  },
  async login(email: string, password: string) {
    return userSchema.parse(await request("login", { email, password }));
  },
  async register(email: string, password: string, displayName: string) {
    return userSchema.parse(await request("register", { email, password, displayName }));
  },
  async logout() {
    await request("logout", {});
  },
};
