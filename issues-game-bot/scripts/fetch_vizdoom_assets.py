#!/usr/bin/env python3
from pathlib import Path

from vizdoom import scenarios_path


def main() -> int:
    src = Path(scenarios_path)
    dest = Path(__file__).resolve().parent / "assets"
    dest.mkdir(parents=True, exist_ok=True)

    for filename in ["basic.wad", "basic.cfg"]:
        data = (src / filename).read_bytes()
        (dest / filename).write_bytes(data)

    print(f"Copied scenario assets to {dest}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
