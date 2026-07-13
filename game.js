/* ============================================================
   game.js — the first game on the platform.
   A pseudo-3D three-lane endless runner. Consumes gesture events
   from PoseEngine; never touches MediaPipe. Render loop runs at
   display rate regardless of inference rate.

   Events dispatched:
     'score'    { score, coins }
     'gameover' { score, coins, distance }
   ============================================================ */

const Z_MAX = 60;            // spawn distance in track units
const COLORS = {
  block: "#FF5C7A",          // full-height → change lane
  hurdle: "#FFC24B",         // low → jump over
  bar: "#8E7BFF",            // head-height → squat under
  coin: "#FFC24B",
  lane: "rgba(78,225,255,0.22)",
  laneEdge: "rgba(78,225,255,0.45)",
};

export class Game extends EventTarget {
  constructor(canvas, engine) {
    super();
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.engine = engine;

    this._onLane = null;
    this._onJump = null;
    this._onSquat = null;

    this._resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = canvas.clientWidth * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
  }

  start() {
    this._resize();
    window.addEventListener("resize", this._resize);

    // ---- state ----
    this.running = true;
    this.paused = false;
    this.dead = false;
    this.t = 0;                  // run time (s)
    this.distance = 0;           // track units travelled
    this.speed = 16;             // units/s, ramps up
    this.score = 0;
    this.coins = 0;

    this.lane = 0;               // committed lane (from engine)
    this.playerX = 0;            // eased visual lane position
    this.jumpT = -1;             // -1 idle, else 0..1 through jump arc
    this.squat = this.engine.squatting;

    this.obstacles = [];
    this.coinItems = [];
    this.nextSpawnZ = 24;        // distance of first pattern
    this.flashT = 0;             // red flash on death

    // ---- listen to the body ----
    this._onLane = (e) => { this.lane = e.detail.lane; };
    this._onJump = () => {
      if (this.jumpT < 0 && !this.dead) this.jumpT = 0;
    };
    this._onSquat = (e) => { this.squat = e.detail.active; };
    this.engine.addEventListener("lane", this._onLane);
    this.engine.addEventListener("jump", this._onJump);
    this.engine.addEventListener("squat", this._onSquat);
    this.lane = this.engine.lane;

    this._last = performance.now();
    this._loop();
  }

  stop() {
    this.running = false;
    window.removeEventListener("resize", this._resize);
    this.engine.removeEventListener("lane", this._onLane);
    this.engine.removeEventListener("jump", this._onJump);
    this.engine.removeEventListener("squat", this._onSquat);
  }

  setPaused(p) { this.paused = p; this._last = performance.now(); }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const now = performance.now();
    let dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    if (this.paused) dt = 0;

