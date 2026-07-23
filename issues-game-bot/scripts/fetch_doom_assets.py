#!/usr/bin/env python3
import hashlib
import io
import gzip
from pathlib import Path
import zipfile
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

from vizdoom import scenarios_path

DOOM1_WAD_CANDIDATES = [
    # Historical mirrors (often unavailable; keep as optional fallbacks).
    "https://distro.ibiblio.org/slitaz/sources/packages/d/doom1.wad",
    "http://distro.ibiblio.org/pub/linux/distributions/slitaz/sources/packages/d/doom1.wad",
    "https://distro.ibiblio.org/pub/linux/distributions/slitaz/sources/packages/d/doom1.wad",
    # More reliable mirrors and packaged variants.
    "https://www.libsdl.org/projects/doom/data/doom1.wad.gz",
    "https://www.libsdl.org/projects/doom/data/doom1.wad.zip",
    "https://www.libsdl.org/projects/doom/data/doom1.wad",
    "https://archive.org/download/doom19s/doom19s.zip",
]
DOOM1_WAD_MD5 = "5f4eb849b1af12887dec04a2a12e5e62"


def digest(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def download_bytes(url: str) -> bytes:
    with urlopen(url, timeout=30) as response:
        return response.read()


def extract_wad_bytes(url: str, payload: bytes) -> bytes:
    url_lc = url.lower()

    if url_lc.endswith(".gz"):
        return gzip.decompress(payload)

    if url_lc.endswith(".zip"):
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            # Prefer explicit shareware naming, then any *.wad.
            names = archive.namelist()
            preferred = [name for name in names if Path(name).name.lower() in {"doom1.wad", "doom.wad"}]
            candidates = preferred or [name for name in names if name.lower().endswith(".wad")]
            if not candidates:
                raise RuntimeError("ZIP does not contain a .wad file")
            with archive.open(candidates[0]) as entry:
                return entry.read()

    return payload


def download_doom1_wad(wad_path: Path) -> str:
    last_error: Exception | None = None
    for candidate in DOOM1_WAD_CANDIDATES:
        try:
            print(f"Downloading shareware IWAD from {candidate}")
            payload = download_bytes(candidate)
            wad_bytes = extract_wad_bytes(candidate, payload)
            wad_path.write_bytes(wad_bytes)
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
    else:
        download_doom1_wad(wad_path)

    # Keep guaranteed scenario renderer paths.
    for filename in ["basic.wad", "basic.cfg", "defend_the_center.wad", "defend_the_center.cfg"]:
        data = (src / filename).read_bytes()
        (dest / filename).write_bytes(data)

    print(f"Saved IWAD: {wad_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
