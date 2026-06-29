# V1 Rendering Pipeline

## Contract

Node calls:

- `python scripts/fetch_doom_assets.py` (asset bootstrap, memoized once)
- `python scripts/doom_worker.py <session_json> <output_png>` (render step)

## Render Flow

```mermaid
flowchart LR
  JS[Session JSON] --> DW[doom_worker.py]
  DW --> SEL{DOOM_ENGINE}
  SEL -->|doomgeneric| DG[doomgeneric_issuebot binary]
  SEL -->|vizdoom| VZ[ViZDoom runtime]
  DG --> PNG[PNG output]
  VZ --> PNG
  PNG --> FR[/frames/:issue.png]
```

## doomgeneric Path

- writes command history to temp text file
- runs compiled `doomgeneric_issuebot` with:
  - `--commands`
  - `--iwad`
  - `--out`
  - `--ticks-per-cmd`
- receives PPM frame, converts to PNG with Pillow

## ViZDoom Path

- builds game from configured mode/assets
- replays history with button arrays
- reads framebuffer, writes PNG

## Important Note

Current V1 replays full command history on each render to reach latest state, then snapshots one frame.
