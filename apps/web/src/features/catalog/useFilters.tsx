"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type SortBy = "match" | "priceAsc" | "priceDesc";

type FiltersApi = {
  selectedStyles: string[];
  setSelectedStyles: (styles: string[]) => void;
  selectedColors: string[];
  setSelectedColors: (colors: string[]) => void;
  sortBy: SortBy;
  setSortBy: (sortBy: SortBy) => void;
  toggleStyleFilter: (styleName: string) => void;
  toggleColorFilter: (colorName: string) => void;
  resetFilters: () => void;
};

const FiltersContext = createContext<FiltersApi | null>(null);

/** Shop filters are shared between the navbar and the shop page, so they live in one provider. */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [selectedStyles, setSelectedStyles] = useState<string[]>(["Western", "Casual"]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("match");

  const toggleStyleFilter = useCallback((styleName: string) => {
    setSelectedStyles((styles) =>
      styles.includes(styleName) ? styles.filter((style) => style !== styleName) : [...styles, styleName],
    );
  }, []);

  const toggleColorFilter = useCallback((colorName: string) => {
    setSelectedColors((colors) =>
      colors.includes(colorName) ? colors.filter((color) => color !== colorName) : [...colors, colorName],
    );
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedStyles(["Western", "Casual", "Formal", "Eastern"]);
    setSelectedColors([]);
  }, []);

  const value = useMemo(
    () => ({
      selectedStyles,
      setSelectedStyles,
      selectedColors,
      setSelectedColors,
      sortBy,
      setSortBy,
      toggleStyleFilter,
      toggleColorFilter,
      resetFilters,
    }),
    [selectedStyles, selectedColors, sortBy, toggleStyleFilter, toggleColorFilter, resetFilters],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersApi {
  const context = useContext(FiltersContext);
  if (!context) throw new Error("useFilters must be used inside <FiltersProvider>");
  return context;
}
