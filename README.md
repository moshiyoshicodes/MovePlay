# MovePlay

Your phone's camera is the controller. No app install, no hardware — just a browser link.

MovePlay is a motion-sensing game platform that uses MediaPipe pose tracking to turn physical movement (lean, jump, squat) into game input. Point your phone at yourself, prop it up, and play with your body. Optionally cast to a TV for the full experience.

**Game #1 — Bhaag** · three-lane endless runner. Lean to switch lanes, jump to clear hurdles, squat to slide under bars.

---

## Running locally

Requires HTTPS or localhost (browsers block camera on plain HTTP).

```bash
npx serve .
```

Then open `http://localhost:3000` in Chrome or Safari.

To test on a phone from the same Wi-Fi network:

```bash
npx serve . --listen 0.0.0.0
```

Open the LAN address shown in the terminal on your phone (e.g. `http://192.168.x.x:3000`). Note: camera will only work on `localhost` — for phone testing use `npx serve` with `--ssl` or deploy to GitHub Pages.

---

## Deploying to GitHub Pages

Push the repo root as-is to `gh-pages` (or configure Pages to serve from `main`). No build step needed — everything is plain ES modules and static files.

---

## Architecture

```
index.html          single-page shell, four screens
style.css           midnight-arcade design system (CSS variables at top)
main.js             screen state machine: home → calibrate → game → over
pose-engine.js      MediaPipe wrapper — the platform layer (don't modify)
calibration.js      guided standing-pose calibration
game.js             game #1: Bhaag endless runner
```

`pose-engine.js` is the console; games are cartridges. Games listen to events (`lane`, `jump`, `squat`, `tracking`, `pose`) and never touch MediaPipe directly.

---

## Browser support

| Browser | Status |
|---------|--------|
| Chrome Android | ✅ |
| Safari iOS 16+ | ✅ |
| Chrome desktop | ✅ |
| Firefox | ⚠️ GPU delegate may fall back to CPU |

---

## Constraints

- No build step, no bundler, no npm dependencies
- No backend — `localStorage` only (`moveplay_best`)
- `<video id="cam">` must stay in the DOM and rendered (never `display:none`) — MediaPipe requires it
- Gesture thresholds in `pose-engine.js` (`TUNE` object) are hand-tuned — don't change them without gameplay testing
