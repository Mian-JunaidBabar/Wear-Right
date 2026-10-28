# Model try-on body photos

All six photos come from Pexels and are used under the [Pexels License](https://www.pexels.com/license/)
(free to use, attribution not required). They are model photos, not measurements: the preset names are
how the product team sorts the looks, not a fit guarantee. In particular `men-plus.jpg` is a relaxed,
oversized silhouette rather than a measured plus fit.

| Local file | Pexels page | Photographer / collection |
| --- | --- | --- |
| `men-slim.jpg` | https://www.pexels.com/photo/man-in-black-clothes-posing-on-white-ba-18159440/ | Bruno Casttro |
| `men-regular.jpg` | https://www.pexels.com/photo/photo-of-man-posing-in-front-of-white-background-2364570/ | Pexels contributor (see page) |
| `men-plus.jpg` | https://www.pexels.com/photo/casual-portrait-of-man-in-studio-setting-33167520/ | karan (see page) |
| `women-slim.jpg` | https://www.pexels.com/photo/woman-posing-on-white-background-17781161/ | Pexels contributor (see page) |
| `women-regular.jpg` | https://www.pexels.com/photo/lady-in-jacket-and-bodysuit-on-white-background-in-studio-6856000/ | SHVETS production |
| `women-plus.jpg` | https://www.pexels.com/photo/young-plus-size-woman-stretching-body-in-white-studio-6975375/ | SHVETS production |

`bodies.json` is generated from these files by
`apps/server/venv/bin/python apps/server/scripts/precompute_body_landmarks.py`. Re-run it if a photo
is replaced; do not hand-edit the landmarks.
