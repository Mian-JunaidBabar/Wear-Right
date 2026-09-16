export type SkinToneKey = "fair" | "medium" | "dark";
export type StyleKey = "eastern" | "western" | "casual" | "formal";
export type GarmentKey = "shirt" | "pant" | "shoes";

export const SKIN_TONE_COLOR_FILTER: Record<
  SkinToneKey,
  Record<StyleKey | "shoes", string[]>
> = {
  fair: {
    eastern: [
      "navy blue",
      "maroon",
      "emerald green",
      "deep purple",
      "bottle green",
      "wine red",
      "black",
    ],
    western: [
      "royal blue",
      "charcoal grey",
      "black",
      "burgundy",
      "forest green",
    ],
    casual: [
      "sky blue",
      "pastel pink",
      "light grey",
      "white",
      "beige",
      "soft lavender",
    ],
    formal: [
      "black",
      "navy blue",
      "charcoal grey",
      "deep maroon",
      "dark brown",
    ],
    shoes: ["black", "dark brown", "tan", "white"],
  },

  medium: {
    eastern: [
      "mustard yellow",
      "olive green",
      "rust orange",
      "teal",
      "coral",
      "royal blue",
    ],
    western: ["grey", "olive green", "denim blue", "coral", "teal", "camel"],
    casual: [
      "mustard",
      "peach",
      "turquoise",
      "khaki",
      "off-white",
      "light olive",
    ],
    formal: ["grey", "navy blue", "deep teal", "brown", "burgundy"],
    shoes: ["brown", "tan", "white", "camel"],
  },

  dark: {
    eastern: [
      "white",
      "bright yellow",
      "fuchsia pink",
      "royal blue",
      "emerald green",
      "orange",
    ],
    western: ["white", "bright red", "cobalt blue", "yellow", "fuchsia"],
    casual: ["white", "bright orange", "turquoise", "hot pink", "lemon yellow"],
    formal: ["white", "cream", "beige", "royal blue", "charcoal"],
    shoes: ["white", "beige", "tan", "black"],
  },
};

export const OUTFIT_ITEM_COLOR_RULES: Record<
  SkinToneKey,
  Record<StyleKey, Record<GarmentKey, string[]>>
> = {
  fair: {
    eastern: {
      shirt: [
        "navy blue",
        "maroon",
        "emerald green",
        "deep purple",
        "bottle green",
        "wine red",
        "black",
        "white",
      ],
      pant: ["navy blue", "white", "beige", "black", "grey"],
      shoes: ["black", "dark brown", "tan", "white"],
    },
    western: {
      shirt: ["white", "royal blue", "charcoal grey", "black", "burgundy"],
      pant: ["charcoal grey", "navy blue", "black", "beige"],
      shoes: ["black", "dark brown", "tan", "white"],
    },
    casual: {
      shirt: [
        "white",
        "sky blue",
        "pastel pink",
        "light grey",
        "beige",
        "soft lavender",
      ],
      pant: ["navy blue", "white", "beige", "light grey", "denim blue"],
      shoes: ["white", "tan", "black", "brown"],
    },
    formal: {
      shirt: ["white", "sky blue", "light grey"],
      pant: ["black", "navy blue", "charcoal grey", "dark brown"],
      shoes: ["black", "dark brown"],
    },
  },

  medium: {
    eastern: {
      shirt: [
        "mustard yellow",
        "olive green",
        "rust orange",
        "teal",
        "coral",
        "royal blue",
        "off-white",
      ],
      pant: ["white", "beige", "grey", "olive green"],
      shoes: ["brown", "tan", "white", "camel"],
    },
    western: {
      shirt: ["grey", "coral", "teal", "off-white", "denim blue"],
      pant: ["olive green", "camel", "beige", "denim blue", "grey"],
      shoes: ["brown", "tan", "white sneakers", "white", "camel"],
    },
    casual: {
      shirt: ["mustard", "peach", "turquoise", "off-white", "light olive"],
      pant: ["khaki", "beige", "denim blue", "grey"],
      shoes: ["brown", "tan", "white", "camel"],
    },
    formal: {
      shirt: ["grey", "off-white", "light blue"],
      pant: ["navy blue", "deep teal", "brown", "burgundy"],
      shoes: ["brown", "tan"],
    },
  },

  dark: {
    eastern: {
      shirt: [
        "white",
        "bright yellow",
        "fuchsia pink",
        "royal blue",
        "emerald green",
        "orange",
      ],
      pant: ["white", "beige", "black", "royal blue"],
      shoes: ["white", "beige", "tan", "black"],
    },
    western: {
      shirt: ["white", "bright red", "cobalt blue", "yellow", "fuchsia"],
      pant: ["white", "beige", "black", "cobalt blue"],
      shoes: ["white", "beige", "black"],
    },
    casual: {
      shirt: [
        "white",
        "bright orange",
        "turquoise",
        "hot pink",
        "lemon yellow",
      ],
      pant: ["white", "beige", "black", "denim blue"],
      shoes: ["white", "beige", "tan"],
    },
    formal: {
      shirt: ["white", "cream", "beige"],
      pant: ["royal blue", "charcoal", "black"],
      shoes: ["white", "black", "beige"],
    },
  },
};

export function normalizeText(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function normalizeSkinTone(value?: string | null): SkinToneKey {
  const text = normalizeText(value);

  if (text.includes("fair") || text.includes("light")) {
    return "fair";
  }

  if (text.includes("dark") || text.includes("deep")) {
    return "dark";
  }

  return "medium";
}

export function normalizeStyle(value?: string | null): StyleKey {
  const text = normalizeText(value);

  if (text.includes("eastern")) {
    return "eastern";
  }

  if (text.includes("casual")) {
    return "casual";
  }

  if (text.includes("formal")) {
    return "formal";
  }

  return "western";
}

export function normalizeGarmentType(
  value?: string | null,
  category?: string | null,
): GarmentKey {
  const text = `${normalizeText(value)} ${normalizeText(category)}`;

  if (
    text.includes("shoe") ||
    text.includes("footwear") ||
    text.includes("sandal")
  ) {
    return "shoes";
  }

  if (
    text.includes("pant") ||
    text.includes("bottom") ||
    text.includes("shalwar") ||
    text.includes("trouser") ||
    text.includes("jean")
  ) {
    return "pant";
  }

  return "shirt";
}

export function getAllowedColorsForProduct(
  skinTone: SkinToneKey,
  style: StyleKey,
  garmentType: GarmentKey,
) {
  const layerOneColors =
    garmentType === "shoes"
      ? SKIN_TONE_COLOR_FILTER[skinTone].shoes
      : SKIN_TONE_COLOR_FILTER[skinTone][style];

  const layerTwoColors = OUTFIT_ITEM_COLOR_RULES[skinTone][style][garmentType];

  return layerTwoColors.filter((color) =>
    layerOneColors.map(normalizeText).includes(normalizeText(color)),
  );
}

export function isColorAllowed(
  productColor: string | undefined | null,
  allowedColors: string[],
) {
  const color = normalizeText(productColor);

  return allowedColors.some((allowedColor) => {
    const normalizedAllowed = normalizeText(allowedColor);

    return (
      color === normalizedAllowed ||
      color.includes(normalizedAllowed) ||
      normalizedAllowed.includes(color)
    );
  });
}

export function prettyLabel(value: string) {
  return value
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
