import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { LoginScreen } from "@/components/auth/LoginScreen";
import { authService, safeReturn, type AccountUser } from "@/lib/auth/service";

const navigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/discover/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/auth/AuthFrame", () => ({
  AuthFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigate.mockReset();
});
const user: AccountUser = {
  id: "test-account",
  email: "student@example.invalid",
  displayName: "Synthetic student",
  hasPassword: true,
  hasGoogle: false,
};

it("a late guest lookup cannot undo a confirmed account sign-in", async () => {
  let resolve!: (value: AccountUser | null) => void;
  vi.spyOn(authService, "me").mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  act(() => result.current!.confirm(user));
  await act(async () => {
    resolve(null);
    await Promise.resolve();
  });
  expect(result.current!.user).toEqual(user);
});
it("sign-out failure retains the last confirmed account", async () => {
  vi.spyOn(authService, "me").mockResolvedValue(user);
  vi.spyOn(authService, "logout").mockRejectedValue(new Error("Storage unavailable"));
  const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
  await waitFor(() => expect(result.current!.ready).toBe(true));
  await act(async () => {
    await expect(result.current!.logout()).rejects.toThrow();
  });
  expect(result.current!.user).toEqual(user);
});
it("keeps sign-in entries on failure and navigates only after confirmed success", async () => {
  vi.spyOn(authService, "me").mockResolvedValue(null);
  vi.spyOn(authService, "config").mockResolvedValue({
    googleEnabled: false,
    passwordEnabled: true,
  });
  const login = vi
    .spyOn(authService, "login")
    .mockRejectedValue(new Error("Email or password is incorrect."));
  render(
    <AuthProvider>
      <LoginScreen returnTo="/saved" />
    </AuthProvider>,
  );
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "Synthetic-password-42!" },
  });
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Sign in with email" })).toBeEnabled(),
  );
  expect(screen.getByRole("button", { name: "Continue with Google" })).toBeDisabled();
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);
  await screen.findByRole("alert");
  expect(screen.getByLabelText("Email address")).toHaveValue(user.email);
  expect(screen.getByLabelText("Password")).toHaveValue("Synthetic-password-42!");
  expect(navigate).not.toHaveBeenCalled();
  login.mockResolvedValue(user);
  fireEvent.submit(screen.getByLabelText("Password").closest("form")!);
  await waitFor(() => expect(navigate).toHaveBeenCalledWith({ href: "/saved" }));
});
it("accepts only internal, approved return destinations", () => {
  expect(safeReturn("https://attacker.invalid")).toBe("/");
  expect(safeReturn("//attacker.invalid")).toBe("/");
  expect(safeReturn("/\\attacker.invalid")).toBe("/");
  expect(safeReturn("/plans?event=aurora-ai")).toBe("/plans?event=aurora-ai");
});
