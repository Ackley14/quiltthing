# Quilt Designer

A free, browser-based quilt design tool. Design blocks, arrange them into a quilt, plan the quilting, work out exactly what fabric to buy and how to cut it, then print a complete step-by-step pattern as a PDF.

Everything runs in the browser and nothing is uploaded. Projects save automatically to the browser, and you can download or open them as `.quilt.json` files.

## What it does

| Step | What you get |
|---|---|
| **Blocks** | Draw blocks on a square or 60° grid with shape, rectangle, half-square-triangle and seam tools. Edges can be curved into true arcs, and shapes can be appliquéd. Or start from 40+ library blocks. A piecing assistant spots pieces that can't be sewn with straight seams, or that would need templates, and suggests the fewest seam lines that turn them into standard rotary-cut shapes. |
| **Layout** | Straight set (with sashing and cornerstones), on point (with setting triangles), or a tessellation of hexagons, triangles, tumbling blocks, lightning bolts, bricks, diamonds or squares fitted to your chosen size. Also supports multiple borders, binding, rotation patterns, alternate blocks, fill patterns and a grayscale value check. |
| **Quilting** | Layers of quilting lines: straight, crosshatch, diamond hatch, wavy, zigzag, spiral, concentric circles or squares, in the ditch and echo. Each layer can cover the whole quilt, the centre, or the borders, and the app estimates thread. |
| **Fabric** | A shopping list per fabric, plus backing, batting and binding. Includes a fat-quarter check, plus a check against fabric you already own. |
| **Cutting** | A numbered cutting order per fabric with a to-scale map of the fabric you buy, showing every strip and sub-cut in place, plus pictures of where each cut goes in the block. Covers WOF strips, angled strips for diamonds, parallelograms and trapezoids, 60° triangles, joined strips for borders and binding, and true-size templates for curved or irregular shapes. Sizes come from offsetting each piece by the seam allowance, which reproduces the standard ⅞" HST and 1¼" QST rules. |
| **Pattern** | Cover, materials, cutting (with maps), templates, per-block pages with a piece key, method sketches and exploded step diagrams, then assembly, quilting and finishing. Print it, or save it as a PDF. |

## Running it

Open `index.html` in a browser; no build step or server is required. To host it, push the folder to a GitHub repository and enable **Settings → Pages** (deploy from the branch root).

## Code layout

```
index.html            app shell
css/app.css           styles (including print styles for the pattern)
vendor/               polygon-clipping (MIT), used for all shape boolean operations
js/core/              units & formatting, colour maths, geometry
js/model/             project state & undo, fabrics, blocks, block library,
                      layout engine, cutting & yardage, quilting lines, printable pattern
js/ui/                one file per view, plus the shell and sidebar
js/app.js             start-up and the sample quilt
```

All measurements are stored in inches; centimetres are a display setting.

## Licence

MIT. Uses [polygon-clipping](https://github.com/mfogel/polygon-clipping) (MIT).
