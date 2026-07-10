#!/usr/bin/env python3
import json
import os
import selectors
import subprocess
import sys
from pathlib import Path

from PIL import Image
from vizdoom import (
    Button,
    DoomGame,
    GameVariable,
    Mode,
    ScreenFormat,
    ScreenResolution,
)


BUTTONS = [
    Button.MOVE_FORWARD,
    Button.MOVE_BACKWARD,
    Button.TURN_LEFT,
    Button.TURN_RIGHT,
    Button.ATTACK,
    Button.USE,
]


def action_for(command: str) -> list[int]:
    cmd = (command or "").strip().lower()
    action = [0, 0, 0, 0, 0, 0]
    if cmd == "w":
        action[0] = 1
    elif cmd == "s":
        action[1] = 1
    elif cmd == "a":
        action[2] = 1
    elif cmd == "d":
        action[3] = 1
    elif cmd == "fire":
        action[4] = 1
    elif cmd == "enter":
        action[5] = 1
    return action


def save_output_image(image: Image.Image, out_png: Path) -> None:
    scale = float(os.getenv("DOOM_FRAME_SCALE", "0.8"))
    scale = 1.0 if scale <= 0 else scale
    if scale != 1.0:
        w = max(1, int(image.width * scale))
        h = max(1, int(image.height * scale))
        image = image.resize((w, h), Image.Resampling.BILINEAR)

    compress_level = int(os.getenv("DOOM_PNG_COMPRESS_LEVEL", "3"))
    compress_level = 0 if compress_level < 0 else 9 if compress_level > 9 else compress_level
    optimize = os.getenv("DOOM_PNG_OPTIMIZE", "false").lower() == "true"

    out_png.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_png, format="PNG", compress_level=compress_level, optimize=optimize)


def build_vizdoom_game(seed: int) -> DoomGame:
    assets_root = Path(__file__).resolve().parent / "assets"
    iwad_path = assets_root / "doom1.wad"
    demon_cfg = assets_root / "defend_the_center.cfg"
    demon_wad = assets_root / "defend_the_center.wad"
    basic_cfg = assets_root / "basic.cfg"
    basic_wad = assets_root / "basic.wad"
    mode = os.getenv("DOOM_MODE", "demons").strip().lower()

    if (
        not iwad_path.exists()
        and not (demon_cfg.exists() and demon_wad.exists())
        and not (basic_cfg.exists() and basic_wad.exists())
    ):
        raise RuntimeError("Missing assets. Run scripts/fetch_doom_assets.py first.")

    if mode in {"demons", "scenario"} and demon_cfg.exists() and demon_wad.exists():
        game = DoomGame()
        game.load_config(str(demon_cfg))
        game.set_doom_scenario_path(str(demon_wad))
        game.set_mode(Mode.PLAYER)
        game.set_seed(seed)
        game.set_window_visible(False)
        game.set_screen_resolution(ScreenResolution.RES_320X240)
        game.set_screen_format(ScreenFormat.RGB24)
        game.set_sound_enabled(False)
        game.set_living_reward(0.0)
        game.set_episode_timeout(2100)
        game.set_available_buttons(BUTTONS)
        game.set_available_game_variables([GameVariable.HEALTH, GameVariable.KILLCOUNT])
        game.init()
        game.new_episode()
        return game

    if mode == "classic" and iwad_path.exists():
        try:
            game = DoomGame()
            game.set_doom_game_path(str(iwad_path))
            game.set_doom_map("E1M1")
            game.add_game_args("+skill 2")
            game.set_mode(Mode.PLAYER)
            game.set_seed(seed)
            game.set_window_visible(False)
            game.set_screen_resolution(ScreenResolution.RES_320X240)
            game.set_screen_format(ScreenFormat.RGB24)
            game.set_sound_enabled(False)
            game.set_living_reward(0.0)
            game.set_episode_timeout(2100)
            game.set_available_buttons(BUTTONS)
            game.set_available_game_variables([GameVariable.HEALTH, GameVariable.KILLCOUNT])
            game.init()
            game.new_episode()
            return game
        except Exception as exc:
            print(f"classic_iwad_init_failed={exc}", file=sys.stderr)

    game = DoomGame()
    if not basic_cfg.exists() or not basic_wad.exists():
        raise RuntimeError("Fallback scenario assets missing (basic.wad/basic.cfg)")
    game.load_config(str(basic_cfg))
    game.set_doom_scenario_path(str(basic_wad))
    game.set_mode(Mode.PLAYER)
    game.set_seed(seed)
    game.set_window_visible(False)
    game.set_screen_resolution(ScreenResolution.RES_320X240)
    game.set_screen_format(ScreenFormat.RGB24)
    game.set_sound_enabled(False)
    game.set_living_reward(0.0)
    game.set_episode_timeout(2100)
    game.set_available_buttons(BUTTONS)
    game.set_available_game_variables([GameVariable.HEALTH, GameVariable.KILLCOUNT])
    game.init()
    game.new_episode()
    return game


