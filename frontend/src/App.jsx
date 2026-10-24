import { useEffect, useRef, useState } from "react";

// ---------- Tunable physics parameters (px, seconds, kg-ish units) ----------
const W = 1080, H = 560;
const GRAVITY = 9.8*5;          // px/s^2 downward
const DRY_MASS = 1000;       // rocket body mass
const FUEL_START = 300;      // fuel mass (also burns off -> rocket gets lighter)
const MAX_THRUST = 125000;    // force at 100% throttle
const BURN_RATE = 20;        // fuel per second at 100% throttle
const TORQUE = 2.6;          // rad/s^2 from side thrusters
const RCS_BURN = 1.5;        // fuel per second while rotating
const ANG_DAMP = 0.35;       // tiny rotational damping

// Landing limits
const MAX_VY = 45, MAX_VX = 25, MAX_ANGLE = 0.21; // ~12 degrees

// ---------- Terrain ----------
function makeTerrain() {
  const N = 48, seg = W / N;
  const pts = [];
  let y = H - 110;
  for (let i = 0; i <= N; i++) {
    y += (Math.random() - 0.5) * 38;
    y = Math.min(H - 50, Math.max(H - 170, y));
    pts.push({ x: i * seg, y });
  }
  const start = 8 + Math.floor(Math.random() * (N - 20));
  const padY = pts[start].y;
  for (let i = start; i <= start + 4; i++) pts[i].y = padY;
  return { pts, seg, pad: { x1: pts[start].x, x2: pts[start + 4].x, y: padY } };
}

function groundY(t, x) {
  x = ((x % W) + W) % W;
  const i = Math.min(t.pts.length - 2, Math.floor(x / t.seg));
  const a = t.pts[i], b = t.pts[i + 1];
  return a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
}

// ---------- Initial state: random position, velocity and angle ----------
function newGame() {
  const rnd = (a, b) => a + Math.random() * (b - a);
  return {
    terrain: makeTerrain(),
    stars: Array.from({ length: 90 }, () => ({ x: rnd(0, W), y: rnd(0, H * 0.6), r: rnd(0.6, 1.6) })),
    r: {
      x: rnd(80, W - 80), y: 70,
      vx: rnd(-60, 60), vy: rnd(0, 40),
      a: rnd(-Math.PI / 2, Math.PI / 2), w: rnd(-0.5, 0.5),
      fuel: FUEL_START, throttle: 0, status: "flying", msg: "",
    },
  };
}

// feet (left, right) and nose in the rocket's local frame
const LOCAL = [[-14, 24], [14, 24], [0, -26]];
const toWorld = (r, [lx, ly]) => ({
  x: r.x + lx * Math.cos(r.a) - ly * Math.sin(r.a),
  y: r.y + lx * Math.sin(r.a) + ly * Math.cos(r.a),
});

// ---------- Physics step ----------
function step(g, keys, dt) {
  const r = g.r;
  if (r.status !== "flying") return;

  // controls
  const wantThrust = keys.has("ArrowUp") || keys.has("w") || keys.has(" ");
  const turn = (keys.has("ArrowRight") || keys.has("d") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("a") ? 1 : 0);

  r.throttle = wantThrust && r.fuel > 0 ? 1 : 0;
  const mass = DRY_MASS + r.fuel;

  // thrust acts along the nose direction (angle 0 = pointing up)
  const accel = (MAX_THRUST * r.throttle) / mass;
  const ax = Math.sin(r.a) * accel;
  const ay = -Math.cos(r.a) * accel + GRAVITY;

  r.vx += ax * dt;
  r.vy += ay * dt;
  r.x += r.vx * dt;
  r.y += r.vy * dt;
  r.x = ((r.x % W) + W) % W; // wrap around horizontally

  // rotation
  if (turn && r.fuel > 0) { r.w += turn * TORQUE * dt; r.fuel -= RCS_BURN * dt; }
  r.w *= 1 - ANG_DAMP * dt;
  r.a += r.w * dt;

  // fuel
  r.fuel = Math.max(0, r.fuel - BURN_RATE * r.throttle * dt);

  // collision: any foot or the nose below the ground
  const { pad } = g.terrain;
  const touching = LOCAL.some((p) => { const q = toWorld(r, p); return q.y >= groundY(g.terrain, q.x); });
  if (touching) {
    const feet = [toWorld(r, LOCAL[0]), toWorld(r, LOCAL[1])];
    const onPad = feet.every((f) => f.x >= pad.x1 && f.x <= pad.x2);
    const bad = [];
    if (Math.abs(r.vy) > MAX_VY) bad.push("too fast vertically");
    if (Math.abs(r.vx) > MAX_VX) bad.push("too fast sideways");
    if (Math.abs(r.a) > MAX_ANGLE) bad.push("not upright");
    if (!onPad) bad.push("missed the pad");
    r.vx = r.vy = r.w = r.throttle = 0;
    if (bad.length === 0) { r.status = "landed"; r.msg = "Landed safely"; }
    else { r.status = "crashed"; r.msg = "Crashed: " + bad.join(", "); }
  }
}

