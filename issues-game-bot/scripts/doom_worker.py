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


def save_output_gif(frames: list[Image.Image], out_gif: Path) -> None:
    if not frames:
        raise RuntimeError("No frames available for GIF output")

    scale = float(os.getenv("DOOM_FRAME_SCALE", "0.8"))
    scale = 1.0 if scale <= 0 else scale
    if scale != 1.0:
        resized: list[Image.Image] = []
        for frame in frames:
            w = max(1, int(frame.width * scale))
            h = max(1, int(frame.height * scale))
            resized.append(frame.resize((w, h), Image.Resampling.BILINEAR))
        frames = resized

    fps = int(os.getenv("DOOM_GIF_FPS", "12"))
    fps = 1 if fps < 1 else fps
    duration = int(1000 / fps)

    out_gif.parent.mkdir(parents=True, exist_ok=True)
    first, *rest = frames
    first.save(
        out_gif,
        format="GIF",
        save_all=True,
        append_images=rest,
        duration=duration,
        loop=0,
        optimize=True,
        disposal=2,
    )


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


def run_vizdoom(history: list[str], seed: int, out_path: Path, frame_mode: str) -> None:
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
    if frame_mode == "gif":
        gif_frames = int(os.getenv("DOOM_GIF_FRAMES", "10"))
        gif_frames = 2 if gif_frames < 2 else gif_frames
        blank_action = [0, 0, 0, 0, 0, 0]
        frames: list[Image.Image] = [image.copy()]
        for _ in range(gif_frames - 1):
            game.make_action(blank_action, 1)
            current = game.get_state().screen_buffer if game.get_state() else frame
            frames.append(Image.fromarray(current))
        save_output_gif(frames, out_path)
    else:
        save_output_image(image, out_path)
    game.close()


def run_doomgeneric(history: list[str], out_path: Path, frame_mode: str) -> None:
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
        if frame_mode == "gif":
            gif_frames = int(os.getenv("DOOM_GIF_FRAMES", "10"))
            gif_frames = 2 if gif_frames < 2 else gif_frames
            gif_stride = int(os.getenv("DOOM_GIF_STRIDE", "2"))
            gif_stride = 1 if gif_stride < 1 else gif_stride
            frame_prefix = tmp / "frame"
            cmd = [
                str(bin_path),
                "--commands", str(command_file),
                "--iwad", str(iwad_path),
                "--out-prefix", str(frame_prefix),
                "--capture-frames", str(gif_frames),
                "--capture-stride", str(gif_stride),
                "--ticks-per-cmd", ticks_per_cmd,
            ]
        else:
            cmd = [
                str(bin_path),
                "--commands", str(command_file),
                "--iwad", str(iwad_path),
                "--out", str(ppm_out),
                "--ticks-per-cmd", ticks_per_cmd,
            ]

        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=False,
        )

        if result.returncode != 0:
            raise RuntimeError(
                f"doomgeneric renderer failed ({result.returncode}): {result.stderr or result.stdout}"
            )

        if frame_mode == "gif":
            frame_files = sorted(tmp.glob("frame_*.ppm"))
            if not frame_files:
                raise RuntimeError("doomgeneric GIF renderer did not produce output frames")
            frames = [Image.open(p).copy() for p in frame_files]
            save_output_gif(frames, out_path)
        else:
            if not ppm_out.exists():
                raise RuntimeError("doomgeneric renderer did not produce output frame")
            image = Image.open(ppm_out)
            save_output_image(image, out_path)


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: doom_worker.py <session_json> <output_png>", file=sys.stderr)
        return 2

    session_json = Path(sys.argv[1])
    out_path = Path(sys.argv[2])

    state = json.loads(session_json.read_text(encoding="utf-8"))
    history = state.get("history", [])
    seed = int(state.get("seed", 1337))
    backend = os.getenv("DOOM_ENGINE", "doomgeneric").strip().lower()
    frame_mode = os.getenv("DOOM_FRAME_MODE", "png").strip().lower()
    frame_mode = "gif" if frame_mode == "gif" else "png"

    try:
        if backend == "doomgeneric":
            run_doomgeneric(history, out_path, frame_mode)
        else:
            run_vizdoom(history, seed, out_path, frame_mode)
    except Exception as exc:
        print(f"primary_backend_failed={backend}: {exc}", file=sys.stderr)
        if backend != "vizdoom":
            run_vizdoom(history, seed, out_path, frame_mode)
        else:
            raise

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
