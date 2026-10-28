import { describe, expect, it } from "vitest";
import { isPrivateAdminPath, isPrivatePath, isPublicAdminPath, safeNextPath } from "./routes";

describe("isPrivatePath", () => {
  it.each(["/profile", "/my-orders", "/orders", "/order-confirmation", "/checkout", "/bookings"])(
    "%s is private",
    (path) => expect(isPrivatePath(path)).toBe(true),
  );

  it.each(["/", "/shop", "/product/3", "/scanner", "/login", "/register", "/forgot-password", "/reset-password", "/about", "/profiles-fan-page"])(
    "%s is public",
    (path) => expect(isPrivatePath(path)).toBe(false),
  );
});

describe("isPrivateAdminPath", () => {
  it.each(["/admin", "/admin/products", "/admin/team"])("%s needs an admin session", (path) =>
    expect(isPrivateAdminPath(path)).toBe(true),
  );

  it.each(["/admin/login", "/admin/forgot-password", "/admin/reset-password", "/administrator", "/shop"])(
    "%s does not",
    (path) => expect(isPrivateAdminPath(path)).toBe(false),
  );

  it("only the three admin auth pages are public inside the panel", () => {
    expect(isPublicAdminPath("/admin/login")).toBe(true);
    expect(isPublicAdminPath("/admin/forgot-password")).toBe(true);
    expect(isPublicAdminPath("/admin/reset-password")).toBe(true);
    expect(isPublicAdminPath("/admin")).toBe(false);
    expect(isPublicAdminPath("/admin/login/extra")).toBe(false);
  });

  it("the shop guard does not cover the admin panel", () => expect(isPrivatePath("/admin")).toBe(false));
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/profile")).toBe("/profile");
    expect(safeNextPath("/shop?gender=Women")).toBe("/shop?gender=Women");
  });

  it("refuses anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(bad as string | null | undefined)).toBe("/");
    }
  });
});
