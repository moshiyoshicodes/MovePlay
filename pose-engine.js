/* ============================================================
   pose-engine.js — the platform.
   Wraps MediaPipe PoseLandmarker and turns raw landmarks into
   clean, calibrated game events. Games never touch MediaPipe
   directly — they subscribe to this.

   Events dispatched:
     'pose'      { landmarks, metrics, lean, lane, squatting, tracking }
     'lane'      { lane }            -1 | 0 | 1
     'jump'      {}
     'squat'     { active }
     'tracking'  { ok }
   ============================================================ */

import {
  PoseLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

export const LM = {
  NOSE: 0,
  L_SHOULDER: 11, R_SHOULDER: 12,
  L_ELBOW: 13, R_ELBOW: 14,
  L_WRIST: 15, R_WRIST: 16,
  L_HIP: 23, R_HIP: 24,
  L_KNEE: 25, R_KNEE: 26,
  L_ANKLE: 27, R_ANKLE: 28,
};

// skeleton connections for drawing overlays
export const BONES = [
  [LM.L_SHOULDER, LM.R_SHOULDER],
  [LM.L_SHOULDER, LM.L_ELBOW], [LM.L_ELBOW, LM.L_WRIST],
  [LM.R_SHOULDER, LM.R_ELBOW], [LM.R_ELBOW, LM.R_WRIST],
  [LM.L_SHOULDER, LM.L_HIP], [LM.R_SHOULDER, LM.R_HIP],
  [LM.L_HIP, LM.R_HIP],
  [LM.L_HIP, LM.L_KNEE], [LM.L_KNEE, LM.L_ANKLE],
  [LM.R_HIP, LM.R_KNEE], [LM.R_KNEE, LM.R_ANKLE],
];

// ---- tuning (all in "body units" so it works at any distance) ----
const TUNE = {
  smoothing: 0.45,        // EMA alpha: higher = snappier, noisier
  laneEnter: 0.55,        // lean (in shoulder-widths) to enter a side lane
  laneExit: 0.30,         // lean to fall back to centre (hysteresis)
  jumpRise: 0.30,         // hip rise (in torso-lengths) that counts as a jump
  jumpCooldownMs: 600,
  squatDrop: 0.26,        // hip drop (torso-lengths) that counts as a squat
  squatRelease: 0.16,
  minVisibility: 0.5,
};

export class PoseEngine extends EventTarget {
  constructor(videoEl) {
    super();
    this.video = videoEl;
    this.landmarker = null;
    this.running = false;

    this.smoothed = null;     // EMA-smoothed landmarks (mirrored)
    this.metrics = null;      // derived body metrics for this frame
    this.baseline = null;     // captured at calibration

    this.tracking = false;
    this.lane = 0;
    this.lean = 0;
    this.squatting = false;
    this._lastJumpAt = 0;
    this._lastVideoTime = -1;
  }

  async init() {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    this.landmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._loop();
  }

  stop() {
    this.running = false;
  }

  _loop() {
    if (!this.running) return;
    const v = this.video;
    if (v.readyState >= 2 && v.currentTime !== this._lastVideoTime) {
      this._lastVideoTime = v.currentTime;
      const now = performance.now();
      let result = null;
      try {
        result = this.landmarker.detectForVideo(v, now);
      } catch (_) {
        /* a dropped frame is fine — just try the next one */
      }
      if (result) this._process(result, now);
    }
    requestAnimationFrame(() => this._loop());
  }

  _process(result, now) {
    const raw = result.landmarks && result.landmarks[0];
    if (!raw) {
      this._setTracking(false);
      this._emitPose();
      return;
    }

    // mirror x so the player's left is the game's left
    const pts = raw.map((p) => ({
      x: 1 - p.x,
      y: p.y,
      v: p.visibility ?? 1,
    }));

    if (!this.smoothed) {
      this.smoothed = pts.map((p) => ({ ...p }));
    } else {
      const a = TUNE.smoothing;
      for (let i = 0; i < pts.length; i++) {
        const s = this.smoothed[i];
        s.x += a * (pts[i].x - s.x);
        s.y += a * (pts[i].y - s.y);
        s.v = pts[i].v;
      }
    }

    const s = this.smoothed;
    const vis = (i) => s[i].v > TUNE.minVisibility;
    const core =
      vis(LM.L_SHOULDER) && vis(LM.R_SHOULDER) &&
      vis(LM.L_HIP) && vis(LM.R_HIP);

    this._setTracking(core);
    if (!core) {
      this._emitPose();
      return;
    }

    const shoulderMid = mid(s[LM.L_SHOULDER], s[LM.R_SHOULDER]);
    const hipMid = mid(s[LM.L_HIP], s[LM.R_HIP]);
    this.metrics = {
      shoulderMid,
      hipMid,
      shoulderW: Math.abs(s[LM.L_SHOULDER].x - s[LM.R_SHOULDER].x),
      torso: Math.max(0.02, Math.abs(hipMid.y - shoulderMid.y)),
    };

    if (this.baseline) this._detectGestures(now);
    this._emitPose();
  }

  _detectGestures(now) {
    const b = this.baseline;
    const m = this.metrics;

    // ---- lean → lane (hysteresis so it doesn't flicker) ----
    const bodyX = m.hipMid.x * 0.6 + m.shoulderMid.x * 0.4;
    this.lean = (bodyX - b.centerX) / b.shoulderW; // in shoulder-widths

    let lane = this.lane;
    if (lane === 0) {
      if (this.lean > TUNE.laneEnter) lane = 1;
      else if (this.lean < -TUNE.laneEnter) lane = -1;
    } else if (Math.abs(this.lean) < TUNE.laneExit) {
      lane = 0;
    } else if (lane === 1 && this.lean < -TUNE.laneEnter) {
      lane = -1; // fast cross from right to left
    } else if (lane === -1 && this.lean > TUNE.laneEnter) {
      lane = 1;
    }
    if (lane !== this.lane) {
      this.lane = lane;
      this.dispatchEvent(new CustomEvent("lane", { detail: { lane } }));
    }

    // ---- jump: hips rise sharply above standing baseline ----
    const rise = b.hipY - m.hipMid.y;
    if (
      rise > TUNE.jumpRise * b.torso &&
      now - this._lastJumpAt > TUNE.jumpCooldownMs
    ) {
      this._lastJumpAt = now;
      this.dispatchEvent(new CustomEvent("jump"));
    }

    // ---- squat: hips drop below baseline, held state ----
    const drop = m.hipMid.y - b.hipY;
    if (!this.squatting && drop > TUNE.squatDrop * b.torso) {
      this.squatting = true;
      this.dispatchEvent(new CustomEvent("squat", { detail: { active: true } }));
    } else if (this.squatting && drop < TUNE.squatRelease * b.torso) {
      this.squatting = false;
      this.dispatchEvent(new CustomEvent("squat", { detail: { active: false } }));
    }
  }

  _setTracking(ok) {
    if (ok !== this.tracking) {
      this.tracking = ok;
      this.dispatchEvent(new CustomEvent("tracking", { detail: { ok } }));
    }
  }

  _emitPose() {
    this.dispatchEvent(
      new CustomEvent("pose", {
        detail: {
          landmarks: this.smoothed,
          metrics: this.metrics,
          lean: this.lean,
          lane: this.lane,
          squatting: this.squatting,
          tracking: this.tracking,
        },
      })
    );
  }

  /** Is the whole body (head to ankles) confidently visible right now? */
  fullBodyVisible() {
    const s = this.smoothed;
    if (!s) return false;
    const need = [
      LM.NOSE, LM.L_SHOULDER, LM.R_SHOULDER,
      LM.L_HIP, LM.R_HIP, LM.L_ANKLE, LM.R_ANKLE,
    ];
    return need.every((i) => s[i].v > TUNE.minVisibility);
  }

  /** Capture the player's standing pose as the reference for all gestures. */
  captureBaseline() {
    if (!this.metrics) return false;
    const m = this.metrics;
    this.baseline = {
      centerX: m.hipMid.x * 0.6 + m.shoulderMid.x * 0.4,
      hipY: m.hipMid.y,
      torso: m.torso,
      shoulderW: Math.max(0.04, m.shoulderW),
    };
    this.lane = 0;
    this.squatting = false;
    return true;
  }
}

function mid(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Draw a glowing skeleton onto a canvas ctx. Shared by calibration + pip. */
export function drawSkeleton(ctx, landmarks, w, h, color = "#4EE1FF") {
  if (!landmarks) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, w * 0.012);
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;

  for (const [a, b] of BONES) {
    const pa = landmarks[a], pb = landmarks[b];
    if (pa.v < 0.5 || pb.v < 0.5) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }
  // head
  const nose = landmarks[LM.NOSE];
  if (nose.v > 0.5) {
    ctx.beginPath();
    ctx.arc(nose.x * w, nose.y * h, Math.max(4, w * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
