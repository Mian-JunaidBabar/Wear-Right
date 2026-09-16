import { Product, InventoryItem, UserState } from "./types";

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-001",
    name: "Heritage Suede Trucker",
    price: 850,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBwRNpuuqMb7L_ImCpH_S_PKJmdb_OZcbhX2psDFwbFbb-sn_BV6FAhUv9mwJNTebmx7yUofWFd_c8pmI_shC2wIbQ3QCKIu8hyQy1sk2eD9sAnG55t7r1mB5_tDCNPQEf_FOWgoYSXygLWmok_LUIjZQ3m8m6Ebht0M6WeCs3FpCZ04qHakJwyxKWSw3CL5P0mxtk5Jw3z1lQpCExHr2-aKMMRriH8ao6uiQGUwqtfgLB2ZFnR1CIG-zXNUysW4XT-PLTslt_3Q2Q",
    match: 98,
    style: "Western",
    colors: ["Saddle Brown"],
  },
  {
    id: "prod-002",
    name: "Raw Selvedge Denim",
    price: 220,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCM8W4GNFB7HFurO-BVIPA2iv06juLpfLpxWoMG-DbGpgPnUtMXV6DxSABNy1mOXbcqGQoiMTX3jSHQCte0hRbWnxa3DTmOl2YwmN9w6btqgUcy7KBtOllub2_Y_0Kav9n3dcUWuRLsApYcWxD-jw6z3Vy_rHu-dkVWekoILabGH_Z-hnhZBQbeEtKt2Y3TmDIeGLZfMT5Yv29qSFu5QR4Bs7J8VJErLr1taFbw26pVVRYcIlbhkWnMcOWeG3VCm8fbPVIGYB6GaPw",
    match: 94,
    style: "Casual",
    colors: ["Black", "Navy"],
  },
  {
    id: "prod-003",
    name: "Oversized Linen Shirt",
    price: 185,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBtxjUj1YtjnNZDs-cMtkAGCkb0H82HlAiHfW0Vyx1wb7ol9ChAih-XJlQtMaHbeCjWXW7n0ER3FjFs45dbmWPwuNyuyG1lcROpzQ9hW-xwK1C9sI4HN8JgSKAhDxQuvHTjabolm3B0CPTVurNEcYeSCgpLQ4KtT7wt8p8-g9081Y4xUHW9P0dtZJrsC0pFTDhU_iAOCRi2TryQdbdg6Mmkr7-F7InCic4YOzFvUoVfwxbf-avoyPjc9-4VGp8J2Kd2P6-iYMsafYY",
    match: 91,
    style: "Casual",
    colors: ["White"],
  },
  {
    id: "prod-004",
    name: "Artisan Leather Boots",
    price: 450,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBRVVFtFMrEcRZ63U4mPLy83prvbfVvYVxGx4tKKtvksd5EQOTV9qpXN1p6FF-sQgTbzrggXSpc1-UHMoRpNLvDbrvo-dU3LkZA-TQIJ7sZWPGZOSU0SFzRF8WX9XILnJ_ywe0NmGOlYnnAOCMiO-yQkAuFnG8MNqhiweGTsG0jM4x_n3xdrGcqNbG-3P_lhnbuZ-cg0rhZbe4qVWavTK8uaDjp1Nx25jUybroaD5arDchfdv6JSIbEWOhNBeEU2Wk6Pfy_cqAGeyc",
    match: 89,
    style: "Western",
    colors: ["Saddle Brown"],
  },
  {
    id: "prod-005",
    name: "Canvas Chore Coat",
    price: 295,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCLNE-2N4M1KnBfSpyxtTlSliMVqQOYAw5WXPFbmvvwrbsmKlVvdKXcePZqc-PT6KAtE7X2f8mk36XbzTKhdfwcMNHW7luaAA4WI2lUyqw_oooCIR7d_937Md-iDXjLFni3_IS7c_sB76qbm7gh46f2TsGcqFXUG56HG7zLdaWkKlxuUZb3WG8kldD6XsSIY2x85nuFId6cUKw0_TNV8i54ItBU5tI_19-or5a279_Mk8L4C96zUtfggy-_pS-oWXHoFt-ostUy_80",
    match: 88,
    style: "Casual",
    colors: ["White", "Olive Drab"],
  },
  {
    id: "prod-006",
    name: "Felt Rancher Hat",
    price: 150,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCt8OqkLmCkQCu9yg18qCvWRhT_rj9k4Ig6wLK1XhJiJuN2tILMT2zrRz2FnWuQNTznW4dn6vohl0hTEkBm5jAkIWfbNjNcjo2_TiNiCXYGfeMItHC9r53RSYpbErfxgBxp1eOJiSIvfWv3KcTxIJZLOMMLe4WqWsdjbbHA7cimPOB3gVXTh2-Kl8Gs1PVx16ttai7AdjY38z7GAu4NCwrIARQKAZEkTZ1lTVIih0d0onua-FM7ethBE4qJZm0FJABJ9a1MzzSQCJU",
    match: 85,
    style: "Western",
    colors: ["Olive Drab", "White"],
  },
  {
    id: "prod-007",
    name: "Modernist High-Collar Cape",
    price: 1200,
    image: "...",
    match: 99,
    style: "Formal",
    colors: ["Black"],
  },
  {
    id: "prod-008",
    name: "Asymmetric Tailored Blazer",
    price: 950,
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuCS_KoB3eqo7HK6hmzDtLJrEiET8m5ZE3Mgi-BslQqHHkf_Q7cVAvqX-LJl9_n6ovvhqBk2nqAW6yLp6EiQ2r9xNdL9ik5LJGhncA9nLTlLikEKCYIIMaqeX6XK0UJQFrQGfbITB3AT2ApZiQpGClW3lZK0X0bBMnXbZuQGAidPHmZbl1bZ1qr8UT52tWrWvHBRGOHvAOGcAlv__HPLSw86UFKfiKPVH3bnh6bDuaoMFiyGHEcWWekBZDLF92tmkZzt7aQbORhB1uw",
    match: 92,
    style: "Formal",
    colors: ["White", "Black"],
  },
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: "WR-001-A",
    name: "Obsidian Silk Evening Gown",
    category: "Formalwear",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA9ODxf2GHcJDWnpGpL3Qi5POG7fL1rLEU7MMLEt6hp8ZWrKUCPaXMheOe362WccVBCiwUrkvxygL2NEdlSmEmD0JE933ilq96YIqAKN50yFD2VKbloC_nPpzbNI7e2fBau2CLCCNpm0MmAkWvghKsvcRVKPFIkghx_SBLZgGruRZ1u5kIo3T0c-9zLJSyIEK62L-ALcjIXXSrtjt2s0S5_2s3L11smXecLZfAzn0IXebWP01FaeG5TfisjwhmzrE9sUaipW1IzFNY",
    colors: ["Obsidian"],
    tags: ["Matte", "Evening"],
  },
  {
    id: "WR-042-W",
    name: "Architectural Poplin Shirt",
    category: "Essentials",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuByOdotW7UkUNDLWqjKQoFjwcAoGNRvMVqP3Qey0ugbTidtW7zHo76b9D7QRyh65Oe5PiJ2k7QVtvbQmiKJPVTQa_kL_3gcG1InpgIxHmlJXj8tnN_2lOAmtdXKSjSSOfgKu1sZgtF8udRHlxNwGqaT-bBvCVa6ZLDU4wFQOnHR8fc89TR79agCHA9J9i_nYq8gcPOdiy-SiNWC7ciH1z46P23FMDk32A04XJ8KcvIuEuXOm_xWjGLExkeX3wm7xHAq6nlb9TGJ4-g",
    colors: ["Optic White"],
    tags: ["Structured", "Linen"],
  },
  {
    id: "WR-018-T",
    name: "High-Waist Charcoal Trousers",
    category: "Tailoring",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB51vQefl9UYLhBWySpSN5K4DQcFalfQ1iu3k7W2PthaqChMJBuuYaKATAWMzAF0THikEv0cSmQOjg9xI3tkPP5RMXzruuss0QoelGFYWJ1Jx1y0V2Q59IIHJ68_YhHLV93VXdq16RjOQF9FF7zRqIxOcXQ0OG0-U_YKazJY5pHcGKvmxahGrsOI8MP2HxK3EcakhKvg8E2zeHVZ_jj12hE8B1j0rkoY2oultCF9KQYycVeblaBvNhF0Svrvh403TASYqzXRAyFqUU",
    colors: ["Charcoal"],
    tags: ["Wool", "Pleated"],
  },
];

export const COLOR_OPTIONS = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Saddle Brown", hex: "#8B4513" },
  { name: "Olive Drab", hex: "#556B2F" },
  { name: "Navy", hex: "#1E293B" },
  { name: "Charcoal", hex: "#374151" },
];

export const INITIAL_USER: UserState = {
  name: "Aura Identity",
  email: "stylist-pro@wearright.ai",
  avatar:
    "https://lh3.googleusercontent.com/aida-public/AB6AXuDMMMcxglfhff01ViMCUGFxFCQC4v-HAqZQG7yrhzMg70xftbFZEhQUc1sfMmKaeVpCHz8Xc2fm8z6kKrU0VxflGz5sEtrICoiorTr2beNKHwzy394KHygdZXQndACvFrIazFrLptxBjKxOZDkB0ESio36bU1V05FwEuRUx4fAH5FHlUUiqLYDrJ8dj1tzGi82T9LniGHLGMyt9-uFZzLikVLZlkFNg3AYRGhkP6rph3KUIsDr9la36JtU-om60Zu4qEFeBujWnqg4",
  role: "Atelier Premium",
  isLoggedIn: true,
  contrastType: "Medium Contrast",
};
