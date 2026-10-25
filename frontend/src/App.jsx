import { useEffect, useRef, useState } from "react";

import "./index.css";

const W = 1080;
const H = 560;
const GRAVITY = 60;
const DRY_MASS = 1000;
const FUEL_START = 300;
const MAX_THRUST = 125000;
const BURN_RATE = 20;
const TORQUE = 2.6;

const GROUND_Y = H - 80;
const PAD_HALF = 65; // landing pad is 130px wide
const LIMIT_VY = 45;
const LIMIT_VX = 25;
const LIMIT_RAD = 0.21; // ~12 degrees
const LIMIT_DEG = (LIMIT_RAD * 180) / Math.PI;

const rand = (min, max) => min + Math.random() * (max - min);

// Both the rocket and the landing pad are spawned at random
// positions inside the screen bounds on every new game.
const randomPadX = () => rand(PAD_HALF + 50, W - PAD_HALF - 50);
// The rocket keeps clear of the HUD overlays so it is always visible,
// and is launched with a random sideways drift.
const randomStart = () => ({
  x: rand(W * 0.32, W * 0.68),
  y: rand(70, 300),
  vx: (Math.random() < 0.5 ? -1 : 1) * rand(25, 55),
});

const newRocket = () => {
  const s = randomStart();
  return {
    x: s.x, y: s.y, vx: s.vx, vy: 0, a: 0, w: 0,
    fuel: FUEL_START, throttle: 0, t: 0,
    status: "FLYING", msg: "Mission in progress",
  };
};

const initialTelemetry = {
  x: W / 2, vx: 0, vy: 0, angle: 0, w: 0, speed: 0, fuel: FUEL_START, alt: 0,
  status: "FLYING", throttle: 0, time: 0, msg: "",
};

