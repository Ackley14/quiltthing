# Quilt Designer

A free, browser-based quilt design tool. Design blocks, arrange them into a quilt, plan the quilting, work out exactly what fabric to buy and how to cut it, then print a complete step-by-step pattern as a PDF.

Everything runs in the browser and nothing is uploaded. Every quilt saves itself as you work, in the browser, and File > My quilts lists them all with a picture of each. You can download or open projects as `.quilt.json` files to back them up or move them to another computer.

## What it does

| Step | What you get |
|---|---|
| **Blocks** | Draw square or hexagon blocks on a square or 60° grid with paint, fill, eraser, shape, rectangle, triangle, quarter-circle, seam and text tools (snap can be turned off). Fill turns empty space into a shape, bounded by the shapes and seam lines around it; the eraser removes shapes and seam lines with a click or a drag. Seam lines run from line to line and split shapes into pieces you can paint one by one, and hexagon blocks are shown the way they sit in the quilt. Edges can be curved into true arcs (hold Shift for standard arcs), shapes can be appliquéd, and words become editable appliqué lettering in 21 fonts (Fira Sans, Roboto, Montserrat, Anton, Playfair Display, Lobster and more). The editor zooms (Ctrl + scroll, or + and −) and can show centre lines. A tracing picture can sit over the block to draw from. Or start from 60+ blocks in the library, in folders by style (classic, stars, curves, appliqué, hexagon blocks and more) and by shape, and drag blocks straight onto the layout. The library's My blocks folder holds the blocks of every quilt you've saved in the browser, grouped by quilt, ready to reuse in another. A piecing assistant spots pieces that can't be sewn with straight seams, or that would need templates, and suggests the fewest seam lines that turn them into standard rotary-cut shapes. It stays quiet while you draw: a small warning triangle in the corner of the editor and a count on the Seam tool show that pieces need seams, and choosing the tool shows the pieces and the suggestion. |
| **Layout** | Straight set (with sashing and cornerstones), on point (with setting triangles, which can also hold blocks cut in half by the edge), or a tessellation of hexagons, triangles, tumbling blocks, lightning bolts, bricks, diamonds or squares fitted to your chosen size. Hexagons can hold your own hexagon blocks. Framed inset panels can be set into any layout (straight, on point or tessellation) and snap to the block seams; the pattern gives medallion-style assembly steps. Blocks and shapes partly covered by the edge or a panel become partial blocks cut to shape, or can be cut whole and trimmed. Hexagon tessellations come pointy or flat topped (also set from the block editor); changing the shape or orientation keeps the design where it was. Fill patterns (random, rows, columns, diagonals, rings, gradient, by direction) deal out the fabrics and hexagon blocks you choose. Also supports multiple borders, binding, rotation patterns, alternate blocks and a grayscale value check. The Layout and Quilting canvases zoom (Ctrl + scroll, + and −) and pan (scroll, Space-drag or the middle button). |
| **Quilting** | Layers of quilting lines: in the ditch, echo each piece (¼" inside the seams and around appliqué), meander/stipple, straight, crosshatch, diamond hatch, wavy, zigzag, spiral, concentric circles or squares. Each layer can cover the whole quilt, the centre, the borders, the plain squares and setting triangles, the sashing, an inset panel, or the centre around an inset, or just the **blocks** or **fabrics** you tick in a checklist (fabrics outside the blocks: plain squares, tessellation shapes, sashing, borders and frames), and fill patterns go around appliqué. Where two layers' lines lie on top of each other, the layer higher in the list keeps that stretch, so nothing is stitched twice. The app estimates thread. Includes dimensional face lines for 3D cubes, and a back view showing your backing fabric with the stitching mirrored. |
| **Fabric & cutting** | A shopping list per fabric, plus backing, batting (with the package size to buy) and binding. Each fabric can come as yardage of its own width, as precuts (fat quarters, fat eighths, charm squares, layer cakes…) or as pieces of a size you choose, with a default for all fabrics. Fabric you already own is cut first, and you only buy what's still needed. When a fabric bought as precuts has pieces too big for them, the shopping list, the fabric's settings and the cutting plan say which pieces fall back to yardage, and why. The backing can be any width or pieces you own, joined in panels or made with the diagonal cut-and-slide method (maths from [diagonalbackingCut](https://github.com/Ackley14/diagonalbackingCut)), whichever needs the least. Yardage assumes 40" of usable width, and precuts allow for trimming. The cutting plan gives a numbered cutting order per fabric with a to-scale map of the fabric you buy, showing every strip and sub-cut in place, plus pictures of where each cut goes in the block. Leftovers are reused: later steps are cut as shorter strips from the ends of earlier strips, and template pieces (hexagons nested honeycomb-style) fill the gaps before any new fabric is used. Covers WOF strips, angled strips for diamonds, parallelograms and trapezoids, 60° triangles, joined strips for borders and binding, and true-size templates for curved or irregular shapes. Sizes come from offsetting each piece by the seam allowance, which reproduces the standard ⅞" HST and 1¼" QST rules. |
| **Pattern** | Cover, materials, cutting (with maps), templates (shared when several fabrics use the same shape), per-block pages with a piece key, method sketches, exploded step diagrams and appliqué placement, then assembly, quilting and finishing with illustrated binding steps. Every cut shape has a code (A1, B2…) that appears in the cutting list, on block pictures and on a labelled assembly map, so each piece can be followed from fabric to quilt. Appliqué templates can be printed reversed for fusible web. Templates bigger than a page print over named sheets (T1-A1, T1-A2…) with glue strips, plus a sheet atlas showing how they fit together. Print it, or save it as a PDF. |

**Palettes** recolour a whole quilt in one step. There are 13 built-in palettes of 10 fabrics, all in the same light-to-dark order so switching keeps the quilt's value pattern, plus a generator that builds a balanced palette from one colour, and your own palettes saved in the browser. Drag one fabric swatch onto another to swap them everywhere.

Two sample quilts are built in (File menu): **Midnight Bullseye**, a straight set with a curved-pieced bullseye ringed by stars, and **Hexie Bloom**, a hexagon tessellation with hexie star and cube blocks around a framed lettering panel.

### The interface (version 4)

The window works like a desktop design program such as Photoshop or GIMP, with a dark theme by default (light is one click away):

- **App bar:** menus (File, Edit, View, Select, Insert, Window, Help), the five **workspaces** (Blocks, Layout, Quilting, Fabric & cutting, Pattern; keys 1–5), the quilt's name and command search (**Ctrl+K** finds any command, panel, block or fabric).
- **Tool strip** down the left, with tool names, plus **Hand** and **Zoom** on every canvas. The **context bar** above the canvas shows the current tool's options, the selection's commands, or the workspace's main actions.
- **Dockable panels** around the canvas. Each workspace has its own arrangement: Fabrics, Blocks, Shapes, a **Properties** panel that shows whatever is selected, the **Quilt** list of the quilt's parts (setting, sashing, inset panels, borders, binding, background), quilting **Layers**, Stash, Backing, pattern **Pages**, and History, Issues, Library, Palettes, Fabric Properties and Navigator from the Window menu. Panels are tabbed in groups, and can be resized, folded, collapsed to icon strips, dragged to another dock or into their own floating window, or closed. Every move is also in each panel's ⋯ menu. **Window** reopens any panel, resets a workspace's layout, locks the layout or hides all panels (**Ctrl+.**).
- **Canvas HUD:** an info line, the view switches, zoom, the Value-view reminder, the selection's size and the seam warning, each placed in any corner or hidden, per workspace (View ▸ Customise the canvas HUD). Optional rulers measure from the block's or the quilt's corner.
- **Status bar:** tool hints, the pointer position, Snap and Units switches, and an Issues count that opens the Issues panel.
- **Length boxes** accept quilting notation (`2-1/2`, `3 1/2`, `3½`), centimetres, sums (`3 1/2 + 1/4`) and changes to the current value (`+1/4`, `*2`, `50%`). Arrow keys step them.
- **History** lists the undo steps by name; click one to go back to it.
- A short **tour** on first run (Help ▸ Take the tour replays it) and a shortcut sheet (**?**).
- **Text size** Standard or Large, a choice of colour around the quilt (mid grey by default, so fabric colours are judged fairly), keyboard access throughout (F6 moves between regions), and layouts for small screens.

The design, its history, tracing pictures, palettes and saved quilts are stored as in version 3, so both versions open the same work (version 3 quilts a Blocks/Fabrics quilting layer over the whole quilt). Version 4's own settings (layouts and preferences) live in separate `quiltthing.v4.*` storage.

Right-click menus on blocks, fabrics, quilting layers, panel tabs and fabric rows give quick access, and fabrics can be dragged onto block pieces and plain squares. Tessellations can be nudged across and down on the sheet.

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
                      layout engine, cutting & yardage, backing, quilting lines, printable pattern
js/ui/                one file per workspace (blockView, layoutView, quiltingView,
                      fabricView/cuttingView, patternView), the shell (render loop,
                      events, menus, dialogs), the dock (dockModel.js: layout data,
                      Node-tested; dock.js: drawing and dragging), panels.js and
                      globalPanels.js (the panel registry), hud.js, rulers.js,
                      commands.js (Ctrl+K and the shortcut sheet), prefs.js (theme,
                      text size) and extras.js (welcome, tour, keyboard helpers)
js/app.js             start-up and the sample quilt
```

All measurements are stored in inches; centimetres are a display setting.

## Licence

MIT. Uses [polygon-clipping](https://github.com/mfogel/polygon-clipping) (MIT) and [opentype.js](https://github.com/opentypejs/opentype.js) (MIT). Lettering fonts are under the SIL Open Font License 1.1, except Roboto Slab (Apache License 2.0); the newer ones come from [Fontsource](https://fontsource.org) as Latin subsets. Licence texts are in `fonts/`.
