import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/lib/api";
import { useCart } from "@/features/cart/useCart";
import TryOnView from "@/components/TryOnView";

const mocks = vi.hoisted(() => ({
  search: "items=325,999&body=women-plus",
  addToCart: vi.fn(),
}));

vi.mock("@/lib/navigation", () => ({
  useSearchParams: () => [new URLSearchParams(mocks.search)],
}));
vi.mock("@/lib/api", () => ({ apiGet: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));
vi.mock("@/features/cart/useCart", () => ({ useCart: () => ({ addToCart: mocks.addToCart }) }));
vi.mock("@/components/tryon/TryOnCanvas", () => ({
  default: ({ label }: { label: string }) => <div data-testid="canvas-stub">{label}</div>,
}));
vi.mock("@/features/tryon/pose", () => ({
  POSE: { nose: 0, leftEar: 7, rightEar: 8, leftShoulder: 11, rightShoulder: 12, leftElbow: 13, rightElbow: 14, leftWrist: 15, rightWrist: 16, leftHip: 23, rightHip: 24, leftKnee: 25, rightKnee: 26, leftAnkle: 27, rightAnkle: 28, leftHeel: 29, rightHeel: 30, leftFoot: 31, rightFoot: 32 },
  createVideoPoseLandmarker: vi.fn().mockRejectedValue(new Error("no camera")),
  createImagePoseLandmarker: vi.fn(),
  firstPose: vi.fn(),
}));
vi.mock("@/features/tryon/bodies", () => ({
  loadBodies: vi.fn().mockResolvedValue([{
    id: "women-plus", name: "Women · Plus", gender: "women", preset: "plus",
    image: "/tryon/bodies/women-plus.jpg", width: 900, height: 1350, landmarks: [],
  }]),
  bodyFor: (bodies: unknown[]) => bodies[0] ?? null,
}));

const product = {
  id: 325, name: "Blue T-Shirt", kind: "tshirt", slot: "top",
  mannequin_image: "/media/products/325.png", tryon_ready: false,
  image: "/media/products/325.png", price: "2900", stock_quantity: 3, status: "Active",
};

beforeEach(() => {
  vi.mocked(apiGet).mockReset();
  vi.mocked(useCart().addToCart).mockReset();
  mocks.search = "items=325,999&body=women-plus";
});

describe("TryOnView", () => {
  it("keeps a product without a cut-out as a chip and still adds the look to cart", async () => {
    vi.mocked(apiGet).mockImplementation(async (url: string) => {
      if (url.endsWith("/325/")) return { product };
      throw new Error("not found");
    });
    const user = userEvent.setup();
    render(<TryOnView />);

    await waitFor(() => expect(screen.getByText("Blue T-Shirt")).toBeInTheDocument());
    expect(screen.getByText("Not available for try-on")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /add whole look to cart/i }));
    expect(useCart().addToCart).toHaveBeenCalled();
  });

  it("opens on the model tab with the three modes", async () => {
    vi.mocked(apiGet).mockResolvedValue({ product });
    render(<TryOnView />);
    expect(screen.getByRole("tab", { name: "Model" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Your photo" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Camera" })).toBeInTheDocument();
  });

  it("reports a camera that cannot start instead of hanging on a spinner", async () => {
    vi.mocked(apiGet).mockResolvedValue({ product });
    const user = userEvent.setup();
    render(<TryOnView />);
    await user.click(screen.getByRole("tab", { name: "Camera" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/camera or pose model could not start/i);
  });
});
