import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { adminApi, type MannequinLayersResponse } from "@/features/admin/api";
import MannequinSection from "./MannequinSection";

vi.mock("@/features/admin/api", () => ({
  adminApi: {
    mannequinLayers: vi.fn(),
    products: vi.fn(),
    setMannequinLayerApproved: vi.fn(),
    deleteMannequinLayer: vi.fn(),
    uploadMannequinRender: vi.fn(),
  },
}));

vi.mock("@/features/admin/AdminAuthProvider", () => ({
  useAdminAuth: () => ({ can: (permission: string) => permission === "products.view" || permission === "products.manage" }),
}));

vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

const LAYERS: MannequinLayersResponse = {
  status: "success",
  bases: { men: { image: "/media/mannequin_alpha/base/men.jpg", fair: null, dark: null } },
  layers: [
    {
      id: 1,
      gender: "men",
      slot: "top",
      slot_label: "Shirts & tops",
      product_id: 10,
      product_name: "Pink formal shirt",
      approved: true,
      note: "",
      layer: "/media/mannequin_alpha/layers/men-10.png",
      layer_fair: "/media/mannequin_alpha/layers/men-10-fair.png",
      layer_dark: null,
      skins: { fair: "ok", dark: "the item changed in the skin variant (difference 12.0%)" },
      ecc: 0.997,
      updated_at: "2026-11-08T12:00:00Z",
    },
    {
      id: 2,
      gender: "men",
      slot: "watch",
      slot_label: "Watches",
      product_id: 11,
      product_name: "Black leather watch",
      approved: false,
      note: "render does not line up with the base (ECC 0.412 < 0.97)",
      layer: "/media/mannequin_alpha/layers/men-11.png",
      layer_fair: null,
      layer_dark: null,
      skins: { fair: "missing", dark: "missing" },
      ecc: 0.412,
      updated_at: "2026-11-08T12:00:00Z",
    },
  ],
  slots: [
    { value: "top", label: "Shirts & tops" },
    { value: "watch", label: "Watches" },
  ],
};

beforeEach(() => {
  vi.mocked(adminApi.mannequinLayers).mockReset().mockResolvedValue(LAYERS);
  vi.mocked(adminApi.products)
    .mockReset()
    .mockResolvedValue({ products: [{ id: 10, name: "Pink formal shirt" }, { id: 30, name: "Green shirt" }] });
  vi.mocked(adminApi.setMannequinLayerApproved).mockReset().mockResolvedValue({ status: "success", id: 1, approved: false });
  vi.mocked(adminApi.deleteMannequinLayer).mockReset().mockResolvedValue(null);
  vi.mocked(adminApi.uploadMannequinRender).mockReset();
});

describe("MannequinSection", () => {
  it("lists every layer with its checks and the Gemini instructions", async () => {
    render(<MannequinSection />);

    // the tab text is css-capitalized, so the accessible name is lowercase
    expect(screen.getByRole("tab", { name: "men" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "women" })).toBeInTheDocument();

    // the name appears on the layer card and again in the product picker
    expect((await screen.findAllByText("Pink formal shirt")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Shirts & tops").length).toBeGreaterThan(0); // card label + slot option
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Fair ✓")).toBeInTheDocument();
    expect(screen.getByText("Black leather watch")).toBeInTheDocument();
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("render does not line up with the base (ECC 0.412 < 0.97)")).toBeInTheDocument();

    // the instruction box, exactly as the guide says it
    expect(screen.getByText(/Open the base photo for this gender/)).toBeInTheDocument();
    expect(
      screen.getByText("Only the product may change. Same pose, same crop, same background, same size (960 x 1280 or 3:4)."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/If it says "does not line up", generate again; do not crop or resize the image yourself./),
    ).toBeInTheDocument();

    // "Download base" links to this gender's base photo
    expect(screen.getByRole("link", { name: "Download base" })).toHaveAttribute("href", "/media/mannequin_alpha/base/men.jpg");
  });

  it("hides and deletes a layer through the admin API", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(<MannequinSection />);

    await screen.findAllByText("Pink formal shirt");
    await user.click(screen.getByRole("button", { name: "Hide" }));
    expect(adminApi.setMannequinLayerApproved).toHaveBeenCalledWith(1, false);
    await waitFor(() => expect(adminApi.mannequinLayers).toHaveBeenCalledTimes(2)); // the list reloads

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]);
    expect(adminApi.deleteMannequinLayer).toHaveBeenCalledWith(1);
    confirm.mockRestore();
  });

  it("shows the reason when an uploaded render is rejected", async () => {
    vi.mocked(adminApi.uploadMannequinRender).mockRejectedValue(
      new ApiError(422, "Error", "Request failed (422)", {
        status: "rejected",
        outcome: "rejected",
        reason: "render does not line up with the base (ECC 0.500 < 0.97)",
      }),
    );
    const user = userEvent.setup();
    render(<MannequinSection />);

    await screen.findAllByText("Pink formal shirt");
    await user.selectOptions(screen.getByLabelText("Product"), "30");
    await user.selectOptions(screen.getByLabelText("Slot"), "top");
    await user.upload(screen.getByLabelText("Main render (required)"), new File(["x"], "render.png", { type: "image/png" }));
    await user.click(screen.getByRole("button", { name: /add render/i }));

    const [form] = vi.mocked(adminApi.uploadMannequinRender).mock.calls;
    expect(form?.[0]).toBeInstanceOf(FormData);
    expect(await screen.findByRole("status")).toHaveTextContent("render does not line up with the base (ECC 0.500 < 0.97)");
  });
});
