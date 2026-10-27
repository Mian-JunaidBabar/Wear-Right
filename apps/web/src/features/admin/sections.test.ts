import { describe, expect, it } from "vitest";
import { ADMIN_SECTION_SLUGS, sectionFromPath } from "./sections";

describe("admin sections", () => {
  it("maps URLs to sections", () => {
    expect(sectionFromPath("/admin")).toBe("dashboard");
    expect(sectionFromPath("/admin/")).toBe("dashboard");
    expect(sectionFromPath("/admin/products")).toBe("products");
    expect(sectionFromPath("/admin/team")).toBe("team");
    expect(sectionFromPath("/admin/nope")).toBeNull();
  });

  it("lists every non-dashboard slug for static params", () => {
    expect(ADMIN_SECTION_SLUGS).toContain("orders");
    expect(ADMIN_SECTION_SLUGS).not.toContain("");
  });
});
