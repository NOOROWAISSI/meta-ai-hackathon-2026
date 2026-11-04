import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { ForgotPasswordScreen } from "@/components/auth/ForgotPasswordScreen";
import { authService } from "@/lib/auth/service";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/components/auth/AuthFrame", () => ({
  AuthFrame: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const form = () =>
  screen
    .getByRole("button", { name: /Send verification code|Verify code|Save new password/ })
    .closest("form")!;
it("keeps email on send failure and completes only after a confirmed reset", async () => {
  const send = vi
    .spyOn(authService, "requestPasswordCode")
    .mockRejectedValue(new Error("Mail unavailable"));
  const verify = vi.spyOn(authService, "verifyPasswordCode").mockResolvedValue("test-grant");
  const reset = vi
    .spyOn(authService, "resetPassword")
    .mockRejectedValue(new Error("Storage unavailable"));
  render(<ForgotPasswordScreen returnTo="/saved" />);
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "student@example.invalid" },
  });
  fireEvent.submit(form());
  await screen.findByText("Mail unavailable");
  expect(screen.getByLabelText("Email address")).toHaveValue("student@example.invalid");
  expect(screen.queryByLabelText("Verification code")).toBeNull();
  send.mockResolvedValue({
    challengeId: "test-challenge",
    expiresInSeconds: 600,
    resendAfterSeconds: 60,
  });
  fireEvent.submit(form());
  await screen.findByLabelText("Verification code");
  fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "123456" } });
  fireEvent.submit(form());
  await screen.findByLabelText("New password");
  expect(verify).toHaveBeenCalledWith("test-challenge", "123456");
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "New-test-password-42!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "Different-password-42!" },
  });
  fireEvent.submit(form());
  await screen.findByText("Passwords do not match.");
  expect(reset).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Confirm new password"), {
    target: { value: "New-test-password-42!" },
  });
  fireEvent.submit(form());
  await screen.findByText("Storage unavailable");
  expect(screen.getByLabelText("New password")).toHaveValue("New-test-password-42!");
  expect(screen.queryByText("You’re all set.")).toBeNull();
  reset.mockResolvedValue();
  fireEvent.submit(form());
  await waitFor(() => expect(screen.getByText("You’re all set.")).toBeVisible());
  expect(reset).toHaveBeenLastCalledWith("test-challenge", "test-grant", "New-test-password-42!");
});
