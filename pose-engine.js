/* ============================================================
   BHAAG — midnight arcade design system
   ink navy stage, cyan = you/tracking, amber = reward,
   coral = danger. Unbounded for loud moments, Space Grotesk for UI.
   ============================================================ */

:root {
  --ink: #0A0E1C;
  --panel: #131A30;
  --line: #223055;
  --cyan: #4EE1FF;
  --cyan-dim: rgba(78, 225, 255, 0.35);
  --amber: #FFC24B;
  --coral: #FF5C7A;
  --violet: #8E7BFF;
  --text: #F1F5FF;
  --dim: #8EA0C9;
  --display: "Unbounded", sans-serif;
  --body: "Space Grotesk", system-ui, sans-serif;
}

* { margin: 0; padding: 0; box-sizing: border-box; }

[hidden] { display: none !important; }

html, body {
  height: 100%;
  overflow: hidden;
  background: var(--ink);
  color: var(--text);
  font-family: var(--body);
  -webkit-font-smoothing: antialiased;
  touch-action: manipulation;
}

/* hidden camera element — MediaPipe reads it, user never sees it raw */
#cam {
  position: fixed;
  width: 2px; height: 2px;
  opacity: 0;
  pointer-events: none;
}

/* ---------- screens ---------- */
.screen {
  position: fixed;
  inset: 0;
  display: none;
  flex-direction: column;
}
.screen.active { display: flex; }

/* ---------- shared ---------- */
.eyebrow {
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--cyan);
  margin-bottom: 14px;
}

.btn-primary {
  font-family: var(--display);
  font-weight: 700;
  font-size: 16px;
  color: var(--ink);
  background: var(--cyan);
  border: none;
  border-radius: 999px;
  padding: 18px 44px;
  cursor: pointer;
  box-shadow: 0 0 32px var(--cyan-dim), 0 4px 0 rgba(0,0,0,0.35);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.btn-primary:active { transform: translateY(2px) scale(0.98); }
.btn-primary:focus-visible,
.btn-ghost:focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 3px;
}

.btn-ghost {
  font-family: var(--body);
  font-weight: 500;
  font-size: 15px;
  color: var(--text);
  background: transparent;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 14px 36px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}
.btn-ghost:active { border-color: var(--cyan); }
.btn-ghost.subtle { border: none; color: var(--dim); font-size: 13px; padding: 10px; }

.error {
  color: var(--coral);
  font-size: 14px;
  margin-top: 16px;
  max-width: 320px;
}

/* ============================================================
   HOME
   ============================================================ */
#screen-home {
  align-items: center;
  justify-content: center;
  text-align: center;
  background:
    radial-gradient(ellipse 80% 50% at 50% -10%, rgba(78,225,255,0.10), transparent),
    radial-gradient(ellipse 60% 40% at 50% 115%, rgba(142,123,255,0.10), transparent),
    var(--ink);
}

.home-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  max-width: 480px;
}

.wordmark {
  font-family: var(--display);
  font-weight: 900;
  font-size: clamp(52px, 16vw, 88px);
  line-height: 0.95;
  letter-spacing: -0.01em;
  color: var(--text);
  text-shadow: 0 0 48px var(--cyan-dim);
}
.wordmark-dot { color: var(--cyan); }

.tagline {
  color: var(--dim);
  font-size: 16px;
  line-height: 1.5;
  margin: 18px 0 34px;
  max-width: 300px;
}

.gesture-row {
  display: flex;
  gap: 14px;
  margin-bottom: 38px;
}
.gesture {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px 14px 12px;
  width: 104px;
}
.gesture svg { width: 44px; height: 44px; }
.gesture .glyph { stroke: var(--cyan); stroke-width: 2.4; stroke-linecap: round; fill: none; }
.gesture .glyph circle { fill: var(--cyan); stroke: none; }
.gesture span {
  font-size: 11.5px;
  line-height: 1.35;
  color: var(--dim);
  text-align: center;
}

.hint {
  margin-top: 18px;
  font-size: 12.5px;
  color: var(--dim);
  max-width: 280px;
  line-height: 1.5;
}

.home-foot {
  position: absolute;
  bottom: 14px;
  left: 0; right: 0;
  text-align: center;
  font-size: 11px;
  color: rgba(142, 160, 201, 0.55);
}

/* ============================================================
   CALIBRATION — the Kinect moment
   ============================================================ */
#screen-calibrate { background: #000; }

.cal-stage {
  position: relative;
  flex: 1;
}

#cal-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.cal-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: max(20px, env(safe-area-inset-top)) 20px max(28px, env(safe-area-inset-bottom));
  pointer-events: none;
}

