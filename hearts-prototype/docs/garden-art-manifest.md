# Garden art

The garden draws itself in the page until these files are added under `hearts-prototype/public/garden/`. Drop a file in and the matching drawn stand-in steps aside. Nothing else in the app has to change.

Paths are served from the site root, so `public/garden/scene.webp` is requested as `/garden/scene.webp`.

## Scene

| File | Size | Background |
| --- | --- | --- |
| `/garden/scene.webp` | 1170 × 2532 | Opaque. The evening garden with no trees, so the trees can sit on top and grow. |

## Trees

One file per area, per stage. Stage 0 is a sapling. Stage 4 is full. Include the stone planter and the name space in the art, or leave that to the plaque the page already draws.

| File | Size | Background |
| --- | --- | --- |
| `/garden/trees/{area}-{stage}.webp` | about 480 × 640 | Transparent |

`{area}` is `quran`, `hadith`, `character`, `society` or `spirituality`. `{stage}` is `0`, `1`, `2`, `3` or `4`.

Example: `/garden/trees/quran-2.webp`.

## Fruit, lantern, watering can

| File | Size | Background |
| --- | --- | --- |
| `/garden/fruits/{area}.webp` | 128 × 128 | Transparent |
| `/garden/lantern.webp` | about 128 × 192 | Transparent |
| `/garden/watering-can.webp` | about 192 × 128 | Transparent |

## Which doors fill which tree

Every working door belongs to one tree.

| Tree | Doors |
| --- | --- |
| Qur'an | 12, His Books |
| Hadith | 1, 2, 19, 20, the sitting and the close |
| Character | 16, ihsan |
| Society | 3–8, Islam as it is lived with other people |
| Spirituality | 9–11, 13–15, 17, 18, iman apart from His Books, and the Hour |

A lesson is sown by its cut's best clause, and if that is empty, by a confirmed clause tag. A lesson with no door grows no tree.

Only a full talk finished in its course, and that course's questions answered there, fill a tree. A hors d'oeuvre or an appetiser never does. Stage 0 is a sapling. The first real thing done leaves 0. A third of the area is stage 2, three fifths is stage 3, and a finished area is stage 4.

## Motion

Lanterns glow, canopies sway, and fruit blooms in. `prefers-reduced-motion: reduce` turns those off.