// ---------- Drawing ----------
function draw(ctx, g) {
  const { terrain, stars, r } = g;
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, "#03050f"); sky.addColorStop(1, "#0d1428");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#fff";
  stars.forEach((s) => { ctx.globalAlpha = 0.5 + s.r / 3; ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 7); ctx.fill(); });
  ctx.globalAlpha = 1;

  // distant planet
  ctx.fillStyle = "#2f7de1"; ctx.beginPath(); ctx.arc(W - 90, 90, 32, 0, 7); ctx.fill();
  ctx.fillStyle = "#2fb58a"; ctx.beginPath(); ctx.ellipse(W - 96, 82, 16, 10, -0.4, 0, 7); ctx.fill();

  // terrain
  ctx.beginPath(); ctx.moveTo(0, H);
  terrain.pts.forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(W, H); ctx.closePath();
  ctx.fillStyle = "#1b2438"; ctx.fill();
  ctx.beginPath(); terrain.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.strokeStyle = "#e8edf7"; ctx.lineWidth = 2; ctx.stroke();

  // landing pad
  const { pad } = terrain;
  ctx.strokeStyle = "#f0a830"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(pad.x1, pad.y); ctx.lineTo(pad.x2, pad.y); ctx.stroke();
  ctx.fillStyle = "#f0a830"; ctx.fillRect(pad.x1 - 1, pad.y, 3, 10); ctx.fillRect(pad.x2 - 1, pad.y, 3, 10);
  ctx.font = "12px sans-serif"; ctx.textAlign = "center";
  ctx.fillText("Landing pad", (pad.x1 + pad.x2) / 2, pad.y + 26);

  // rocket
  ctx.save();
  ctx.translate(r.x, r.y); ctx.rotate(r.a);
  if (r.throttle > 0) { // flame
    ctx.fillStyle = "#ffb347";
    ctx.beginPath(); ctx.moveTo(-7, 20); ctx.lineTo(0, 20 + 26 + Math.random() * 14); ctx.lineTo(7, 20); ctx.fill();
  }
  ctx.strokeStyle = "#cfd8ea"; ctx.lineWidth = 2; // legs
  ctx.beginPath(); ctx.moveTo(-8, 14); ctx.lineTo(-14, 24); ctx.moveTo(8, 14); ctx.lineTo(14, 24); ctx.stroke();
  ctx.fillStyle = r.status === "crashed" ? "#d9534f" : "#eef2fb";
  ctx.beginPath(); ctx.roundRect(-10, -22, 20, 38, 6); ctx.fill();
  ctx.fillStyle = "#3aa0ff"; ctx.beginPath(); ctx.arc(0, -8, 4, 0, 7); ctx.fill();
  ctx.restore();

  if (r.status !== "flying") {
    ctx.fillStyle = r.status === "landed" ? "#5be3a0" : "#ff7a70";
    ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(r.msg, W / 2, H / 2 - 40);
    ctx.fillStyle = "#c9d3ea"; ctx.font = "16px sans-serif";
    ctx.fillText("Press R to try again", W / 2, H / 2 - 12);
  }
}

