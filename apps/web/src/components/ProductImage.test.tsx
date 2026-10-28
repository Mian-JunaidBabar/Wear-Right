import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PLACEHOLDER_IMAGE } from "@/lib/config";
import ProductImage from "./ProductImage";

describe("ProductImage", () => {
  it("renders the given image through the /media resolver and never crops by default", () => {
    render(<ProductImage src="/media/products/a.jpg" alt="Linen shirt" className="w-20 h-24" />);
    const img = screen.getByAltText("Linen shirt");
    expect(img).toHaveAttribute("src", "/media/products/a.jpg");
    expect(img.className).toContain("object-contain");
  });

  it("falls back to the placeholder for a missing src", () => {
    render(<ProductImage src={null} alt="Missing" />);
    expect(screen.getByAltText("Missing")).toHaveAttribute("src", PLACEHOLDER_IMAGE);
  });

  it("lets object-cover override the default object-contain", () => {
    const { rerender } = render(<ProductImage src="/media/products/a.jpg" alt="Tile" />);

    expect(screen.getByAltText("Tile")).toHaveClass("object-contain");

    rerender(<ProductImage src="/media/products/a.jpg" alt="Tile" className="w-full h-full object-cover" />);

    expect(screen.getByAltText("Tile")).toHaveClass("object-cover");
    expect(screen.getByAltText("Tile")).not.toHaveClass("object-contain");
  });

  it("swaps a broken image to the placeholder exactly once", () => {
    render(<ProductImage src="/media/products/gone.jpg" alt="Broken" />);
    const img = screen.getByAltText("Broken") as HTMLImageElement;
    expect(img.src).toContain("/media/products/gone.jpg");

    fireEvent.error(img);
    expect(img.src).toContain(PLACEHOLDER_IMAGE);

    // A second error (e.g. the placeholder itself failing) must not loop back to the original.
    fireEvent.error(img);
    expect(img.src).toContain(PLACEHOLDER_IMAGE);
  });
});
