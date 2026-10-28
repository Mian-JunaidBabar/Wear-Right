import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminAuthApi } from "@/features/admin/api";
import AdminForgotPasswordView from "./AdminForgotPasswordView";
import AdminResetPasswordView from "./AdminResetPasswordView";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  logout: vi.fn(),
  search: "uid=admin123&token=admin-token",
}));

vi.mock("@/features/admin/api", () => ({
  adminAuthApi: {
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
  },
}));

vi.mock("@/features/admin/AdminAuthProvider", () => ({
  useAdminAuth: () => ({ logout: mocks.logout }),
}));

vi.mock("@/lib/navigation", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams(mocks.search)],
}));

vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

beforeEach(() => {
  vi.mocked(adminAuthApi.requestPasswordReset).mockReset();
  vi.mocked(adminAuthApi.confirmPasswordReset).mockReset();
  mocks.navigate.mockReset();
  mocks.logout.mockReset();
});

describe("AdminForgotPasswordView", () => {
  it("posts the work email and shows the neutral confirmation", async () => {
    vi.mocked(adminAuthApi.requestPasswordReset).mockResolvedValue({
      detail: "If an account exists for this email, we sent a reset link.",
    });
    const user = userEvent.setup();
    render(<AdminForgotPasswordView />);

    await user.type(screen.getByLabelText(/^email$/i), "boss@wearright.com");
    await user.click(screen.getByRole("button", { name: /send reset link/i }));

    expect(adminAuthApi.requestPasswordReset).toHaveBeenCalledWith("boss@wearright.com");
    expect(await screen.findByRole("status")).toHaveTextContent(/if an account exists for this email/i);
    expect(screen.getByText("http://localhost:8025")).toBeInTheDocument();
  });
});

describe("AdminResetPasswordView", () => {
  it("posts uid and token from the link, clears the panel and returns to sign in", async () => {
    vi.mocked(adminAuthApi.confirmPasswordReset).mockResolvedValue({ detail: "Password has been reset." });
    const user = userEvent.setup();
    render(<AdminResetPasswordView />);

    await user.type(screen.getByLabelText(/^new password$/i), "Brand-New-Pass-9");
    await user.type(screen.getByLabelText(/confirm password/i), "Brand-New-Pass-9");
    await user.click(screen.getByRole("button", { name: /save password/i }));

    expect(adminAuthApi.confirmPasswordReset).toHaveBeenCalledWith({
      uid: "admin123",
      token: "admin-token",
      new_password1: "Brand-New-Pass-9",
      new_password2: "Brand-New-Pass-9",
    });
    await waitFor(() => expect(mocks.logout).toHaveBeenCalled());
    expect(mocks.navigate).toHaveBeenCalledWith("/admin/login");
  });

  it("explains an incomplete link instead of posting", () => {
    mocks.search = "uid=admin123";
    render(<AdminResetPasswordView />);

    expect(screen.getByRole("alert")).toHaveTextContent(/incomplete/i);
    expect(screen.queryByRole("button", { name: /save password/i })).not.toBeInTheDocument();
    mocks.search = "uid=admin123&token=admin-token";
  });
});
