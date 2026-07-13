/* ============================================================
   calibration.js — the Kinect moment.
   Shows the mirrored camera with a glowing skeleton, guides the
   player into frame, waits for 1.5s of stillness, captures the
   standing baseline, counts down, resolves.
   ============================================================ */

import { drawSkeleton } from "./pose-engine.js";

const HOLD_MS = 1500;      // stillness required to lock baseline
const STILL_EPS = 0.012;   // max hip movement (normalised) to count as still

export function runCalibration(engine, video) {
  const canvas = document.getElementById("cal-canvas");
  const ctx = canvas.getContext("2d");
  const instruction = document.getElementById("cal-instruction");
  const substep = document.getElementById("cal-substep");
  const progress = document.getElementById("cal-progress");
  const countdownEl = document.getElementById("cal-countdown");

  let holdStart = null;
  let hipHistory = [];
  let raf = null;
  let done = false;

  function setStep(main, sub) {
    if (instruction.textContent !== main) instruction.textContent = main;
    if (substep.textContent !== sub) substep.textContent = sub;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  }
  resize();
  window.addEventListener("resize", resize);

  return new Promise((resolve) => {
    function frame() {
      if (done) return;
      raf = requestAnimationFrame(frame);

      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // mirrored camera feed, cover-fit
      if (video.readyState >= 2) {
        const vw = video.videoWidth, vh = video.videoHeight;
        const scale = Math.max(w / vw, h / vh);
        const dw = vw * scale, dh = vh * scale;
        ctx.save();
        ctx.translate(w, 0);
        ctx.scale(-1, 1);
        ctx.filter = "brightness(0.65) saturate(0.85)";
        ctx.drawImage(video, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.restore();
        ctx.filter = "none";
      }

      // silhouette guide zone (centre column)
      ctx.save();
      ctx.strokeStyle = "rgba(78,225,255,0.35)";
      ctx.setLineDash([10, 10]);
      ctx.lineWidth = 2;
      const zx = w * 0.22, zw = w * 0.56, zy = h * 0.08, zh = h * 0.86;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(zx, zy, zw, zh, 24);
      else ctx.rect(zx, zy, zw, zh);
      ctx.stroke();
      ctx.restore();

      // skeleton overlay (landmarks are already mirrored by the engine)
      drawSkeleton(ctx, engine.smoothed, w, h);

      // ---- state machine ----
      if (!engine.tracking) {
        setStep("Step back so I can see you", "Prop the phone at waist height, 6–8 feet away");
        resetHold();
      } else if (!engine.fullBodyVisible()) {
        setStep("Almost — show your whole body", "Head to feet should fit in the frame");
        resetHold();
      } else {
        // stillness check on hips
        const hip = engine.metrics?.hipMid;
        if (hip) {
          hipHistory.push({ ...hip, t: performance.now() });
          hipHistory = hipHistory.filter((p) => performance.now() - p.t < 400);
          const still = hipHistory.every(
            (p) =>
              Math.abs(p.x - hip.x) < STILL_EPS &&
              Math.abs(p.y - hip.y) < STILL_EPS
          );

          if (still) {
            if (!holdStart) holdStart = performance.now();
            const pct = Math.min(1, (performance.now() - holdStart) / HOLD_MS);
            progress.style.width = `${pct * 100}%`;
            setStep("Perfect — hold still", "Locking in your standing pose…");
            if (pct >= 1) {
              engine.captureBaseline();
              finish();
              return;
            }
          } else {
            setStep("Stand relaxed, feet under shoulders", "Hold still for a moment");
            resetHold();
          }
        }
      }
    }

    function resetHold() {
      holdStart = null;
      progress.style.width = "0%";
    }

    async function finish() {
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      countdownEl.hidden = false;
      for (const n of ["3", "2", "1"]) {
        countdownEl.textContent = n;
        await sleep(700);
      }
      countdownEl.hidden = true;
      resolve();
    }

    frame();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
