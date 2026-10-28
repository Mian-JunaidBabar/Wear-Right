import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiSend } from "@/lib/api";
import ForgotPasswordView from "./ForgotPasswordView";
import ResetPasswordView from "./ResetPasswordView";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  search: "uid=abc123&token=tok-456",
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiSend: vi.fn() };
});

vi.mock("@/lib/navigation", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams(mocks.search)],
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ logout: mocks.logout }),
}));

vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

beforeEach(() => {
  vi.mocked(apiSend).mockReset();
  mocks.navigate.mockReset();
  mocks.logout.mockReset();
});

describe("ForgotPasswordView", () => {
  it("posts the email and shows the same confirmation for any address", async () => {
    vi.mocked(apiSend).mockResolvedValue({ detail: "If an account exists for this email, we sent a reset link." });
    const user = userEvent.setup();
    render(<ForgotPasswordView />);

    await user.type(screen.getByLabelText(/email address/i), "shopper@example.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(apiSend).toHaveBeenCalledWith("POST", "/api/auth/password/reset/", { email: "shopper@example.com" });
    expect(await screen.findByRole("status")).toHaveTextContent(/if an account exists for this email/i);
    expect(screen.getByText("localhost:8025")).toBeInTheDocument();
  });
});

describe("ResetPasswordView", () => {
  it("reads uid and token from the link and posts the new password", async () => {
    vi.mocked(apiSend).mockResolvedValue({ detail: "Password has been reset. You can log in now." });
    const user = userEvent.setup();
    render(<ResetPasswordView />);

    await user.type(screen.getByLabelText(/^new password$/i), "Brand-New-Pass-9");
    await user.type(screen.getByLabelText(/confirm new password/i), "Brand-New-Pass-9");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(apiSend).toHaveBeenCalledWith("POST", "/api/auth/password/reset/confirm/", {
      uid: "abc123",
      token: "tok-456",
      new_password1: "Brand-New-Pass-9",
      new_password2: "Brand-New-Pass-9",
    });
    await waitFor(() => expect(mocks.logout).toHaveBeenCalled());
    expect(mocks.navigate).toHaveBeenCalledWith("/login");
  });

  it("does not post when the two passwords differ", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordView />);

    await user.type(screen.getByLabelText(/^new password$/i), "Brand-New-Pass-9");
    await user.type(screen.getByLabelText(/confirm new password/i), "Different-Pass-9");
    await user.click(screen.getByRole("button", { name: /set new password/i }));

    expect(apiSend).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/do not match/i);
  });

  it("explains an incomplete link instead of posting", () => {
    mocks.search = "uid=abc123";
    render(<ResetPasswordView />);

    expect(screen.getByRole("alert")).toHaveTextContent(/incomplete/i);
    expect(screen.queryByRole("button", { name: /set new password/i })).not.toBeInTheDocument();
    mocks.search = "uid=abc123&token=tok-456";
  });
});