class SessionWorker:
    def __init__(self, out_png: Path, seed: int):
        backend = os.getenv("DOOM_ENGINE", "doomgeneric").strip().lower()
        self.backend = None
        if backend == "doomgeneric":
            try:
                self.backend = DoomGenericSession(out_png)
                return
            except Exception as exc:
                print(f"doomgeneric_session_worker_failed={exc}", file=sys.stderr)

        self.backend = VizDoomSession(out_png, seed)

    def step(self, commands: list[str]) -> None:
        self.backend.step(commands)

    def snapshot(self) -> None:
        self.backend.snapshot()

    def shutdown(self) -> None:
        self.backend.shutdown()


class VizDoomSession:
    def __init__(self, out_png: Path, seed: int):
        self.out_png = out_png
        self.seed = seed
        self.game = build_vizdoom_game(seed)
        self.tics = int(os.getenv("DOOM_TICS_PER_COMMENT", "5"))

    def _snapshot(self) -> None:
        state = self.game.get_state()
        frame = state.screen_buffer if state else None
        if frame is None:
            self.game.new_episode()
            frame = self.game.get_state().screen_buffer
        save_output_image(Image.fromarray(frame), self.out_png)

    def step(self, commands: list[str]) -> None:
        for command in commands:
            self.game.make_action(action_for(command), self.tics)
            if self.game.is_episode_finished():
                self.game.new_episode()
        self._snapshot()

    def snapshot(self) -> None:
        self._snapshot()

    def shutdown(self) -> None:
        self.game.close()


