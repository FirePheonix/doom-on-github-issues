#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import tempfile
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


def run_vizdoom(history: list[str], seed: int, out_png: Path) -> None:
    game = build_vizdoom_game(seed)
    max_steps = int(os.getenv("DOOM_TICS_PER_COMMENT", "5"))

    for cmd in history:
        action = action_for(cmd)
        game.make_action(action, max_steps)
        if game.is_episode_finished():
            game.new_episode()

    frame = game.get_state().screen_buffer if game.get_state() else None
    if frame is None:
        game.new_episode()
        frame = game.get_state().screen_buffer

    image = Image.fromarray(frame)
    out_png.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_png)
    game.close()


def run_doomgeneric(history: list[str], out_png: Path) -> None:
    assets_root = Path(__file__).resolve().parent / "assets"
    iwad_path = assets_root / "doom1.wad"
    bin_path = assets_root / "doomgeneric_issuebot"

    if not iwad_path.exists():
        raise RuntimeError("doomgeneric mode requires scripts/assets/doom1.wad")
    if not bin_path.exists():
        raise RuntimeError("doomgeneric binary not found at scripts/assets/doomgeneric_issuebot")

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp = Path(tmp_dir)
        command_file = tmp / "commands.txt"
        ppm_out = tmp / "frame.ppm"

        command_file.write_text("\n".join(history) + "\n", encoding="utf-8")

        ticks_per_cmd = os.getenv("DOOM_TICS_PER_COMMENT", "6")
        result = subprocess.run(
            [
                str(bin_path),
                "--commands", str(command_file),
                "--iwad", str(iwad_path),
                "--out", str(ppm_out),
                "--ticks-per-cmd", ticks_per_cmd,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"doomgeneric renderer failed ({result.returncode}): {result.stderr or result.stdout}"
            )

        if not ppm_out.exists():
            raise RuntimeError("doomgeneric renderer did not produce output frame")

        image = Image.open(ppm_out)
        out_png.parent.mkdir(parents=True, exist_ok=True)
        image.save(out_png)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: doom_worker.py <session_json> <output_png>", file=sys.stderr)
        return 2

    session_json = Path(sys.argv[1])
    out_png = Path(sys.argv[2])

    state = json.loads(session_json.read_text(encoding="utf-8"))
    history = state.get("history", [])
    seed = int(state.get("seed", 1337))
    backend = os.getenv("DOOM_ENGINE", "doomgeneric").strip().lower()

    try:
        if backend == "doomgeneric":
            run_doomgeneric(history, out_png)
        else:
            run_vizdoom(history, seed, out_png)
    except Exception as exc:
        print(f"primary_backend_failed={backend}: {exc}", file=sys.stderr)
        if backend != "vizdoom":
            run_vizdoom(history, seed, out_png)
        else:
            raise

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
