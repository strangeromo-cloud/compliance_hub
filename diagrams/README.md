# Architecture diagrams

Three views, meant to be read in order. Every number in them was read out of the
code or the database rather than remembered, so they go stale the same way the
README does — check them against the source before quoting a figure.

| File | What it answers |
| --- | --- |
| `0-分层架构` | What is this system? Two entry points, one core. Who matches rules and who writes analysis. |
| `1-功能架构` | What happens to one question, end to end, including the history and evolution loop. |
| `2-技术架构` | How the code is laid out, for someone picking it up. |

The `.svg` files are the source: they carry their own styles and a CJK font
stack, so they open in any browser and drop straight into slides, Figma or
draw.io. Rasters are gitignored — they weigh 3 MB together and do not diff, so
committing them would add that much to history on every re-render. The commands
below produce one when you need it.

## Which are generated and which are placed by hand

`2-技术架构` has a `.mmd` source and is generated. It is a plain DAG, and dagre
lays it out better than a person would:

```bash
node diagrams/render-mermaid.mjs diagrams/2-技术架构.mmd diagrams/2-技术架构
```

The script fetches the mermaid bundle beside itself on first run — that file is
gitignored, so a fresh checkout downloads it once.

`0-分层架构` and `1-功能架构` are hand-placed SVG with no `.mmd`. That is not
laziness: both are hub-and-loop shapes — the flow leaves the master agent and
returns to it — and a layered layout engine breaks a cycle by reversing an edge,
which scrambled the reading order in every orientation tried. Edit the SVG
directly and re-render:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu \
  --hide-scrollbars --default-background-color=FFFFFFFF --force-device-scale-factor=3 \
  --window-size=1220,1042 --screenshot=diagrams/0-分层架构.png \
  "file://$PWD/diagrams/0-分层架构.svg"
```

Match `--window-size` to the SVG's own `width`/`height`, plus a few pixels.

Render after every edit and look at the result. Hand-placed coordinates fail
silently: text runs past a box edge, an arrow crosses a panel it has nothing to
do with, and none of it raises an error. Most of the defects these diagrams went
through were found by looking at the render, not by reading the markup.