    if (!this.dead && dt > 0) this._update(dt);
    if (this.dead) this.flashT = Math.max(0, this.flashT - dt * 2);
    this._render();
  }

  // ============================ update ============================
  _update(dt) {
    this.t += dt;
    this.speed = Math.min(38, 16 + this.t * 0.55);
    const dz = this.speed * dt;
    this.distance += dz;
    this.score += dz * 10;

    // ease player x toward committed lane
    this.playerX += (this.lane - this.playerX) * Math.min(1, dt * 10);

    // jump arc (~0.62s in the air)
    if (this.jumpT >= 0) {
      this.jumpT += dt / 0.62;
      if (this.jumpT >= 1) this.jumpT = -1;
    }

    // advance world
    for (const o of this.obstacles) o.z -= dz;
    for (const c of this.coinItems) c.z -= dz;

    // collisions & collection in the player window
    for (const o of this.obstacles) {
      if (o.hitChecked || o.z > 1.6 || o.z < -1.6) continue;
      o.hitChecked = true;
      if (Math.round(this.playerX) !== o.lane) continue;
      const airborne = this.jumpT >= 0.15 && this.jumpT <= 0.85;
      if (o.type === "hurdle" && airborne) continue;
      if (o.type === "bar" && this.squat) continue;
      if (o.type === "block" && Math.abs(this.playerX - o.lane) > 0.55) continue;
      this._die();
      return;
    }
    for (const c of this.coinItems) {
      if (c.taken || c.z > 1.4 || c.z < -1.4) continue;
      if (Math.round(this.playerX) === c.lane) {
        c.taken = true;
        this.coins += 1;
        this.score += 25;
      }
    }

    this.obstacles = this.obstacles.filter((o) => o.z > -3);
    this.coinItems = this.coinItems.filter((c) => c.z > -3 && !c.taken);

    // spawn patterns ahead
    while (this.nextSpawnZ - this.distance < Z_MAX) {
      this._spawnPattern(this.nextSpawnZ - this.distance);
      const gap = Math.max(9, 15 - this.t * 0.14);
      this.nextSpawnZ += gap;
    }

    this.dispatchEvent(new CustomEvent("score", {
      detail: { score: Math.floor(this.score), coins: this.coins },
    }));
  }

  _spawnPattern(z) {
    const lanes = [-1, 0, 1];
    const roll = Math.random();

    if (roll < 0.38) {
      // blocks in 1–2 lanes, always ≥1 safe lane
      const nBlocks = this.t > 20 && Math.random() < 0.5 ? 2 : 1;
      const shuffled = lanes.slice().sort(() => Math.random() - 0.5);
      for (let i = 0; i < nBlocks; i++) {
        this.obstacles.push({ type: "block", lane: shuffled[i], z });
      }
      // coins in a safe lane
      this._coinLine(shuffled[2], z + 3);
    } else if (roll < 0.62) {
      const lane = lanes[Math.floor(Math.random() * 3)];
      this.obstacles.push({ type: "hurdle", lane, z });
      this._coinLine(lane, z + 3); // reward committing to the jump lane
    } else if (roll < 0.84) {
      const lane = lanes[Math.floor(Math.random() * 3)];
      this.obstacles.push({ type: "bar", lane, z });
    } else {
      // pure coin run
      this._coinLine(lanes[Math.floor(Math.random() * 3)], z);
    }
  }

  _coinLine(lane, z) {
    for (let i = 0; i < 4; i++) {
      this.coinItems.push({ lane, z: z + i * 2.2 });
    }
  }

  _die() {
    this.dead = true;
    this.flashT = 1;
    setTimeout(() => {
      if (!this.running) return;
      this.dispatchEvent(new CustomEvent("gameover", {
        detail: {
          score: Math.floor(this.score),
          coins: this.coins,
          distance: Math.floor(this.distance),
        },
      }));
    }, 900);
  }

  // ============================ render ============================
  /** Perspective: z=0 at player → f=1; z=Z_MAX at horizon → f=0. */
  _proj(z) {
    const n = 10; // focal-ish constant
    const f = n / (n + Math.max(0, z));
    return f;
  }

  _laneX(lane, f, w) {
    const spread = w * 0.30;
    return w / 2 + lane * spread * f;
  }

  _render() {
    const ctx = this.ctx;
    const w = this.canvas.width, h = this.canvas.height;
    const horizonY = h * 0.34;
    const bottomY = h * 0.97;
    const yAt = (f) => horizonY + (bottomY - horizonY) * f;

    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#0A0E1C");
    sky.addColorStop(0.34, "#131A30");
    sky.addColorStop(1, "#0A0E1C");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // horizon glow
    const glow = ctx.createRadialGradient(w / 2, horizonY, 0, w / 2, horizonY, w * 0.6);
    glow.addColorStop(0, "rgba(78,225,255,0.16)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    // track edges
    ctx.strokeStyle = COLORS.laneEdge;
    ctx.lineWidth = Math.max(2, w * 0.004);
    for (const edge of [-1.5, 1.5]) {
      ctx.beginPath();
      ctx.moveTo(this._laneX(edge, this._proj(Z_MAX), w), yAt(this._proj(Z_MAX)));
      ctx.lineTo(this._laneX(edge, 1, w), yAt(1));
      ctx.stroke();
    }

    // animated lane divider dashes
    ctx.strokeStyle = COLORS.lane;
    for (const div of [-0.5, 0.5]) {
      const phase = this.distance % 4;
      for (let z = -phase; z < Z_MAX; z += 4) {
        if (z < 0) continue;
        const f1 = this._proj(z), f2 = this._proj(Math.min(Z_MAX, z + 1.8));
        ctx.lineWidth = Math.max(1.5, w * 0.004 * f1);
        ctx.beginPath();
        ctx.moveTo(this._laneX(div, f1, w), yAt(f1));
        ctx.lineTo(this._laneX(div, f2, w), yAt(f2));
        ctx.stroke();
      }
    }

    // world objects, far → near
    const drawables = [
      ...this.obstacles.map((o) => ({ ...o, kind: o.type })),
      ...this.coinItems.map((c) => ({ ...c, kind: "coin" })),
    ].filter((d) => d.z > -1 && d.z < Z_MAX)
     .sort((a, b) => b.z - a.z);

    for (const d of drawables) {
      const f = this._proj(d.z);
      const x = this._laneX(d.lane, f, w);
      const y = yAt(f);
      const laneW = w * 0.30 * f * 0.86;
      if (d.kind === "coin") this._drawCoin(ctx, x, y, laneW);
      else this._drawObstacle(ctx, d.kind, x, y, laneW, h, f);
    }

    this._drawPlayer(ctx, w, h, yAt(1));

    // death flash
    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(255,92,122,${this.flashT * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  _drawObstacle(ctx, type, x, y, laneW, h, f) {
    ctx.save();
    const color = COLORS[type];
    ctx.shadowColor = color;
    ctx.shadowBlur = 16 * f;
    ctx.lineWidth = Math.max(2, laneW * 0.05);
    ctx.strokeStyle = color;
    ctx.fillStyle = colorAlpha(color, 0.16);

    if (type === "block") {
      const bw = laneW * 0.8, bh = h * 0.24 * f;
      roundRectPath(ctx, x - bw / 2, y - bh, bw, bh, 8 * f);
      ctx.fill(); ctx.stroke();
      // warning chevrons
      ctx.beginPath();
      ctx.moveTo(x - bw * 0.22, y - bh * 0.62);
      ctx.lineTo(x, y - bh * 0.4);
      ctx.lineTo(x + bw * 0.22, y - bh * 0.62);
      ctx.stroke();
    } else if (type === "hurdle") {
      const bw = laneW * 0.85, bh = h * 0.055 * f;
      roundRectPath(ctx, x - bw / 2, y - bh, bw, bh, 6 * f);
      ctx.fill(); ctx.stroke();
      // legs
      ctx.beginPath();
      ctx.moveTo(x - bw * 0.38, y); ctx.lineTo(x - bw * 0.38, y - bh);
      ctx.moveTo(x + bw * 0.38, y); ctx.lineTo(x + bw * 0.38, y - bh);
      ctx.stroke();
    } else if (type === "bar") {
      const bw = laneW * 0.95, bh = h * 0.05 * f;
      const lift = h * 0.15 * f; // floats at head height — squat under it
      roundRectPath(ctx, x - bw / 2, y - lift - bh, bw, bh, 6 * f);
      ctx.fill(); ctx.stroke();
      // hanging posts
      ctx.setLineDash([4 * f, 5 * f]);
      ctx.beginPath();
      ctx.moveTo(x - bw / 2, y - lift - bh);
      ctx.lineTo(x - bw / 2, y - lift - bh - h * 0.08 * f);
      ctx.moveTo(x + bw / 2, y - lift - bh);
      ctx.lineTo(x + bw / 2, y - lift - bh - h * 0.08 * f);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  _drawCoin(ctx, x, y, laneW) {
    const r = Math.max(3, laneW * 0.12);
    ctx.save();
    ctx.shadowColor = COLORS.coin;
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS.coin;
    ctx.beginPath();
    ctx.arc(x, y - r * 1.6, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(10,14,28,0.5)";
    ctx.beginPath();
    ctx.arc(x, y - r * 1.6, r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  _drawPlayer(ctx, w, h, groundY) {
    const x = this._laneX(this.playerX, 1, w);
    const bodyH = h * 0.13;
    const jumpArc = this.jumpT >= 0 ? Math.sin(this.jumpT * Math.PI) : 0;
    const lift = jumpArc * h * 0.14;
    const squash = this.squat ? 0.62 : 1;
    const bob = this.jumpT < 0 && !this.squat
      ? Math.sin(this.t * 14) * bodyH * 0.03 : 0;
    const baseY = groundY - lift + bob;

    // shadow
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${0.4 - jumpArc * 0.25})`;
    ctx.beginPath();
    ctx.ellipse(x, groundY, bodyH * (0.34 + jumpArc * 0.12), bodyH * 0.09, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // figure — capsule torso + head, cyan glow
    ctx.save();
    ctx.shadowColor = "#4EE1FF";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#F1F5FF";
    const th = bodyH * 0.62 * squash;
    const tw = bodyH * 0.30 / Math.sqrt(squash);
    roundRectPath(ctx, x - tw / 2, baseY - th - bodyH * 0.14, tw, th, tw / 2);
    ctx.fill();
    // head
    ctx.beginPath();
    ctx.arc(x, baseY - th - bodyH * 0.14 - bodyH * 0.10, bodyH * 0.13, 0, Math.PI * 2);
    ctx.fill();
    // legs (running scissor)
    if (!this.squat) {
      const swing = Math.sin(this.t * 14) * bodyH * 0.13;
      ctx.strokeStyle = "#F1F5FF";
      ctx.lineWidth = tw * 0.42;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - tw * 0.2, baseY - bodyH * 0.15);
      ctx.lineTo(x - tw * 0.2 - swing * 0.4, baseY);
      ctx.moveTo(x + tw * 0.2, baseY - bodyH * 0.15);
      ctx.lineTo(x + tw * 0.2 + swing * 0.4, baseY);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ---------- helpers ----------
function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function colorAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
