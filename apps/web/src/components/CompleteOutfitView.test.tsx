import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompleteLookResponse } from "@/features/recommender/api";
import CompleteOutfitView from "./CompleteOutfitView";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  addToCart: vi.fn(),
  search: "productId=268",
}));

vi.mock("@/features/recommender/api", () => ({
  recommenderApi: { completeLook: vi.fn() },
}));

vi.mock("@/lib/navigation", () => ({
  useNavigate: () => mocks.navigate,
  useSearchParams: () => [new URLSearchParams(mocks.search)],
}));

vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({ user: { contrastType: "medium" }, profile: null }),
}));

vi.mock("@/features/cart/useCart", () => ({
  useCart: () => ({ addToCart: mocks.addToCart }),
}));

vi.mock("@/lib/notify", () => ({ notify: vi.fn() }));

import { recommenderApi } from "@/features/recommender/api";

const item = (id: number, name: string, price: string) =>
  ({
    id,
    name,
    price,
    image: `/media/products/${id}.png`,
    color_name: "",
    stock_quantity: 5,
    status: "Active",
    slot: "top",
    kind: null,
    mannequin_image: "",
    mannequin_ready: false,
  }) as never;

// A formal look whose required top has no pick in stock — the exact shape that
// used to read as "Not included" because the old seed stored null picks.
const look: CompleteLookResponse = {
  look_type: "formal",
  anchor: item(268, "Reid & Taylor Men Charcoal Grey Blazer", "9300"),
  anchor_slot: "outerwear",
  slots: [
    { slot: "top", kind: null, required: true, pick: null, swaps: [] },
    { slot: "bottom", kind: null, required: true, pick: item(261, "Mark Taylor Men Striped Black Trousers", "3500"), swaps: [item(999, "Other Men Trousers", "3200")] },
    { slot: "footwear", kind: null, required: true, pick: item(356, "Woodland Men Black Formal Shoes", "6100"), swaps: [] },
    { slot: "accessory", kind: "tie", required: false, pick: item(352, "Park Avenue Men White Tie", "1800"), swaps: [item(305, "Park Avenue Men Red Tie", "1600")] },
    { slot: "accessory", kind: "watch", required: false, pick: null, swaps: [] },
    { slot: "accessory", kind: "belt", required: false, pick: item(147, "Belmonte Men Authentic Black Belt", "3400"), swaps: [] },
  ],
  complete: false,
  missing: ["top", "watch"],
  gender: "men",
} as unknown as CompleteLookResponse;

beforeEach(() => {
  vi.mocked(recommenderApi.completeLook).mockReset();
  mocks.navigate.mockReset();
  mocks.addToCart.mockReset();
});

describe("CompleteOutfitView", () => {
  it("shows an unavailable pick as No match in stock until the shopper skips it", async () => {
    vi.mocked(recommenderApi.completeLook).mockResolvedValue(look);
    const user = userEvent.setup();
    render(<CompleteOutfitView />);

    await screen.findByTestId("outfit-board");

    // The top slot has no pick in stock and the shopper did nothing yet:
    // the board tile must say "No match in stock", not "Not included".
    const topTile = screen.getByTestId("board-tile-top");
    expect(within(topTile).getByText(/no match in stock/i)).toBeInTheDocument();
    expect(within(topTile).queryByText(/not included/i)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("look-slot-top")).getByText(/nothing in stock matches this slot yet/i)).toBeInTheDocument();

    // The tie has a pick; skipping it is an explicit shopper action, which the
    // board reads back as "Not included".
    const tieTile = screen.getByTestId("board-tile-tie");
    expect(within(tieTile).queryByText(/not included/i)).not.toBeInTheDocument();
    await user.click(within(screen.getByTestId("look-slot-tie")).getByRole("button", { name: /skip/i }));
    await waitFor(() => expect(within(screen.getByTestId("board-tile-tie")).getByText(/not included/i)).toBeInTheDocument());
  });
});
