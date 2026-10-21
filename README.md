# Quilt Designer

A free, browser-based quilt design tool. Design blocks, arrange them into a quilt, plan the quilting, work out exactly what fabric to buy and how to cut it, then print a complete step-by-step pattern as a PDF.

Everything runs in the browser and nothing is uploaded. Projects save automatically to the browser, and you can download or open them as `.quilt.json` files.

## What it does

| Step | What you get |
|---|---|
| **Blocks** | Draw square or hexagon blocks on a square or 60° grid with shape, rectangle, triangle, seam and text tools (snap can be turned off). Edges can be curved into true arcs (hold Shift for standard arcs), shapes can be appliquéd, and words become editable appliqué lettering in 21 fonts (Fira Sans, Roboto, Montserrat, Anton, Playfair Display, Lobster and more). The editor zooms (Ctrl + scroll, or + and −) and can show centre lines. A tracing picture can sit over the block to draw from. Or start from 40+ library blocks. A piecing assistant spots pieces that can't be sewn with straight seams, or that would need templates, and suggests the fewest seam lines that turn them into standard rotary-cut shapes. |
| **Layout** | Straight set (with sashing and cornerstones), on point (with setting triangles, which can also hold blocks cut in half by the edge), or a tessellation of hexagons, triangles, tumbling blocks, lightning bolts, bricks, diamonds or squares fitted to your chosen size. Hexagons can hold your own hexagon blocks, and framed inset panels can be set into any tessellation. Shapes cut off by the edge or a panel can be cut whole and trimmed, or cut to their exact shape with their own cutting steps. Also supports multiple borders, binding, rotation patterns, alternate blocks, fill patterns and a grayscale value check. |
| **Quilting** | Layers of quilting lines: straight, crosshatch, diamond hatch, wavy, zigzag, spiral, concentric circles or squares, in the ditch and echo. Each layer can cover the whole quilt, the centre, the borders, an inset panel, or the centre around an inset; in-the-ditch follows the seams inside blocks and around appliqué. The app estimates thread. Includes dimensional face lines for 3D cubes, and a back view showing your backing fabric with the stitching mirrored. |
| **Fabric** | A shopping list per fabric, plus backing, batting and binding. Includes a fat-quarter check, plus a check against fabric you already own. |
| **Cutting** | A numbered cutting order per fabric with a to-scale map of the fabric you buy, showing every strip and sub-cut in place, plus pictures of where each cut goes in the block. Covers WOF strips, angled strips for diamonds, parallelograms and trapezoids, 60° triangles, joined strips for borders and binding, and true-size templates for curved or irregular shapes. Sizes come from offsetting each piece by the seam allowance, which reproduces the standard ⅞" HST and 1¼" QST rules. |
| **Pattern** | Cover, materials, cutting (with maps), templates, per-block pages with a piece key, method sketches and exploded step diagrams, then assembly, quilting and finishing. Every cut shape has a code (A1, B2…) that appears in the cutting list, on block pictures and on a labelled assembly map, so each piece can be followed from fabric to quilt. Appliqué templates can be printed reversed for fusible web. Templates bigger than a page print over named sheets (T1-A1, T1-A2…) with glue strips, plus a sheet atlas showing how they fit together. Print it, or save it as a PDF. |

Two sample quilts are built in (File menu): **Midnight Bullseye**, a straight set with a curved-pieced bullseye ringed by stars, and **Hexie Bloom**, a hexagon tessellation with hexie star and cube blocks around a framed lettering panel.

## Running it

Open `index.html` in a browser; no build step or server is required. To host it, push the folder to a GitHub repository and enable **Settings → Pages** (deploy from the branch root).

## Code layout

```
index.html            app shell
css/app.css           styles (including print styles for the pattern)
vendor/               polygon-clipping (MIT) for shape boolean operations;
                      opentype.js (MIT), loaded only by the Text tool
fonts/                lettering fonts (SIL Open Font License), base64-wrapped so they
                      also load when the app is opened straight from disk
js/core/              units & formatting, colour maths, geometry
js/model/             project state & undo, fabrics, blocks, block library,
                      layout engine, cutting & yardage, quilting lines, printable pattern
js/ui/                one file per view, plus the shell and sidebar
js/app.js             start-up and the sample quilt
```

All measurements are stored in inches; centimetres are a display setting.

## Licence

MIT. Uses [polygon-clipping](https://github.com/mfogel/polygon-clipping) (MIT) and [opentype.js](https://github.com/opentypejs/opentype.js) (MIT). Lettering fonts are under the SIL Open Font License 1.1, except Roboto Slab (Apache License 2.0); the newer ones come from [Fontsource](https://fontsource.org) as Latin subsets. Licence texts are in `fonts/`.