// ---------- Component ----------
export default function RocketLander() {
  const canvasRef = useRef(null);
  const game = useRef(newGame());
  const keys = useRef(new Set());
  const [hud, setHud] = useState({});
  
   const [aiMode, setAiMode] = useState(false);
  const aiModeRef = useRef(false);
  const aiActionRef = useRef(0);
  async function getAIAction() {
  const g = game.current;
  const r = g.r;
  const pad = g.terrain.pad;

  if (r.status !== "flying") return;

  const observation = [
    (r.x - (pad.x1 + pad.x2) / 2) / (W / 2),
    (pad.y - r.y) / (H / 2),
    r.vx / 100,
    r.vy / 100,
    r.a,
    r.w,
    0,
    0,
  ];

  try {
    const response = await fetch(
      "http://127.0.0.1:5000/api/predict",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ observation }),
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }

    const data = await response.json();
    aiActionRef.current = data.action;
  } catch (error) {
    console.error("AI prediction failed:", error);
  }
}
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    const onDown = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (["ArrowUp", "ArrowLeft", "ArrowRight", " "].includes(k)) e.preventDefault();
      if (k === "r") game.current = newGame();
      keys.current.add(k);
    };
    const onUp = (e) => keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);

    let last = performance.now(), raf, hudTimer = 0;
    let aiTimer = setInterval(() => {
  if (aiModeRef.current && game.current.r.status === "flying") {
    getAIAction();
  }
}, 150);
    const loop = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      step(game.current, keys.current, dt);
      if (aiModeRef.current) {
  keys.current.clear();

  switch (aiActionRef.current) {
    case 1:
      keys.current.add("ArrowLeft");
      break;
    case 2:
      keys.current.add("ArrowUp");
      break;
    case 3:
      keys.current.add("ArrowRight");
      break;
    default:
      break;
  }
}

step(game.current, keys.current, dt);
      draw(ctx, game.current);
      hudTimer += dt;
      if (hudTimer > 0.08) {
        hudTimer = 0;
        const r = game.current.r;
        setHud({
          vx: r.vx, vy: r.vy, angle: (r.a * 180) / Math.PI, fuel: r.fuel,
          mass: DRY_MASS + r.fuel, status: r.status,
          alt: game.current.terrain.pad.y - r.y,
        });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);

      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const ok = (v, lim) => (Math.abs(v) <= lim ? "#5be3a0" : "#ff7a70");
  const rows = [
    ["Vertical speed", (hud.vy ?? 0).toFixed(1), ok(hud.vy ?? 0, MAX_VY)],
    ["Horizontal speed", (hud.vx ?? 0).toFixed(1), ok(hud.vx ?? 0, MAX_VX)],
    ["Angle (deg)", (hud.angle ?? 0).toFixed(1), ok(((hud.angle ?? 0) * Math.PI) / 180, MAX_ANGLE)],
    ["Height above pad", (hud.alt ?? 0).toFixed(0), "#e8edf7"],
    ["Mass", (hud.mass ?? 0).toFixed(0), "#e8edf7"],
  ];

  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap", padding: 16, background: "#070b16", minHeight: "70vh", color: "#e8edf7", fontFamily: "system-ui, sans-serif" }}>
        <button
  onClick={() => {
    const nextMode = !aiMode;
    setAiMode(nextMode);
    aiModeRef.current = nextMode;
    aiActionRef.current = 0;
    keys.current.clear();

    if (nextMode) getAIAction();
  }}
  style={{
    padding: "10px 18px",
    borderRadius: 8,
    border: "1px solid #3a527c",
    background: aiMode ? "#14532d" : "#0f1730",
    color: "#e8edf7",
    cursor: "pointer",
  }}
>
  {aiMode ? "🤖 AI Mode ON" : "🎮 Manual Mode"}
</button>

<canvas
  ref={canvasRef}
  width={W}
  height={H}
  style={{
    width: "100%",
    maxWidth: W,
    borderRadius: 12,
    border: "1px solid #1d2a47",
  }}
/>
     
      <div style={{ width: "100%", display: "flex", flexWrap: "wrap", gap: 10 }}>
        {rows.map(([label, val, color]) => (
          <div key={label} style={{ background: "#0f1730", borderRadius: 10, padding: "8px 12px" }}>
            <div style={{ fontSize: 12, color: "#8fa0c4" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{val}</div>
          </div>
        ))}
        <div style={{ background: "#0f1730", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ fontSize: 12, color: "#8fa0c4" }}>Fuel</div>
          <div style={{ height: 10, background: "#1d2a47", borderRadius: 5, marginTop: 6 }}>
            <div style={{ height: "100%", width: `${((hud.fuel ?? FUEL_START) / FUEL_START) * 100}%`, background: "#f0a830", borderRadius: 5 }} />
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#8fa0c4", lineHeight: 1.5 }}>
          Up / W / Space: thrust<br />
          Left / Right (A / D): rotate<br />
          R: new game<br /><br />
          Land on the orange pad with vertical speed under {MAX_VY}, sideways speed under {MAX_VX} and tilt under 12°.
        </div>
      </div>
    </div>
  );
}