export default function App() {
  const canvasRef = useRef(null);
  const keys = useRef({});
  const rocket = useRef(newRocket());
  const particles = useRef([]);
  const trail = useRef([]);
  const attempt = useRef(0);
  const pausedRef = useRef(false);
  const stars = useRef(
    Array.from({ length: 140 }, () => ({
      x: Math.random() * W,
      y: Math.random() * (H - 200),
      s: Math.random() * 1.6 + 0.5,
      p: Math.random() * 6.28,
    }))
  );

  const [telemetry, setTelemetry] = useState(initialTelemetry);
  const [history, setHistory] = useState([]);
  const [motion, setMotion] = useState([]); // speed / angular velocity samples
  const [padX, setPadX] = useState(randomPadX);
  const padRef = useRef(padX);
  const [log, setLog] = useState([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const reset = () => {
    const pad = randomPadX();
    setPadX(pad);
    padRef.current = pad;

    rocket.current = newRocket();
    particles.current = [];
    trail.current = [];
    setHistory([]);
    setMotion([]);
    setPaused(false);
    setTelemetry({
      ...initialTelemetry,
      x: rocket.current.x,
      vx: rocket.current.vx,
    });
  };

  useEffect(() => {
    const down = (e) => {
      keys.current[e.code] = true;
      if (["ArrowUp", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
      if (e.code === "KeyR") reset();
      if (e.code === "KeyP") setPaused((v) => !v);
    };
    const up = (e) => {
      keys.current[e.code] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    let frame;
    let last = performance.now();
    let clock = 0, sample = 0, tele = 0, trailT = 0;
    let lastStatus = "FLYING";

    const spawn = (p) => particles.current.push(p);

    const explode = (x, y) => {
      for (let i = 0; i < 70; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 260;
        spawn({
          kind: "fire", x, y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 60,
          life: 0.6 + Math.random() * 0.8, max: 1.4, size: 3 + Math.random() * 6,
        });
      }
      for (let i = 0; i < 30; i++) {
        spawn({
          kind: "smoke", x: x + (Math.random() - 0.5) * 30, y,
          vx: (Math.random() - 0.5) * 60, vy: -20 - Math.random() * 60,
          life: 1.5 + Math.random(), max: 2.5, size: 8 + Math.random() * 10,
        });
      }
    };

    const loop = (now) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        frame = requestAnimationFrame(loop);
        return;
      }
      const ctx = canvas.getContext("2d");
      const r = rocket.current;
      // clamp dt: a throttled/background tab can hand out stale frame
      // timestamps, which would otherwise produce a negative dt.
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.04);
      last = now;
      const isPaused = pausedRef.current;
      if (!isPaused) clock += dt;

      /* ---------- physics (unchanged from your version) ---------- */
      if (!isPaused && r.status === "FLYING") {
        const k = keys.current;
        const thrusting = k.Space || k.ArrowUp || k.KeyW;
        const left = k.ArrowLeft || k.KeyA;
        const right = k.ArrowRight || k.KeyD;

        r.throttle = thrusting && r.fuel > 0 ? 1 : 0;
        if (left) r.w -= TORQUE * dt;
        if (right) r.w += TORQUE * dt;
        r.w *= Math.max(0, 1 - 0.35 * dt);
        r.a += r.w * dt;
        r.t += dt;

        if (r.throttle) {
          const burn = Math.max(0, Math.min(r.fuel, BURN_RATE * dt));
          r.fuel = Math.max(0, r.fuel - burn);
          const mass = DRY_MASS + r.fuel;
          const thrust = MAX_THRUST * (burn / Math.max(BURN_RATE * dt, 0.001));
          r.vx += ((Math.sin(r.a) * thrust) / mass) * dt;
          r.vy -= ((Math.cos(r.a) * thrust) / mass) * dt;

          // exhaust particles leave the nozzle, opposite to thrust
          const nx = r.x - Math.sin(r.a) * 24;
          const ny = r.y + Math.cos(r.a) * 24;
          for (let i = 0; i < 3; i++) {
            const sp = 170 + Math.random() * 120;
            spawn({
              kind: "fire", x: nx, y: ny,
              vx: -Math.sin(r.a) * sp + (Math.random() - 0.5) * 50 + r.vx * 0.3,
              vy: Math.cos(r.a) * sp + (Math.random() - 0.5) * 30 + r.vy * 0.3,
              life: 0.35 + Math.random() * 0.25, max: 0.6, size: 3 + Math.random() * 4,
            });
          }
          if (Math.random() < 0.5) {
            spawn({
              kind: "smoke", x: nx, y: ny,
              vx: -Math.sin(r.a) * 60 + (Math.random() - 0.5) * 40,
              vy: Math.cos(r.a) * 60,
              life: 1 + Math.random() * 0.6, max: 1.6, size: 4 + Math.random() * 4,
            });
          }
        }

        r.vy += GRAVITY * dt;
        r.x += r.vx * dt;
        r.y += r.vy * dt;
        r.x = Math.max(20, Math.min(W - 20, r.x));
        // keep the rocket from flying off the top of the screen
        if (r.y < 30) {
          r.y = 30;
          r.vy = Math.max(r.vy, 0);
        }

        trailT += dt;
        if (trailT > 0.04) {
          trailT = 0;
          trail.current.push({ x: r.x, y: r.y });
          if (trail.current.length > 90) trail.current.shift();
        }

        if (r.y >= GROUND_Y) {
          r.y = GROUND_Y;
          const onPad = Math.abs(r.x - padRef.current) <= PAD_HALF;
          const soft =
            Math.abs(r.vy) <= LIMIT_VY && Math.abs(r.vx) <= LIMIT_VX && Math.abs(r.a) <= LIMIT_RAD;
          const ok = soft && onPad;
          const score = ok
            ? Math.round(200 + r.fuel - Math.abs(r.vy) * 2)
            : -Math.round(Math.abs(r.vy) + Math.abs(r.vx) * 2 + Math.abs(r.a) * 50);

          r.status = ok ? "LANDED" : "CRASHED";
          r.msg = ok
            ? "Landing successful!"
            : soft
            ? "Missed the landing pad"
            : "Rocket destroyed. Try again";
          if (!ok) explode(r.x, r.y);
          r.vx = 0;
          r.vy = 0;

          attempt.current += 1;
          const entry = { id: attempt.current, status: r.status, score };
          setLog((old) => [entry, ...old].slice(0, 50));
        }

        sample += dt;
        if (sample >= 0.15) {
          sample = 0;
          const p = { x: r.x, y: r.y };
          setHistory((old) => [...old.slice(-79), p]);
          setMotion((old) => [
            ...old.slice(-139),
            { t: r.t, w: r.w, speed: Math.hypot(r.vx, r.vy) },
          ]);
        }
      }

      /* ---------- particles ---------- */
      if (!isPaused) {
        const list = particles.current;
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.life -= dt;
          if (p.life <= 0) {
            list.splice(i, 1);
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.kind === "fire") p.vy += 80 * dt;
          else p.vy -= 10 * dt;
        }
      }

      /* ---------- draw: sky ---------- */
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#04081a");
      sky.addColorStop(0.55, "#111c47");
      sky.addColorStop(1, "#1c4452");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);

      const mg = ctx.createRadialGradient(930, 95, 4, 930, 95, 130);
      mg.addColorStop(0, "rgba(190,225,255,0.5)");
      mg.addColorStop(1, "rgba(190,225,255,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(780, 0, 300, 260);
      ctx.fillStyle = "#e8f3ff";
      ctx.beginPath();
      ctx.arc(930, 95, 24, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff";
      stars.current.forEach((s) => {
        ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(clock * 0.8 + s.p));
        ctx.fillRect(s.x, s.y, s.s, s.s);
      });
      ctx.globalAlpha = 1;

      const ridge = (base, amp, ph, col) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 10) {
          ctx.lineTo(x, base + Math.sin(x * 0.006 + ph) * amp + Math.sin(x * 0.017 + ph * 2) * amp * 0.35);
        }
        ctx.lineTo(W, H);
        ctx.closePath();
        ctx.fill();
      };
      ridge(H - 200, 40, 1, "#13264d");
      ridge(H - 150, 30, 3, "#0f3142");
      ridge(H - 105, 20, 5, "#0f3a30");

      /* ground + glowing pad */
      const gg = ctx.createLinearGradient(0, H - 65, 0, H);
      gg.addColorStop(0, "#17503a");
      gg.addColorStop(1, "#08201a");
      ctx.fillStyle = gg;
      ctx.fillRect(0, H - 65, W, 65);
      ctx.fillStyle = "rgba(70,230,177,0.5)";
      ctx.fillRect(0, H - 65, W, 2);

      const pad = padRef.current;
      const beam = ctx.createLinearGradient(0, H - 330, 0, H - 70);
      beam.addColorStop(0, "rgba(70,230,177,0)");
      beam.addColorStop(1, "rgba(70,230,177,0.14)");
      ctx.fillStyle = beam;
      ctx.fillRect(pad - PAD_HALF, H - 330, PAD_HALF * 2, 260);

      ctx.save();
      ctx.shadowColor = "#46e6b1";
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#46e6b1";
      ctx.fillRect(pad - PAD_HALF, H - 70, PAD_HALF * 2, 6);
      ctx.restore();
      const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
      [-PAD_HALF, PAD_HALF].forEach((dx) => {
        ctx.fillStyle = `rgba(255,214,102,${0.5 + pulse * 0.5})`;
        ctx.beginPath();
        ctx.arc(pad + dx, H - 74, 4, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "rgba(200,225,235,0.75)";
      ctx.font = "12px 'Share Tech Mono', monospace";
      ctx.textAlign = "center";
      ctx.fillText("LANDING ZONE", pad, H - 82);
      ctx.textAlign = "start";

      /* trail */
      const tr = trail.current;
      for (let i = 1; i < tr.length; i++) {
        const f = i / tr.length;
        ctx.strokeStyle = `rgba(94,234,255,${f * 0.65})`;
        ctx.lineWidth = 1 + f * 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(tr[i - 1].x, tr[i - 1].y);
        ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }

      /* smoke first, then rocket, then fire on top */
      particles.current.forEach((p) => {
        if (p.kind !== "smoke") return;
        const t = p.life / p.max;
        ctx.fillStyle = `rgba(165,180,195,${t * 0.22})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.8 - t), 0, Math.PI * 2);
        ctx.fill();
      });

      if (r.status !== "CRASHED") {
        ctx.save();
        ctx.translate(r.x, r.y);
        ctx.rotate(r.a);

        if (r.throttle && r.fuel > 0 && r.status === "FLYING") {
          const fl = 28 + Math.random() * 16;
          const fg = ctx.createLinearGradient(0, 18, 0, 18 + fl);
          fg.addColorStop(0, "#ffffff");
          fg.addColorStop(0.3, "#ffd27a");
          fg.addColorStop(1, "rgba(255,90,30,0)");
          ctx.fillStyle = fg;
          ctx.shadowColor = "#ff9a3c";
          ctx.shadowBlur = 30;
          ctx.beginPath();
          ctx.moveTo(-6, 18);
          ctx.quadraticCurveTo(0, 18 + fl * 1.3, 6, 18);
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // legs
        ctx.strokeStyle = "#8fa3bd";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-8, 12); ctx.lineTo(-17, 24);
        ctx.moveTo(8, 12); ctx.lineTo(17, 24);
        ctx.stroke();

        // fins
        ctx.fillStyle = "#2b3a55";
        ctx.beginPath();
        ctx.moveTo(-9, 2); ctx.lineTo(-21, 22); ctx.lineTo(-9, 16);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(9, 2); ctx.lineTo(21, 22); ctx.lineTo(9, 16);
        ctx.closePath(); ctx.fill();

        // body
        const bg = ctx.createLinearGradient(-11, 0, 11, 0);
        bg.addColorStop(0, "#9fb0c6");
        bg.addColorStop(0.35, "#ffffff");
        bg.addColorStop(1, "#8ea0b8");
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.bezierCurveTo(14, -18, 12, 4, 11, 18);
        ctx.lineTo(-11, 18);
        ctx.bezierCurveTo(-12, 4, -14, -18, 0, -34);
        ctx.fill();

        // nose cone
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.moveTo(0, -34);
        ctx.quadraticCurveTo(8, -26, 9, -18);
        ctx.lineTo(-9, -18);
        ctx.quadraticCurveTo(-8, -26, 0, -34);
        ctx.fill();

        // window
        ctx.fillStyle = "#0b1d36";
        ctx.strokeStyle = "#5eeaff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, -6, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // nozzle
        ctx.fillStyle = "#3a4660";
        ctx.fillRect(-6, 18, 12, 4);
        ctx.restore();
      }

      ctx.globalCompositeOperation = "lighter";
      particles.current.forEach((p) => {
        if (p.kind !== "fire") return;
        const t = p.life / p.max;
        ctx.fillStyle = `hsla(${15 + 40 * t},100%,${45 + 20 * t}%,${t * 0.85})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t + 1, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";

      /* ---------- telemetry (throttled) ---------- */
      tele += dt;
      if (tele > 0.05 || r.status !== lastStatus) {
        tele = 0;
        lastStatus = r.status;
        setTelemetry({
          x: r.x,
          vx: r.vx,
          vy: r.vy,
          angle: (r.a * 180) / Math.PI,
          w: r.w,
          speed: Math.hypot(r.vx, r.vy),
          fuel: r.fuel,
          alt: Math.max(0, GROUND_Y - r.y),
          status: r.status,
          throttle: r.throttle,
          time: r.t,
          msg: r.msg,
        });
      }

      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const t = telemetry;
  const fuelPercent = Math.max(0, (t.fuel / FUEL_START) * 100);
  const mm = String(Math.floor(t.time / 60)).padStart(2, "0");
  const ss = String(Math.floor(t.time % 60)).padStart(2, "0");

  // Live landing values: green while inside the limits, red as soon as they break one.
  const conditions = [
    {
      label: "Vertical speed",
      now: Math.abs(t.vy).toFixed(1),
      limit: `≤ ${LIMIT_VY} m/s`,
      ok: Math.abs(t.vy) <= LIMIT_VY,
    },
    {
      label: "Horizontal speed",
      now: Math.abs(t.vx).toFixed(1),
      limit: `≤ ${LIMIT_VX} m/s`,
      ok: Math.abs(t.vx) <= LIMIT_VX,
    },
    {
      label: "Angle",
      now: Math.abs(t.angle).toFixed(1),
      limit: `≤ ${LIMIT_DEG.toFixed(0)}°`,
      ok: Math.abs(t.angle) <= LIMIT_DEG,
    },
    {
      label: "Over the pad",
      now: String(Math.round(Math.abs(t.x - padX))),
      limit: `± ${PAD_HALF} px`,
      ok: Math.abs(t.x - padX) <= PAD_HALF,
    },
  ];

  const attempts = log.length;
  const landings = log.filter((l) => l.status === "LANDED").length;
  const best = attempts ? Math.max(...log.map((l) => l.score)) : "–";

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand">
          <div className="grass-block" aria-hidden="true" />
          <div>
            <h1>ROCKET LANDING SIMULATOR</h1>
            <p>Fly &nbsp;•&nbsp; Burn &nbsp;•&nbsp; Land</p>
          </div>
        </div>
        <p className="quote">“Small steps, big landings.”</p>
        <div className="pilot">
          <div className="creeper" aria-hidden="true" />
          <div>
            <strong>Mission 001</strong>
            <span className={`tag ${paused ? "warn" : ""}`}>{paused ? "Paused" : "Live"}</span>
          </div>
        </div>
      </header>

      <div className="shell">
        <section className="center">
          <div className="panel stage-panel">
            <div className="stage">
              <canvas ref={canvasRef} width={W} height={H} className="simulation-canvas" />

              <div className="hud hud-left">
                <HudRow icon="🚀" label="Altitude" value={`${t.alt.toFixed(0)} m`} />
                <HudRow
                  icon="⬇️"
                  label="Vertical speed"
                  value={`${t.vy.toFixed(1)} m/s`}
                  tone={Math.abs(t.vy) <= LIMIT_VY ? "ok" : "bad"}
                />
                <HudRow
                  icon="↔️"
                  label="Horizontal speed"
                  value={`${t.vx.toFixed(1)} m/s`}
                  tone={Math.abs(t.vx) <= LIMIT_VX ? "ok" : "bad"}
                />
                <HudRow
                  icon="🔃"
                  label="Angle"
                  value={`${t.angle.toFixed(1)}°`}
                  tone={Math.abs(t.angle) <= LIMIT_DEG ? "ok" : "bad"}
                />
                <HudRow icon="⛽" label="Fuel" value={`${fuelPercent.toFixed(0)}%`} />
              </div>

              <div className="hud hud-right">
                <HudRow icon="⏱️" label="Time" value={`${mm}:${ss}`} />
                <HudRow
                  icon={<i className={`dot ${t.status.toLowerCase()}`} />}
                  label="Status"
                  value={t.status === "FLYING" ? "In flight" : t.status === "LANDED" ? "Landed" : "Crashed"}
                />
              </div>

              {t.status !== "FLYING" && (
                <div className={`result ${t.status.toLowerCase()}`}>
                  <h2>{t.status === "LANDED" ? "LANDED!" : "CRASHED"}</h2>
                  <p>{t.msg}</p>
                  <button className="mc-btn" onClick={reset}>Try again</button>
                </div>
              )}
              {paused && t.status === "FLYING" && (
                <div className="result paused">
                  <h2>PAUSED</h2>
                  <button className="mc-btn" onClick={() => setPaused(false)}>Resume</button>
                </div>
              )}
            </div>
          </div>

          <div className="bottom-row">
            <Panel icon="🧱" title="Flight stats">
              <div className="stat-grid">
                <div><span>Attempts</span><strong>{attempts}</strong></div>
                <div><span>Landings</span><strong>{landings}</strong></div>
                <div><span>Best score</span><strong>{best}</strong></div>
                <div><span>Engine</span>
                  <strong className={t.throttle ? "ok" : ""}>
                    {t.fuel <= 0 ? "No fuel" : t.throttle ? "Burning" : "Standby"}
                  </strong>
                </div>
              </div>
            </Panel>

            <Panel icon="📈" title="Trajectory monitor">
              <div className="traj">
                <svg viewBox="0 0 320 190" role="img" aria-label="Live rocket trajectory">
                  {[30, 65, 100, 135, 170].map((y) => (
                    <line key={y} x1="12" y1={y} x2="308" y2={y} className="chart-grid" />
                  ))}
                  {[40, 100, 160, 220, 280].map((x) => (
                    <line key={x} x1={x} y1="15" x2={x} y2="175" className="chart-grid" />
                  ))}
                  {history.length > 1 && (
                    <polyline
                      points={history
                        .map((p) => `${12 + (p.x / W) * 296},${15 + (p.y / H) * 155}`)
                        .join(" ")}
                      className="trajectory-line"
                    />
                  )}
                  <circle cx={12 + (padX / W) * 296} cy={15 + ((H - 65) / H) * 155} r="5" className="target-dot" />
                </svg>
                <div className="last5">
                  <h4>Last 5 results</h4>
                  {log.length === 0 && <p className="empty">No landings yet. Take off!</p>}
                  {log.slice(0, 5).map((l) => (
                    <div key={l.id} className={`result-row ${l.status.toLowerCase()}`}>
                      <span>#{l.id}</span>
                      <span>{l.status === "LANDED" ? "Landed" : "Crash"}</span>
                      <b>{l.score}</b>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>

            <Panel icon="📉" title="Angular velocity & speed">
              <MotionGraph data={motion} speed={t.speed} w={t.w} />
            </Panel>
          </div>
        </section>

        <aside className="right">
          <Panel icon="🎯" title="Landing conditions">
            <ul className="conditions">
              {conditions.map((c) => (
                <li key={c.label} className={c.ok ? "ok" : "bad"}>
                  <span className="mark">{c.ok ? "✔" : "✖"}</span>
                  <span>{c.label}</span>
                  <em>{c.now} / {c.limit}</em>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel icon="🧰" title="Quick actions">
            <div className="actions">
              <button className="mc-btn stone" onClick={() => setPaused((v) => !v)}>
                {paused ? "▶ Resume" : "Ⅱ Pause"}
              </button>
              <button className="mc-btn stone" onClick={reset}>↻ Reset simulation</button>
              <button className="mc-btn stone" onClick={() => { setLog([]); attempt.current = 0; }}>
                🗑 Clear results
              </button>
            </div>
          </Panel>
        </aside>
      </div>

      <footer className="footer">
        <span>Rocket Landing Simulator</span>
        <span>React + Canvas</span>
        <span>Reach for the stars!</span>
      </footer>
    </main>
  );
}

function Panel({ icon, title, children }) {
  return (
    <section className="panel">
      <h3 className="panel-title"><span>{icon}</span>{title}</h3>
      {children}
    </section>
  );
}

function HudRow({ icon, label, value, tone }) {
  return (
    <div className="hud-row">
      <span className="hud-icon">{icon}</span>
      <small>{label}</small>
      <strong className={tone || ""}>{value}</strong>
    </div>
  );
}

/**
 * Live speed + angular velocity chart.
 * Two side-by-side bands: speed (m/s) and signed angular velocity (rad/s).
 */
function MotionGraph({ data, speed, w }) {
  const X0 = 44;
  const X1 = 306;
  const TOP = 22;
  const BOT = 112;

  const tMax = Math.max(6, data.length ? data[data.length - 1].t : 0);
  const sMax = Math.max(40, Math.ceil(Math.max(speed, ...data.map((d) => d.speed)) / 10) * 10);
  const wMax = Math.max(
    0.5,
    Math.ceil(Math.max(Math.abs(w), ...data.map((d) => Math.abs(d.w))) * 10) / 10
  );

  const px = (t) => X0 + (t / tMax) * (X1 - X0);
  const sy = (v) => BOT - (Math.max(0, v) / sMax) * (BOT - TOP);
  const wy = (v) => BOT - ((v + wMax) / (2 * wMax)) * (BOT - TOP);

  const speedPts = data.map((d) => `${px(d.t).toFixed(1)},${sy(d.speed).toFixed(1)}`).join(" ");
  const anglePts = data.map((d) => `${px(d.t).toFixed(1)},${wy(d.w).toFixed(1)}`).join(" ");
  const zeroY = wy(0);
  const has = data.length > 1;

  return (
    <div className="motion-graph">
      <div className="graph-panels">
        <svg viewBox="0 0 320 134" role="img" aria-label="Speed over time">
          <text className="graph-label" x={X0} y="13">SPEED (m/s)</text>
          {[TOP, (TOP + BOT) / 2, BOT].map((y) => (
            <line key={y} x1={X0} y1={y} x2={X1} y2={y} className="chart-grid" />
          ))}
          <text className="graph-axis" x={X0 - 5} y={TOP + 8} textAnchor="end">{sMax}</text>
          <text className="graph-axis" x={X0 - 5} y={BOT} textAnchor="end">0</text>
          {has && <polyline points={speedPts} className="graph-speed" />}
          <line x1={X0} y1={BOT + 6} x2={X1} y2={BOT + 6} className="chart-grid" />
          <text className="graph-axis" x={X0} y="132">0s</text>
          <text className="graph-axis" x={X1} y="132" textAnchor="end">{Math.round(tMax)}s</text>
        </svg>

        <svg viewBox="0 0 320 134" role="img" aria-label="Angular velocity over time">
          <text className="graph-label" x={X0} y="13">ANGULAR VELOCITY (rad/s)</text>
          {[TOP, zeroY, BOT].map((y) => (
            <line key={y} x1={X0} y1={y} x2={X1} y2={y} className="chart-grid" />
          ))}
          <line x1={X0} y1={zeroY} x2={X1} y2={zeroY} className="graph-zero" />
          <text className="graph-axis" x={X0 - 5} y={TOP + 8} textAnchor="end">+{wMax}</text>
          <text className="graph-axis" x={X0 - 5} y={zeroY + 4} textAnchor="end">0</text>
          <text className="graph-axis" x={X0 - 5} y={BOT} textAnchor="end">-{wMax}</text>
          {has && <polyline points={anglePts} className="graph-angle" />}
          <line x1={X0} y1={BOT + 6} x2={X1} y2={BOT + 6} className="chart-grid" />
          <text className="graph-axis" x={X0} y="132">0s</text>
          <text className="graph-axis" x={X1} y="132" textAnchor="end">{Math.round(tMax)}s</text>
        </svg>
      </div>

      <div className="graph-legend">
        <span className="s">● Speed <b>{speed.toFixed(1)} m/s</b></span>
        <span className="a">● Angular velocity <b>{w.toFixed(2)} rad/s</b></span>
      </div>
    </div>
  );
}