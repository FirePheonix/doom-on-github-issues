#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

from PIL import Image
from vizdoom import (
    Button,
    DoomGame,
    Mode,
    GameVariable,
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


def build_game(seed: int) -> DoomGame:
    game = DoomGame()

    assets_root = Path(__file__).resolve().parent / "assets"
    iwad_path = assets_root / "doom1.wad"

    if not iwad_path.exists():
        raise RuntimeError(
            "Missing doom1.wad. Run scripts/fetch_doom_assets.py first."
        )

    game.add_game_args(f"-iwad {iwad_path}")
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


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: doom_worker.py <session_json> <output_png>", file=sys.stderr)
        return 2

    session_json = Path(sys.argv[1])
    out_png = Path(sys.argv[2])

    state = json.loads(session_json.read_text(encoding="utf-8"))
    history = state.get("history", [])
    seed = int(state.get("seed", 1337))

    game = build_game(seed)

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
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