.cal-top { text-align: center; }
.cal-instruction {
  font-family: var(--display);
  font-weight: 700;
  font-size: clamp(17px, 5vw, 24px);
  text-shadow: 0 2px 16px rgba(0,0,0,0.8);
}
.cal-substep {
  margin-top: 8px;
  font-size: 14px;
  color: var(--dim);
  text-shadow: 0 2px 12px rgba(0,0,0,0.8);
}

.cal-progress-wrap {
  height: 6px;
  background: rgba(255,255,255,0.12);
  border-radius: 999px;
  overflow: hidden;
  max-width: 320px;
  width: 100%;
  margin: 0 auto;
}
.cal-progress {
  height: 100%;
  width: 0%;
  background: var(--cyan);
  border-radius: 999px;
  box-shadow: 0 0 14px var(--cyan);
  transition: width 0.1s linear;
}

.cal-countdown {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-weight: 900;
  font-size: clamp(96px, 34vw, 200px);
  color: var(--cyan);
  text-shadow: 0 0 64px var(--cyan-dim);
  background: rgba(10, 14, 28, 0.45);
}

/* ============================================================
   GAME
   ============================================================ */
#screen-game { background: var(--ink); }

#game-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hud {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  left: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}
.hud-score {
  display: flex;
  flex-direction: column;
}
.hud-label {
  font-size: 10px;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--dim);
}
#hud-score {
  font-family: var(--display);
  font-weight: 700;
  font-size: 30px;
  color: var(--text);
  text-shadow: 0 0 24px rgba(78,225,255,0.25);
}
.hud-coins {
  display: flex;
  align-items: center;
  gap: 7px;
  font-weight: 700;
  font-size: 17px;
  color: var(--amber);
}
.coin-dot {
  width: 13px; height: 13px;
  border-radius: 50%;
  background: var(--amber);
  box-shadow: 0 0 10px rgba(255,194,75,0.7);
}

.pip {
  position: absolute;
  top: max(14px, env(safe-area-inset-top));
  right: 14px;
  width: 84px;
  height: 116px;
  border-radius: 14px;
  border: 1px solid var(--line);
  background: rgba(10, 14, 28, 0.6);
  backdrop-filter: blur(4px);
}

.stance-bar {
  position: absolute;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 50%;
  transform: translateX(-50%);
  width: min(72vw, 340px);
  height: 12px;
  display: flex;
  gap: 5px;
  pointer-events: none;
}
.stance-lane {
  flex: 1;
  border-radius: 999px;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.08);
  transition: background 0.12s ease, box-shadow 0.12s ease;
}
.stance-lane.on {
  background: var(--cyan-dim);
  box-shadow: 0 0 14px var(--cyan-dim);
}
.stance-marker {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 16px var(--cyan);
  transform: translate(-50%, -50%);
  transition: left 0.08s linear;
}

.tracking-lost {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(10, 14, 28, 0.72);
  backdrop-filter: blur(3px);
}
.tracking-lost-card { text-align: center; }
.tl-title {
  font-family: var(--display);
  font-weight: 700;
  font-size: 24px;
}
.tl-sub { margin-top: 8px; color: var(--dim); font-size: 15px; }

.go-flash {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--display);
  font-weight: 900;
  font-size: clamp(72px, 26vw, 160px);
  color: var(--amber);
  text-shadow: 0 0 56px rgba(255,194,75,0.5);
  pointer-events: none;
  animation: goPop 0.7s ease forwards;
}
@keyframes goPop {
  0% { transform: scale(0.6); opacity: 0; }
  25% { transform: scale(1.05); opacity: 1; }
  70% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1.15); opacity: 0; }
}

/* ============================================================
   GAME OVER
   ============================================================ */
#screen-over {
  align-items: center;
  justify-content: center;
  text-align: center;
  background:
    radial-gradient(ellipse 70% 45% at 50% 0%, rgba(255,92,122,0.10), transparent),
    var(--ink);
}
.over-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
}
.over-score-label {
  font-size: 11px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--dim);
  margin-top: 6px;
}
.over-score {
  font-family: var(--display);
  font-weight: 900;
  font-size: clamp(64px, 20vw, 110px);
  line-height: 1;
  margin: 6px 0 26px;
  text-shadow: 0 0 48px var(--cyan-dim);
}
.over-stats {
  display: flex;
  gap: 34px;
  margin-bottom: 30px;
}
.over-stats div { display: flex; flex-direction: column; gap: 3px; }
.over-stats span { font-weight: 700; font-size: 22px; }
.over-stats label {
  font-size: 10.5px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--dim);
}
.new-best {
  color: var(--amber);
  font-weight: 700;
  margin-bottom: 22px;
}
.over-inner .btn-primary { margin-bottom: 14px; }
.over-inner .btn-ghost { margin-bottom: 8px; }

/* ---------- accessibility ---------- */
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }
}
