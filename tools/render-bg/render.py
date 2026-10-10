"""Render the seamless background loop used by the panel.

Frames come from tools/render-bg/page.html, where every moving term completes a
whole number of cycles over DURATION seconds, so the last frame meets the first
one with no visible seam. Encoding uses the static ffmpeg that ships with the
ffmpeg-static npm package (see package.json in this folder).

    python render.py            # -> panel/public/bg/aurora.mp4 + aurora.webm + poster.jpg
"""
import pathlib
import shutil
import subprocess
import sys

from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
PANEL_PUBLIC = HERE.parent.parent / "panel" / "public" / "bg"
FRAMES = HERE / ".frames"

FPS = 30
DURATION = 8          # seconds
WIDTH, HEIGHT = 1280, 720
FRAME_COUNT = FPS * DURATION


def ffmpeg() -> str:
    """Locate ffmpeg: ffmpeg-static from npm, else PATH."""
    cand = HERE / "node_modules" / "ffmpeg-static" / "ffmpeg.exe"
    if cand.exists():
        return str(cand)
    found = shutil.which("ffmpeg")
    if found:
        return found
    sys.exit("ffmpeg not found — run `npm install` in tools/render-bg first")


def render_frames() -> None:
    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": WIDTH, "height": HEIGHT}, device_scale_factor=1)
        page.goto((HERE / "page.html").as_uri())
        page.wait_for_function("window.READY === true")
        canvas = page.query_selector("#c")
        for i in range(FRAME_COUNT):
            page.evaluate("t => window.frame(t)", i / FPS)
            canvas.screenshot(path=str(FRAMES / f"f{i:04d}.png"))
        browser.close()
    print(f"rendered {FRAME_COUNT} frames -> {FRAMES}")


def encode() -> None:
    PANEL_PUBLIC.mkdir(parents=True, exist_ok=True)
    exe = ffmpeg()
    common = ["-framerate", str(FPS), "-i", str(FRAMES / "f%04d.png"), "-an"]
    mp4 = PANEL_PUBLIC / "aurora.mp4"
    webm = PANEL_PUBLIC / "aurora.webm"
    poster = PANEL_PUBLIC / "poster.jpg"

    subprocess.run([exe, "-i", str(FRAMES / "f0000.png"), "-q:v", "6", "-y", str(poster)], check=True)

    # H.264 is the primary format: every Chromium/Electron build plays it.
    subprocess.run([exe, *common, "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
                    "-crf", "30", "-preset", "slow", "-movflags", "+faststart", "-y", str(mp4)], check=True)

    # Optional WebM/VP9 — skipped gracefully if this ffmpeg build cannot encode it.
    try:
        subprocess.run([exe, *common, "-c:v", "libvpx-vp9", "-crf", "40", "-b:v", "0", "-row-mt", "1",
                        "-y", str(webm)], check=True, capture_output=True)
    except subprocess.CalledProcessError as err:
        print(f"webm skipped (ffmpeg vp9 unavailable: rc={err.returncode})")
        webm.unlink(missing_ok=True)

    for f in (mp4, webm, poster):
        if f.exists():
            print(f"{f.name}: {f.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    render_frames()
    encode()
    shutil.rmtree(FRAMES, ignore_errors=True)
