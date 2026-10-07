import { describe, expect, it } from "vitest";
import { isPrivatePath, safeNextPath } from "./routes";

describe("isPrivatePath", () => {
  it.each(["/profile", "/my-orders", "/orders", "/order-confirmation", "/checkout", "/bookings", "/admin", "/admin/anything"])(
    "%s is private",
    (path) => expect(isPrivatePath(path)).toBe(true),
  );

  it.each(["/", "/shop", "/product/3", "/scanner", "/login", "/register", "/about", "/profiles-fan-page"])(
    "%s is public",
    (path) => expect(isPrivatePath(path)).toBe(false),
  );
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
