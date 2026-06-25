# tetris-pdf

Playable Tetris embedded in a PDF using the same broad technique used by Doom-in-PDF demos.

## How the Doom-in-PDF style works
- The PDF uses `AcroForm` widget fields as a pixel/text grid.
- Embedded PDF JavaScript drives the game loop and render updates.
- A hidden text field captures keystrokes (`/AA` keystroke action) and routes input to game logic.
- `app.setInterval(...)` runs periodic ticks.

Doom variants often generate large widget grids from a frame buffer. This project applies the same core model to Tetris with a compact text-grid renderer.

## Files
- `generate_tetris_pdf.py`: standalone generator (no dependencies).
- `tetris.pdf`: generated output.

## Build
```bash
python generate_tetris_pdf.py
```

## Controls
- `A`: move left
- `D`: move right
- `W`: rotate
- `S`: soft drop
- `Space`: hard drop
- `R`: restart

## Notes
PDF JavaScript support depends on viewer capabilities. Adobe Acrobat/Reader usually works best.
