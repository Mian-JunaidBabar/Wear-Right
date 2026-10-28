import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ArAnchorsEditor from "./ArAnchorsEditor";

describe("ArAnchorsEditor", () => {
  it("explains that anchors need the mannequin command when the product has none", () => {
    render(<ArAnchorsEditor image="/media/cut.png" kind="shirt" anchors={{}} onChange={vi.fn()} />);
    expect(screen.getByText(/no usable anchors/i)).toBeInTheDocument();
    expect(screen.getByText(/compute_tryon_anchors/i)).toBeInTheDocument();
  });

  it("shows one draggable dot per anchor and saves the moved point", () => {
    const onChange = vi.fn();
    render(
      <ArAnchorsEditor
        image="/media/cut.png"
        kind="shirt"
        anchors={{ l_shoulder: [10, 20], r_shoulder: [90, 20], hem_center: [50, 100] }}
        onChange={onChange}
      />,
    );
    const image = screen.getByAltText(/product cut-out for ar anchors/i);
    Object.defineProperty(image, "naturalWidth", { value: 100 });
    Object.defineProperty(image, "naturalHeight", { value: 200 });
    fireEvent.load(image);
    const dot = screen.getByRole("button", { name: /move l_shoulder anchor/i });
    fireEvent.pointerDown(dot, { pointerId: 1 });
    image.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 200, right: 100, bottom: 200, x: 0, y: 0, toJSON: () => ({}) });
    fireEvent.pointerMove(dot.parentElement as HTMLElement, { clientX: 25, clientY: 50 });
    expect(onChange).toHaveBeenCalledWith({ l_shoulder: [25, 50], r_shoulder: [90, 20], hem_center: [50, 100] });
  });
});
