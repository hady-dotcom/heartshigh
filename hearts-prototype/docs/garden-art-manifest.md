# Garden art

Painted layers live under `hearts-prototype/public/garden/` and are requested from the site root. `public/garden/bg/garden-evening.webp` is `/garden/bg/garden-evening.webp`.

The scene is the full phone, 390 × 844, with the tab bar over the bottom of the path. Background files are 780 × 1688, exactly twice that.

## Backgrounds

| File | Size | Background |
| --- | --- | --- |
| `/garden/bg/garden-evening.webp` | 780 × 1688 | Opaque evening garden, no trees |
| `/garden/bg/garden-dawn.webp` | 780 × 1688 | Opaque dawn garden, no trees |

`GardenScene` takes `theme="evening"` (the default) or `theme="dawn"`. Dawn swaps the background. The trees pick up a cool pink-lilac tint. The garden page also honours `?theme=dawn` so another theme pass can drive it without a switcher here.

## Trees

One combined file per area, per stage. Stage 0 is a sapling. Stage 4 is full. The canvas is 512 × 640 with a transparent background. The planter's bottom-centre anchor is the same in every file: **(256, 622)**. The page places that point on the stone pad.

| File | Size | Background |
| --- | --- | --- |
| `/garden/trees/{area}/stage-{stage}.webp` | 512 × 640 | Transparent |

`{area}` is `quran`, `hadith`, `character`, `society` or `spirituality`. `{stage}` is `0` to `4`.

Plaques in the art are blank. The page draws the name in Cinzel 600, at least 9.5pt, centred on the plaque face (about 91% down the canvas). Qur’an uses a real apostrophe: QUR’AN.

The five pads are a smile. Qur’an is back-left, Spirituality back-right, Hadith middle-left, Society middle-right, Character front-centre and in front. A sapling (stage 0 or 1) paints above a fuller tree so a small one is not hidden, and the outer plaques stay out to the sides.

## Split layers and sway

Planters, soil and plaques stay still. Only the trunk and canopy sway, a small rotation of about 0.6–1.2 degrees, each tree on its own timing, around the trunk base where it meets the soil.

The component already draws two layers:

- `.tree-planter` is static. It holds the planter image and the plaque name.
- `.tree-canopy` holds the canopy image and the medallions. Its `transform-origin` is the trunk-base pivot.

Until the split files arrive, the planter layer uses the combined file and the canopy layer has no image, so nothing sways (`data-sway="off"`). When these files are added, set `CANOPY_SPLIT` in `src/lib/garden-art.ts` and put the measured pivot in `TRUNK_PIVOT` (today a stand-in at **(256, 600)**, just above the anchor):

| File | Role |
| --- | --- |
| `/garden/trees/{area}/stage-{stage}-planter.webp` | Planter, soil, blank plaque. Still. |
| `/garden/trees/{area}/stage-{stage}-canopy.webp` | Trunk and canopy. Same canvas and anchor. Sways. |

Medallions are children of the canopy layer, so they move with it once sway is on.

## Medallions and props

| File | Size | Background |
| --- | --- | --- |
| `/garden/fruit/medallion-glow.webp` | 256 × 256 | Transparent. A finished talk or course. |
| `/garden/fruit/medallion-empty.webp` | 256 × 256 | Transparent. Still to finish. |
| `/garden/props/lantern.webp` | 244 × 512 | Transparent |
| `/garden/props/watering-can.webp` | 512 × 395 | Transparent |

A glow medallion links to what was sown. An empty one links to the talk or course still to come. The plaque name links to the workbook. At most six medallions hang in a crown, earned ones first. A glow medallion blooms the first time this browser shows it.

The lantern’s glow pulses. `prefers-reduced-motion: reduce` turns the pulse, the canopy sway and the bloom off.

## Which doors fill which tree

Every working door belongs to one tree.

| Tree | Doors |
| --- | --- |
| Qur’an | 12, His Books |
| Hadith | 1, 2, 19, 20, the sitting and the close |
| Character | 16, ihsan |
| Society | 3–8, Islam as it is lived with other people |
| Spirituality | 9–11, 13–15, 17, 18, iman apart from His Books, and the Hour |

A lesson is sown by its cut's best clause, and if that is empty, by a confirmed clause tag. A lesson with no door grows no tree.

Only a full talk finished in its course, and that course's questions answered there, fill a tree. A hors d'oeuvre or an appetiser never does. Stage 0 is a sapling. The first real thing done leaves 0. A third of the area is stage 2, three fifths is stage 3, and a finished area is stage 4.