class DoomGenericSession:
    def __init__(self, out_png: Path):
        assets_root = Path(__file__).resolve().parent / "assets"
        iwad_path = assets_root / "doom1.wad"
        bin_path = assets_root / "doomgeneric_session_worker"

        if not iwad_path.exists():
            raise RuntimeError("doomgeneric mode requires scripts/assets/doom1.wad")
        if not bin_path.exists():
            raise RuntimeError("doomgeneric session binary not found at scripts/assets/doomgeneric_session_worker")

        self.proc = subprocess.Popen(
            [
                str(bin_path),
                "--iwad",
                str(iwad_path),
                "--out",
                str(out_png.with_suffix(".ppm")),
                "--ticks-per-cmd",
                os.getenv("DOOM_TICS_PER_COMMENT", "4"),
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        self.out_png = out_png
        self.ppm_path = out_png.with_suffix(".ppm")
        self._bootstrap()

    def _read_reply(self, timeout_ms: int | None = None) -> str:
        if not self.proc.stdout:
            raise RuntimeError("doomgeneric session process stdout unavailable")

        if timeout_ms is None or timeout_ms <= 0:
            reply = self.proc.stdout.readline()
            if not reply:
                err = self.proc.stderr.read() if self.proc.stderr else ""
                raise RuntimeError(f"doomgeneric session process ended unexpectedly: {err}")
            return reply.strip()

        selector = selectors.DefaultSelector()
        try:
            selector.register(self.proc.stdout, selectors.EVENT_READ)
            events = selector.select(timeout_ms / 1000)
            if not events:
                raise RuntimeError(f"doomgeneric session startup timeout after {timeout_ms}ms")
            reply = self.proc.stdout.readline()
        finally:
            selector.close()

        if not reply:
            err = self.proc.stderr.read() if self.proc.stderr else ""
            raise RuntimeError(f"doomgeneric session process ended unexpectedly: {err}")
        return reply.strip()

    def _bootstrap(self) -> None:
        if not self.proc.stdin:
            raise RuntimeError("doomgeneric session process stdin unavailable")

        timeout_ms = int(
            os.getenv(
                "DOOM_SESSION_WORKER_READY_TIMEOUT_MS",
                os.getenv(
                    "DOOM_SESSION_WORKER_STARTUP_TIMEOUT_MS",
                    os.getenv("DOOM_SESSION_WORKER_TIMEOUT_MS", "60000"),
                ),
            )
        )
        self.proc.stdin.write("SNAPSHOT\n")
        self.proc.stdin.flush()

        deadline = timeout_ms
        while deadline > 0:
            reply = self._read_reply(deadline)
            if reply == "READY":
                continue
            if reply.startswith("OK"):
                if self.ppm_path.exists():
                    image = Image.open(self.ppm_path)
                    save_output_image(image, self.out_png)
                return
            raise RuntimeError(f"doomgeneric session startup error: {reply}")

        raise RuntimeError(f"doomgeneric session startup timeout after {timeout_ms}ms")

    def _roundtrip(self, line: str) -> None:
        if not self.proc.stdin or not self.proc.stdout:
            raise RuntimeError("doomgeneric session process pipes unavailable")
        self.proc.stdin.write(line + "\n")
        self.proc.stdin.flush()
        reply = self._read_reply()
        while reply == "READY":
            reply = self._read_reply()
        if not reply.startswith("OK"):
            raise RuntimeError(f"doomgeneric session error: {reply}")

        if self.ppm_path.exists():
            image = Image.open(self.ppm_path)
            save_output_image(image, self.out_png)

    def step(self, commands: list[str]) -> None:
        if not commands:
            self.snapshot()
            return
        cmd = "STEP " + " ".join((c or "").strip().lower() for c in commands if c)
        self._roundtrip(cmd)

    def snapshot(self) -> None:
        self._roundtrip("SNAPSHOT")

    def shutdown(self) -> None:
        try:
            self._roundtrip("SHUTDOWN")
        except Exception:
            pass
        if self.proc.poll() is None:
            self.proc.terminate()


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: doom_session_worker.py <output_png> <seed>", file=sys.stderr)
        return 2

    out_png = Path(sys.argv[1])
    seed = int(sys.argv[2])
    worker = SessionWorker(out_png, seed)
    print("READY", flush=True)

    try:
        for raw in sys.stdin:
            text = raw.strip()
            if not text:
                continue
            req = json.loads(text)
            req_id = req.get("id")
            kind = req.get("type")

            try:
                if kind == "step":
                    commands = req.get("commands") or []
                    worker.step(commands)
                    resp = {"id": req_id, "ok": True}
                elif kind == "snapshot":
                    worker.snapshot()
                    resp = {"id": req_id, "ok": True}
                elif kind == "shutdown":
                    worker.shutdown()
                    resp = {"id": req_id, "ok": True}
                    print(json.dumps(resp), flush=True)
                    break
                else:
                    resp = {"id": req_id, "ok": False, "error": f"unknown_type:{kind}"}
            except Exception as exc:
                resp = {"id": req_id, "ok": False, "error": str(exc)}

            print(json.dumps(resp), flush=True)
    finally:
        try:
            worker.shutdown()
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
