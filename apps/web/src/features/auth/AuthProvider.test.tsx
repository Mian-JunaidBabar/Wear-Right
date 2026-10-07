import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet, apiSend } from "@/lib/api";
import { AuthProvider, SESSION_HINT_COOKIE, useAuth } from "./AuthProvider";
import type { Session } from "./api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiGet: vi.fn(), apiSend: vi.fn() };
});

const session: Session = {
  user: { id: 5, username: "sara@example.com", email: "sara@example.com", first_name: "Sara", last_name: "Ahmed", name: "Sara Ahmed", is_staff: false, is_superuser: false },
  profile: { id: 1, user: 5, skin_tone: "Medium", cultural_preference: "Western", gender: "female", preferred_style: "casual", top_size: "M", bottom_size: "", shoe_size: "" },
};
const staffSession: Session = { ...session, user: { ...session.user, is_staff: true } };

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

function setHint(on: boolean) {
  document.cookie = `${SESSION_HINT_COOKIE}=${on ? "1" : ""}; Path=/${on ? "" : "; Max-Age=0"}`;
}

beforeEach(() => {
  vi.mocked(apiGet).mockReset();
  vi.mocked(apiSend).mockReset();
  setHint(false);
});
afterEach(() => setHint(false));

describe("useAuth", () => {
  it("is a guest and makes no request when there is no session hint", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user.isLoggedIn).toBe(false);
    expect(result.current.user.name).toBe("Guest User");
    expect(apiGet).not.toHaveBeenCalled();
  });

  it("loads the user from GET /api/auth/me/ on start when a session may exist", async () => {
    setHint(true);
    vi.mocked(apiGet).mockResolvedValue(session);
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(apiGet).toHaveBeenCalledWith("/api/auth/me/");
    expect(result.current.user).toMatchObject({
      isLoggedIn: true, name: "Sara Ahmed", email: "sara@example.com", isStaff: false, role: "Customer", contrastType: "Medium",
    });
    expect(result.current.profile?.gender).toBe("female");
  });

  it("treats a failed me/ as signed out", async () => {
    setHint(true);
    vi.mocked(apiGet).mockRejectedValue(new ApiError(401, "NotAuthenticated", "no"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user.isLoggedIn).toBe(false);
  });

  it("login signs in with an email or a username", async () => {
    vi.mocked(apiSend).mockResolvedValue(staffSession);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.login("sara@example.com", "pw"));
    expect(apiSend).toHaveBeenLastCalledWith("POST", "/api/auth/login/", { email: "sara@example.com", password: "pw" });
    expect(result.current.user).toMatchObject({ isLoggedIn: true, isStaff: true, role: "Admin" });

    await act(() => result.current.login("admin", "pw"));
    expect(apiSend).toHaveBeenLastCalledWith("POST", "/api/auth/login/", { username: "admin", password: "pw" });
  });

  it("a failed login throws the API error and stays signed out", async () => {
    vi.mocked(apiSend).mockRejectedValue(new ApiError(400, "ValidationError", "Incorrect email or password."));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await expect(act(() => result.current.login("a@b.co", "bad"))).rejects.toThrow("Incorrect email or password.");
    expect(result.current.user.isLoggedIn).toBe(false);
  });

  it("register signs the new user in", async () => {
    vi.mocked(apiSend).mockResolvedValue(session);
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.register({ name: "Sara Ahmed", email: "sara@example.com", password: "pw" }));
    expect(apiSend).toHaveBeenCalledWith("POST", "/api/auth/register/", { name: "Sara Ahmed", email: "sara@example.com", password: "pw" });
    expect(result.current.user.name).toBe("Sara Ahmed");
  });

  it("logout clears the user even if the server call fails", async () => {
    vi.mocked(apiSend).mockResolvedValueOnce(session).mockRejectedValueOnce(new TypeError("offline"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.login("sara@example.com", "pw"));
    await act(() => result.current.logout());
    expect(result.current.user.isLoggedIn).toBe(false);
    expect(apiSend).toHaveBeenLastCalledWith("POST", "/api/auth/logout/", {});
  });

  it("a scanned skin tone is kept for guests and saved to the profile of signed-in users", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setSkinTone("Dark"));
    expect(result.current.user.contrastType).toBe("Dark");
    expect(apiSend).not.toHaveBeenCalled(); // guests: nothing to save

    vi.mocked(apiSend).mockResolvedValueOnce(session);
    await act(() => result.current.login("sara@example.com", "pw"));
    vi.mocked(apiSend).mockResolvedValueOnce({ ...session, profile: { ...session.profile, skin_tone: "Fair" } });
    act(() => result.current.setSkinTone("Fair"));
    await waitFor(() => expect(apiSend).toHaveBeenLastCalledWith("PATCH", "/api/auth/me/", { skin_tone: "Fair" }));
  });

  it("must be used inside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
    spy.mockRestore();
  });
});
