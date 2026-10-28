import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ApiItem } from "@/features/recommender/api";
import { buildOutfitBoardTiles, type LookSlotInput } from "@/features/outfit/board";
import OutfitBoard from "./OutfitBoard";

const item = (id: number, over: Partial<ApiItem> = {}): ApiItem => ({
  id,
  name: `Item ${id}`,
  price: 1000 + id,
  image: `/media/products/${id}.jpg`,
  ...over,
});

const slot = (name: string, kind: string, pick: ApiItem | null, required = true): LookSlotInput => ({
  slot: name,
  kind,
  required,
  pick,
});

describe("OutfitBoard", () => {
  it("shows the anchor with a Your pick badge and the whole look's total", () => {
    const tiles = buildOutfitBoardTiles(
      item(1, { name: "Linen shirt", kind: "shirt", price: 2500 }),
      "top",
      [
        slot("bottom", "", item(2, { kind: "jeans", price: 3000 })),
        slot("footwear", "", item(3, { kind: "sneakers", price: 4500 })),
      ],
    );
    render(<OutfitBoard items={tiles} />);

    expect(screen.getByTestId("board-anchor-badge")).toHaveTextContent("Your pick");
    expect(screen.getByTitle("Linen shirt")).toBeInTheDocument();
    expect(screen.getByTestId("outfit-board-total")).toHaveTextContent("Rs. 10,000");
  });

  it("renders a slot with no pick as a dashed empty tile, not a button", () => {
    const tiles = buildOutfitBoardTiles(
      item(1, { kind: "shirt" }),
      "top",
      [slot("bottom", "", null), slot("footwear", "", item(3))],
    );
    render(<OutfitBoard items={tiles} />);

    expect(screen.getByText("No match in stock")).toBeInTheDocument();
    expect(screen.getByTestId("board-tile-bottom").tagName).toBe("DIV");
    expect(screen.getByTestId("board-tile-footwear").tagName).toBe("BUTTON");
  });

  it("shows the cut-out for a try-on-ready piece and the photo otherwise", () => {
    const tiles = buildOutfitBoardTiles(
      item(1, { kind: "shirt", image: "/media/products/1.jpg", mannequin_image: "/media/products/mannequin/1.png", mannequin_ready: true }),
      "top",
      [slot("bottom", "", item(2, { kind: "jeans", image: "/media/products/2.jpg", mannequin_image: "/media/products/mannequin/2.png", mannequin_ready: false }))],
    );
    render(<OutfitBoard items={tiles} />);

    expect(screen.getByTestId("board-tile-anchor").querySelector("img")).toHaveAttribute("src", "/media/products/mannequin/1.png");
    expect(screen.getByTestId("board-tile-bottom").querySelector("img")).toHaveAttribute("src", "/media/products/2.jpg");
  });

  it("hands the clicked piece to onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const tiles = buildOutfitBoardTiles(
      item(1, { kind: "shirt" }),
      "top",
      [slot("bottom", "", item(2, { kind: "jeans" })), slot("footwear", "", item(3))],
    );
    render(<OutfitBoard items={tiles} onSelect={onSelect} />);

    await user.click(screen.getByTestId("board-tile-footwear"));
    expect(onSelect).toHaveBeenCalledWith(3);
  });
});
