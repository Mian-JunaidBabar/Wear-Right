import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ApiItem } from "@/features/recommender/api";
import TryOnModel from "./TryOnModel";

const mocks = vi.hoisted(() => ({
  garmentsFromItems: vi.fn(),
}));

vi.mock("@/features/tryon/bodies", () => ({
  loadBodies: vi.fn().mockResolvedValue([{
    id: "men-regular", name: "Men · Regular", gender: "men", preset: "regular",
    image: "/tryon/bodies/men-regular.jpg", width: 900, height: 1350, landmarks: [],
  }]),
  bodyFor: (bodies: unknown[]) => bodies[0] ?? null,
}));
vi.mock("@/features/tryon/items", () => ({
  loadImage: vi.fn().mockResolvedValue({ naturalWidth: 900, naturalHeight: 1350 }),
  garmentsFromItems: mocks.garmentsFromItems,
}));
vi.mock("@/components/tryon/TryOnCanvas", () => ({
  default: ({ label }: { label: string }) => <div data-testid="canvas">{label}</div>,
}));

const item = { id: 1, name: "Shirt", kind: "shirt", price: "2000" } as ApiItem;

describe("TryOnModel", () => {
  it("keeps the SVG fallback when nothing has a cut-out", async () => {
    mocks.garmentsFromItems.mockResolvedValue({ garments: [], unavailable: [item] });
    render(
      <TryOnModel items={[item]} gender="men" preset="regular" onPreset={vi.fn()} fallback={<div data-testid="svg-fallback" />} />,
    );
    expect(screen.getByTestId("svg-fallback")).toBeInTheDocument();
  });

  it("draws the model photo as soon as one piece is ready", async () => {
    mocks.garmentsFromItems.mockResolvedValue({
      garments: [{ id: 1, name: "Shirt", kind: "shirt", image: "/media/1.png", anchors: {}, width: 100, height: 100 }],
      unavailable: [],
    });
    render(
      <TryOnModel items={[item]} gender="men" preset="regular" onPreset={vi.fn()} fallback={<div data-testid="svg-fallback" />} />,
    );
    await waitFor(() => expect(screen.getByTestId("tryon-model-panel")).toBeInTheDocument());
    expect(screen.getByTestId("canvas")).toHaveTextContent("Outfit on a model");
  });
});
