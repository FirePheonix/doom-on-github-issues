#!/usr/bin/env python3
import hashlib
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlretrieve

from vizdoom import scenarios_path

DOOM1_WAD_CANDIDATES = [
    "https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad",
    "http://distro.ibiblio.org/pub/linux/distributions/slitaz/sources/packages/d/doom1.wad",
    "https://distro.ibiblio.org/pub/linux/distributions/slitaz/sources/packages/d/doom1.wad",
]
DOOM1_WAD_MD5 = "5f4eb849b1af12887dec04a2a12e5e62"


def digest(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def download_doom1_wad(wad_path: Path) -> str:
    last_error: Exception | None = None
    for candidate in DOOM1_WAD_CANDIDATES:
        try:
            print(f"Downloading shareware IWAD from {candidate}")
            urlretrieve(candidate, wad_path)
            if wad_path.stat().st_size <= 1024:
                raise RuntimeError("Downloaded IWAD appears invalid")
            if digest(wad_path) != DOOM1_WAD_MD5:
                raise RuntimeError("Downloaded IWAD checksum mismatch")
            return candidate
        except (HTTPError, URLError, OSError, RuntimeError) as error:
            last_error = error
            if wad_path.exists():
                wad_path.unlink()
            print(f"Download failed from {candidate}: {error}")
    raise RuntimeError(f"Unable to download doom1.wad from any known mirror: {last_error}")


def main() -> int:
    src = Path(scenarios_path)
    dest = Path(__file__).resolve().parent / "assets"
    dest.mkdir(parents=True, exist_ok=True)

    wad_path = dest / "doom1.wad"
    if wad_path.exists() and wad_path.stat().st_size > 1024:
        print(f"IWAD already present: {wad_path}")
        return 0

    download_doom1_wad(wad_path)

    # Keep guaranteed scenario renderer paths.
    for filename in ["basic.wad", "basic.cfg", "defend_the_center.wad", "defend_the_center.cfg"]:
        data = (src / filename).read_bytes()
        (dest / filename).write_bytes(data)

    print(f"Saved IWAD: {wad_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
