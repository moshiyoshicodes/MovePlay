/* ============================================================
   main.js — orchestration.
   Screen state machine: home → calibrate → game → over.
   Owns the camera, wires PoseEngine to the Game, drives HUD,
   stance bar, skeleton pip, tracking-lost pause, share flow.
   ============================================================ */

import { PoseEngine, drawSkeleton } from "./pose-engine.js";
import { runCalibration } from "./calibration.js";
import { Game } from "./game.js";

const $ = (id) => document.getElementById(id);
const screens = {
  home: $("screen-home"),
  calibrate: $("screen-calibrate"),
  game: $("screen-game"),
  over: $("screen-over"),
};

const video = $("cam");
let engine = null;
let game = null;
let wakeLock = null;

function show(name) {
  for (const s of Object.values(screens)) s.classList.remove("active");
  screens[name].classList.add("active");
}

// ---------------- camera + engine boot ----------------
async function boot() {
  const btn = $("btn-start");
  btn.disabled = true;
  btn.textContent = "Waking up the camera…";
  $("home-error").hidden = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    video.srcObject = stream;
    await video.play();
  } catch (err) {
    fail(
      err && err.name === "NotAllowedError"
        ? "Camera permission was blocked. Allow camera access in your browser settings and try again."
        : "Couldn't start the camera. Make sure you're on HTTPS and no other app is using it."
    );
    return;
  }

  try {
    btn.textContent = "Loading motion tracking…";
    engine = new PoseEngine(video);
    await engine.init();
    engine.start();
  } catch (err) {
    fail("Motion tracking failed to load. Check your connection and refresh.");
    return;
  }

  requestWakeLock();
  btn.disabled = false;
  btn.textContent = "Start camera";
  startCalibration();

  function fail(msg) {
    const el = $("home-error");
    el.textContent = msg;
    el.hidden = false;
    btn.disabled = false;
    btn.textContent = "Try again";
  }
}

async function requestWakeLock() {
  try {
    if ("wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
    }
  } catch (_) { /* non-fatal */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && engine) requestWakeLock();
});

// ---------------- calibration ----------------
async function startCalibration() {
  show("calibrate");
  await runCalibration(engine, video);
  startGame();
}

// ---------------- game ----------------
const pipCanvas = $("pip-canvas");
const pipCtx = pipCanvas.getContext("2d");
const stanceMarker = $("stance-marker");
const stanceLanes = [...document.querySelectorAll(".stance-lane")];
let poseListener = null;
let trackingListener = null;
let trackingOkSince = 0;

function startGame() {
  show("game");
  $("go-flash").hidden = false;
  setTimeout(() => { $("go-flash").hidden = true; }, 750);

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  pipCanvas.width = pipCanvas.clientWidth * dpr;
  pipCanvas.height = pipCanvas.clientHeight * dpr;

  game = new Game($("game-canvas"), engine);

  game.addEventListener("score", (e) => {
    $("hud-score").textContent = e.detail.score.toLocaleString("en-IN");
    $("hud-coins").textContent = e.detail.coins;
  });

  game.addEventListener("gameover", (e) => endGame(e.detail));

  // live body feedback: pip skeleton + stance bar
  poseListener = (e) => {
    const d = e.detail;
    pipCtx.clearRect(0, 0, pipCanvas.width, pipCanvas.height);
    drawSkeleton(pipCtx, d.landmarks, pipCanvas.width, pipCanvas.height);

    stanceLanes.forEach((el) =>
      el.classList.toggle("on", Number(el.dataset.lane) === d.lane)
    );
    const pct = 50 + Math.max(-1.2, Math.min(1.2, d.lean)) * 38;
    stanceMarker.style.left = `${pct}%`;
  };
  engine.addEventListener("pose", poseListener);

  // pause when the player leaves frame, resume after 800ms stable
  trackingListener = (e) => {
    if (!game) return;
    if (!e.detail.ok) {
      game.setPaused(true);
      $("tracking-lost").hidden = false;
      trackingOkSince = 0;
    } else {
      trackingOkSince = performance.now();
      setTimeout(() => {
        if (
          trackingOkSince &&
          performance.now() - trackingOkSince >= 780 &&
          engine.tracking && game
        ) {
          $("tracking-lost").hidden = true;
          game.setPaused(false);
        }
      }, 800);
    }
  };
  engine.addEventListener("tracking", trackingListener);

  game.start();
}

// ---------------- game over ----------------
function endGame({ score, coins, distance }) {
  cleanupGame();

  const best = Number(localStorage.getItem("bhaag_best") || 0);
  const isBest = score > best;
  if (isBest) localStorage.setItem("bhaag_best", String(score));

  $("over-score").textContent = score.toLocaleString("en-IN");
  $("over-coins").textContent = coins;
  $("over-dist").textContent = `${distance}m`;
  $("over-best").textContent = Math.max(best, score).toLocaleString("en-IN");
  $("new-best").hidden = !isBest;
  show("over");
}

function cleanupGame() {
  if (game) { game.stop(); game = null; }
  if (poseListener) engine.removeEventListener("pose", poseListener);
  if (trackingListener) engine.removeEventListener("tracking", trackingListener);
  $("tracking-lost").hidden = true;
}

// ---------------- buttons ----------------
$("btn-start").addEventListener("click", boot);

$("btn-again").addEventListener("click", () => {
  // re-calibrate quickly? No — baseline still valid, straight back in.
  startGame();
});

$("btn-home").addEventListener("click", () => {
  cleanupGame();
  show("home");
});

$("btn-share").addEventListener("click", async () => {
  const score = $("over-score").textContent;
  const text = `I scored ${score} in BHAAG — a game you play with your body, no controller. Beat me:`;
  const url = location.href;
  if (navigator.share) {
    try { await navigator.share({ title: "BHAAG", text, url }); } catch (_) {}
  } else {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      $("btn-share").textContent = "Link copied!";
      setTimeout(() => { $("btn-share").textContent = "Challenge a friend"; }, 1600);
    } catch (_) {}
  }
});
