"""Generate a playable Tetris PDF using AcroForm + PDF JavaScript."""

from __future__ import annotations

from pathlib import Path


ROWS = 20
COLS = 10


class PDFBuilder:
    def __init__(self) -> None:
        self._objects: list[bytes] = []

    def add(self, content: str | bytes) -> int:
        data = content.encode("latin-1") if isinstance(content, str) else content
        self._objects.append(data)
        return len(self._objects)

    def build(self, root_obj: int) -> bytes:
        out = bytearray()
        out.extend(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")

        offsets = [0]
        for i, obj in enumerate(self._objects, start=1):
            offsets.append(len(out))
            out.extend(f"{i} 0 obj\n".encode("ascii"))
            out.extend(obj)
            out.extend(b"\nendobj\n")

        xref_start = len(out)
        out.extend(f"xref\n0 {len(offsets)}\n".encode("ascii"))
        out.extend(b"0000000000 65535 f \n")
        for off in offsets[1:]:
            out.extend(f"{off:010d} 00000 n \n".encode("ascii"))

        out.extend(
            (
                "trailer\n"
                f"<< /Size {len(offsets)} /Root {root_obj} 0 R >>\n"
                "startxref\n"
                f"{xref_start}\n"
                "%%EOF\n"
            ).encode("ascii")
        )
        return bytes(out)


def pdf_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def pdf_string(value: str) -> str:
    return f"({pdf_escape(value)})"


def stream_obj(payload: str) -> str:
    data = payload.encode("latin-1")
    return f"<< /Length {len(data)} >>\nstream\n{payload}\nendstream"


def js_source() -> str:
    return f"""
var ROWS = {ROWS};
var COLS = {COLS};
var EMPTY = ".";
var BLOCK = "#";
var board = [];
var score = 0;
var timer = null;
var active = null;
var over = false;

var SHAPES = [
  [[1,1,1,1]],
  [[1,1],[1,1]],
  [[0,1,0],[1,1,1]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,1,0],[0,1,1]]
];

function makeBoard() {{
  board = [];
  for (var y = 0; y < ROWS; y++) {{
    var row = [];
    for (var x = 0; x < COLS; x++) row.push(0);
    board.push(row);
  }}
}}

function copyShape(shape) {{
  var out = [];
  for (var y = 0; y < shape.length; y++) out.push(shape[y].slice(0));
  return out;
}}

function spawn() {{
  var s = copyShape(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
  active = {{ x: Math.floor((COLS - s[0].length) / 2), y: 0, shape: s }};
  if (collides(active.x, active.y, active.shape)) {{
    over = true;
    stopLoop();
  }}
}}

function collides(px, py, shape) {{
  for (var y = 0; y < shape.length; y++) {{
    for (var x = 0; x < shape[y].length; x++) {{
      if (!shape[y][x]) continue;
      var bx = px + x;
      var by = py + y;
      if (bx < 0 || bx >= COLS || by < 0 || by >= ROWS) return true;
      if (board[by][bx]) return true;
    }}
  }}
  return false;
}}

function mergeActive() {{
  for (var y = 0; y < active.shape.length; y++) {{
    for (var x = 0; x < active.shape[y].length; x++) {{
      if (active.shape[y][x]) board[active.y + y][active.x + x] = 1;
    }}
  }}
}}

function clearLines() {{
  var cleared = 0;
  for (var y = ROWS - 1; y >= 0; y--) {{
    var full = true;
    for (var x = 0; x < COLS; x++) if (!board[y][x]) full = false;
    if (!full) continue;
    board.splice(y, 1);
    var top = [];
    for (var k = 0; k < COLS; k++) top.push(0);
    board.unshift(top);
    cleared++;
    y++;
  }}
  if (cleared) score += cleared * 100;
}}

function viewCell(x, y) {{
  var filled = board[y][x];
  if (active) {{
    var rx = x - active.x;
    var ry = y - active.y;
    if (ry >= 0 && ry < active.shape.length && rx >= 0 && rx < active.shape[ry].length) {{
      if (active.shape[ry][rx]) filled = 1;
    }}
  }}
  return filled ? BLOCK : EMPTY;
}}

function draw() {{
  for (var y = 0; y < ROWS; y++) {{
    var line = "|";
    for (var x = 0; x < COLS; x++) line += viewCell(x, y);
    line += "|";
    this.getField("row" + y).value = line;
  }}

  var scoreText = "Score: " + score + "    Controls: A left, D right, W rotate, S down, Space drop, R reset";
  if (over) scoreText += "    GAME OVER";
  this.getField("score").value = scoreText;

  var input = this.getField("input");
  if (input) input.setFocus();
}}

function rotate(shape) {{
  var h = shape.length;
  var w = shape[0].length;
  var out = [];
  for (var x = 0; x < w; x++) {{
    var row = [];
    for (var y = h - 1; y >= 0; y--) row.push(shape[y][x]);
    out.push(row);
  }}
  return out;
}}

function stepDown() {{
  if (over) return;
  var ny = active.y + 1;
  if (!collides(active.x, ny, active.shape)) {{
    active.y = ny;
    return;
  }}
  mergeActive();
  clearLines();
  spawn();
}}

function hardDrop() {{
  if (over) return;
  while (!collides(active.x, active.y + 1, active.shape)) active.y++;
  stepDown();
}}

function tick() {{
  if (over) return;
  stepDown();
  draw();
}}

function stopLoop() {{
  if (timer !== null) {{
    app.clearInterval(timer);
    timer = null;
  }}
}}

function startLoop() {{
  stopLoop();
  timer = app.setInterval("tick()", 450);
}}

function resetGame() {{
  stopLoop();
  score = 0;
  over = false;
  makeBoard();
  spawn();
  draw();
  startLoop();
}}

function handleKey(key) {{
  if (!key || key.length === 0) return;
  var k = key.toLowerCase();

  if (k === "r") {{
    resetGame();
    return;
  }}
  if (over) return;

  if (k === "a") {{
    if (!collides(active.x - 1, active.y, active.shape)) active.x--;
  }} else if (k === "d") {{
    if (!collides(active.x + 1, active.y, active.shape)) active.x++;
  }} else if (k === "s") {{
    stepDown();
  }} else if (k === "w") {{
    var turned = rotate(active.shape);
    if (!collides(active.x, active.y, turned)) active.shape = turned;
  }} else if (key === " ") {{
    hardDrop();
  }}
  draw();
}}

function onKey() {{
  var k = event.change;
  event.change = "";
  event.rc = false;
  handleKey(k);
}}

function init() {{
  resetGame();
}}
""".strip()


def content_stream() -> str:
    lines = [
        "BT",
        "/Helv 18 Tf",
        "60 780 Td",
        f"{pdf_string('Tetris in a PDF')} Tj",
        "0 -22 Td",
        "/Helv 11 Tf",
        f"{pdf_string('This mirrors the Doom/PDF approach: form fields + embedded JavaScript.')} Tj",
        "ET",
    ]
    return "\n".join(lines)


def build_pdf(out_path: Path) -> None:
    b = PDFBuilder()

    pages_obj = b.add("placeholder")
    acroform_obj = b.add("placeholder")
    page_obj = b.add("placeholder")

    helv_font_obj = b.add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    cour_font_obj = b.add("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>")

    open_action_obj = b.add("placeholder")
    doc_js_obj = b.add("placeholder")
    content_obj = b.add(stream_obj(content_stream()))

    row_field_ids: list[int] = []
    row_top = 740
    row_h = 20
    for y in range(ROWS):
        y1 = row_top - y * row_h
        y0 = y1 - 16
        row_name = f"row{y}"
        row_value = "|" + ("." * COLS) + "|"
        row_obj = b.add(
            "\n".join(
                [
                    "<<",
                    "/Type /Annot",
                    "/Subtype /Widget",
                    "/FT /Tx",
                    f"/T {pdf_string(row_name)}",
                    f"/Rect [60 {y0} 310 {y1}]",
                    "/F 4",
                    "/Ff 1",
                    f"/V {pdf_string(row_value)}",
                    f"/DV {pdf_string(row_value)}",
                    "/DA (/Cour 12 Tf 0 0.95 0 rg)",
                    "/MK << /BG [0 0 0] /BC [0 0 0] >>",
                    "/BS << /W 0 >>",
                    f"/P {page_obj} 0 R",
                    ">>",
                ]
            )
        )
        row_field_ids.append(row_obj)

    score_obj = b.add(
        "\n".join(
            [
                "<<",
                "/Type /Annot",
                "/Subtype /Widget",
                "/FT /Tx",
                f"/T {pdf_string('score')}",
                "/Rect [60 300 560 322]",
                "/F 4",
                "/Ff 1",
                f"/V {pdf_string('Score: 0')}",
                "/DA (/Helv 11 Tf 0 0 0 rg)",
                "/MK << /BG [0.95 0.95 0.95] /BC [0.8 0.8 0.8] >>",
                "/BS << /W 1 >>",
                f"/P {page_obj} 0 R",
                ">>",
            ]
        )
    )

    input_obj = b.add(
        "\n".join(
            [
                "<<",
                "/Type /Annot",
                "/Subtype /Widget",
                "/FT /Tx",
                f"/T {pdf_string('input')}",
                "/Rect [8 8 9 9]",
                "/F 2",
                "/Ff 0",
                "/DA (/Helv 1 Tf 1 1 1 rg)",
                "/AA << /K << /S /JavaScript /JS (onKey\(\);) >> >>",
                f"/P {page_obj} 0 R",
                ">>",
            ]
        )
    )

    fields = row_field_ids + [score_obj, input_obj]
    field_refs = " ".join(f"{fid} 0 R" for fid in fields)

    acroform = "\n".join(
        [
            "<<",
            f"/Fields [{field_refs}]",
            "/NeedAppearances true",
            f"/DA (/Helv 10 Tf 0 g)",
            f"/DR << /Font << /Helv {helv_font_obj} 0 R /Cour {cour_font_obj} 0 R >> >>",
            ">>",
        ]
    )
    b._objects[acroform_obj - 1] = acroform.encode("latin-1")

    annots = " ".join(f"{fid} 0 R" for fid in fields)
    page = "\n".join(
        [
            "<<",
            "/Type /Page",
            f"/Parent {pages_obj} 0 R",
            "/MediaBox [0 0 612 792]",
            f"/Contents {content_obj} 0 R",
            f"/Annots [{annots}]",
            f"/Resources << /Font << /Helv {helv_font_obj} 0 R /Cour {cour_font_obj} 0 R >> >>",
            ">>",
        ]
    )
    b._objects[page_obj - 1] = page.encode("latin-1")

    pages = "\n".join(
        [
            "<<",
            "/Type /Pages",
            f"/Kids [{page_obj} 0 R]",
            "/Count 1",
            ">>",
        ]
    )
    b._objects[pages_obj - 1] = pages.encode("latin-1")

    js = js_source()
    b._objects[doc_js_obj - 1] = f"<< /S /JavaScript /JS {pdf_string(js)} >>".encode("latin-1")
    b._objects[open_action_obj - 1] = b"<< /S /JavaScript /JS (init\(\);) >>"

    catalog = b.add(
        "\n".join(
            [
                "<<",
                "/Type /Catalog",
                f"/Pages {pages_obj} 0 R",
                f"/AcroForm {acroform_obj} 0 R",
                f"/OpenAction {open_action_obj} 0 R",
                f"/Names << /JavaScript << /Names [{pdf_string('TetrisDocJS')} {doc_js_obj} 0 R] >> >>",
                ">>",
            ]
        )
    )

    out_path.write_bytes(b.build(catalog))


def main() -> None:
    out = Path(__file__).with_name("tetris.pdf")
    build_pdf(out)
    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
