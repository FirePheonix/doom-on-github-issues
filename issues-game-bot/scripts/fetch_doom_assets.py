#!/usr/bin/env python3
from pathlib import Path
from urllib.request import urlretrieve

DOOM1_WAD_URL = "https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad"


def main() -> int:
    dest = Path(__file__).resolve().parent / "assets"
    dest.mkdir(parents=True, exist_ok=True)

    wad_path = dest / "doom1.wad"
    if wad_path.exists() and wad_path.stat().st_size > 1024:
        print(f"IWAD already present: {wad_path}")
        return 0

    print(f"Downloading shareware IWAD from {DOOM1_WAD_URL}")
    urlretrieve(DOOM1_WAD_URL, wad_path)

    if wad_path.stat().st_size <= 1024:
        raise RuntimeError("Downloaded IWAD appears invalid")

    print(f"Saved IWAD: {wad_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
