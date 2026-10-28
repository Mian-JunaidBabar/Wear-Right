"use client";

import ProductImage from "@/components/ProductImage";
import { boardImageFor, formatBoardPrice, type BoardTile } from "@/features/outfit/board";

type Props = {
  /** The look laid out by buildOutfitBoardTiles: anchor + one tile per slot (null = empty). */
  items: BoardTile[];
  /** Clicking a tile hands the item to the parent: scroll to its row, or open the product. */
  onSelect?: (itemId: number) => void;
  className?: string;
};

/**
 * The outfit board: the selected products' own photos arranged the way a person wears them —
 * top over bottom over shoes, accessories alongside — on one cream card. Replaces the old
 * SVG mannequin and the AR try-on overlay (plans 02 and 07): product photos cannot misplace
 * a watch or look like clip art.
 */
export default function OutfitBoard({ items, onSelect, className = "" }: Props) {
  const tall = items.find((tile) => tile.area === "tall");
  const top = items.find((tile) => tile.area === "top" && !tile.overlaps);
  const outerwear = items.find((tile) => tile.overlaps);
  const bottom = items.find((tile) => tile.area === "bottom");
  const footwear = items.find((tile) => tile.area === "footwear");
  const accessories = items.filter((tile) => tile.area === "accessory");

  // A kurta/dress spans the top and bottom rows; a real bottom piece keeps the row under it.
  const rowsClass = tall && bottom ? "grid-rows-3" : "grid-rows-2";
  const total = items.reduce((sum, tile) => sum + (tile.item ? Number(tile.item.price || 0) : 0), 0);
  const boardHeight = "h-[28rem] sm:h-[32rem]";

  return (
    <section aria-label="Outfit board" data-testid="outfit-board" className={`rounded-3xl bg-cream-card border border-brand-border/60 p-4 shadow-sm ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3">
        <div className={`grid gap-3 ${rowsClass} ${boardHeight}`}>
          {tall ? (
            <div className="row-span-2 flex items-stretch">
              {outerwear && <TileView tile={outerwear} onSelect={onSelect} className="z-0 w-24 shrink-0 sm:w-28 sm:-mr-6 -mr-4" />}
              <TileView tile={tall} onSelect={onSelect} className="z-10 min-w-0 flex-1" />
            </div>
          ) : (
            <div className="flex items-stretch">
              {outerwear && <TileView tile={outerwear} onSelect={onSelect} className="z-0 w-24 shrink-0 sm:w-28 sm:-mr-6 -mr-4" />}
              {top && <TileView tile={top} onSelect={onSelect} className="z-10 min-w-0 flex-1" />}
            </div>
          )}
          {bottom && <TileView tile={bottom} onSelect={onSelect} className="min-w-0" />}
        </div>
        <div className={`flex flex-col gap-3 ${boardHeight}`}>
          {accessories.map((tile) => (
            <TileView key={tile.key} tile={tile} onSelect={onSelect} className="min-h-20 flex-1" />
          ))}
        </div>
      </div>
      {footwear && <TileView tile={footwear} onSelect={onSelect} className="mt-3 h-32 sm:h-36" />}
      <div className="mt-3 flex items-center justify-between border-t border-brand-border/60 px-1 pt-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outfit total</p>
        <p data-testid="outfit-board-total" className="text-lg font-black text-brand-dark">{formatBoardPrice(total)}</p>
      </div>
    </section>
  );
}

function TileView({ tile, onSelect, className = "" }: { tile: BoardTile; onSelect?: (itemId: number) => void; className?: string }) {
  const body = (
    <>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-brand-border/60 bg-white shadow-[0_12px_28px_-16px_rgba(15,23,42,0.35)] transition-shadow group-hover:shadow-[0_14px_30px_-14px_rgba(15,23,42,0.5)]">
        {tile.item ? (
          <ProductImage src={boardImageFor(tile.item)} alt={tile.item.name} className="h-full w-full p-1.5" />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-300/70 bg-white/60 p-2 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {tile.skipped ? "Not included" : "No match in stock"}
            </span>
          </div>
        )}
        {tile.isAnchor && tile.item && (
          <span
            data-testid="board-anchor-badge"
            className="absolute left-2 top-2 rounded-full bg-brand-gold px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white shadow"
          >
            Your pick
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 px-0.5 transition-opacity lg:opacity-0 lg:group-hover:opacity-100">
        <span className="truncate text-[9px] font-black uppercase tracking-widest text-slate-400">{tile.label}</span>
        {tile.item && <span className="whitespace-nowrap text-[10px] font-bold text-slate-600">{formatBoardPrice(tile.item.price)}</span>}
      </div>
    </>
  );

  if (!tile.item) {
    return (
      <div data-testid={`board-tile-${tile.key}`} className={`group flex flex-col ${className}`}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-testid={`board-tile-${tile.key}`}
      title={tile.item.name}
      onClick={() => onSelect?.(tile.item!.id)}
      className={`group cursor-pointer flex flex-col text-left ${className}`}
    >
      {body}
    </button>
  );
}
