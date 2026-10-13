"use strict";
(function () {

// Fixed-step simulation of a PID loop around a simple physical plant.
// Error is divided by the plant's `scale`, so Kp/Ki/Kd mean roughly the same thing on every plant.

const G = 9.81;
const DT = 0.005;
const T_END = 10;
const STEP_AT = 1;      // setpoint jumps from 0 to the target here
const DISTURB_AT = 6;   // optional disturbance hits here

const PLANTS = {
  motor: {
    name: "DC motor speed",
    blurb: "Spin a motor up to a target speed. A load slows it down at 6 s.",
    unit: "rpm", scale: 100, setpoint: 60, setMax: 100,
    uMin: -1, uMax: 1, bias: 0, y0: 0,
    disturbance: "load on the shaft",
    deriv: (y, v, u, d) => ((-y + 100 * u - (d ? 25 : 0)) / 0.5),
    second: false,
    presets: {
      "P only": [3, 0, 0], "PI": [3, 3, 0], "Too much I": [3, 30, 0], "PID": [5, 5, 0.2],
    },
    gains: [5, 5, 0.2],
  },
  drone: {
    name: "Drone altitude",
    blurb: "Hold a hover height with thrust. A payload is added at 6 s. Thrust is trimmed to 50% so zero error hovers.",
    unit: "m", scale: 10, setpoint: 5, setMax: 10,
    uMin: 0, uMax: 1, bias: 0.5, y0: 0,
    disturbance: "extra payload",
    deriv: (h, v, u, d) => 2 * G * u - G - 0.8 * v - (d ? 0.25 * G : 0),
    second: true,
    presets: {
      "P only": [2, 0, 0], "PD": [2, 0, 1], "PID": [2, 0.2, 1.2], "Wobbly": [5, 0, 0.1],
    },
    gains: [2, 0.2, 1.2],
  },
  car: {
    name: "Cruise control",
    blurb: "Hold a car's speed. A hill adds drag at 6 s.",
    unit: "m/s", scale: 30, setpoint: 20, setMax: 30,
    uMin: 0, uMax: 1, bias: 0, y0: 0,
    disturbance: "uphill slope",
    deriv: (v, _x, u, d) => 12 * u - 0.004 * v * v - (d ? 1.5 : 0),
    second: false,
    presets: {
      "P only": [2, 0, 0], "PI": [2, 0.3, 0], "Too much I": [1, 4, 0], "PID": [4, 1, 0.2],
    },
    gains: [4, 1, 0.2],
  },
};

function rng(seed) { // mulberry32, so the "noise" is the same every run
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gauss(rand) {
  return Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
}

function simulate(key, { kp, ki, kd, setpoint, disturb, noise, antiWindup }) {
  const P = PLANTS[key];
  const rand = rng(7);
  const n = Math.round(T_END / DT);
  const out = { t: [], r: [], y: [], u: [], n };

  let y = P.y0, v = 0;           // position-like state and its rate (used by the drone)
  let integral = 0, dFilt = 0, prevMeas = y;
  const tau = 0.05;               // derivative low-pass time constant

  for (let i = 0; i < n; i++) {
    const t = i * DT;
    const r = t >= STEP_AT ? setpoint : 0;
    const d = disturb && t >= DISTURB_AT;
    const meas = y + gauss(rand) * noise * 0.01 * P.scale;

    const e = (r - meas) / P.scale;
    // derivative on the measurement (no "kick" when the setpoint jumps), low-pass filtered
    const raw = (meas - prevMeas) / DT;
    dFilt += (DT / (tau + DT)) * (raw - dFilt);
    prevMeas = meas;

    const unsat = P.bias + kp * e + integral + (-kd * dFilt / P.scale);
    const u = Math.min(P.uMax, Math.max(P.uMin, unsat));
    const pushingFurther = (unsat > P.uMax && e > 0) || (unsat < P.uMin && e < 0);
    if (!(antiWindup && pushingFurther)) integral += ki * e * DT;

    out.t.push(t); out.r.push(r); out.y.push(y); out.u.push(u);

    // advance the plant
    if (P.second) {
      const a = P.deriv(y, v, u, d);
      v += a * DT; y += v * DT;
      if (y < 0) { y = 0; if (v < 0) v = 0; }
    } else {
      y += P.deriv(y, v, u, d) * DT;
    }
    if (!Number.isFinite(y) || Math.abs(y) > 1e6) { y = Math.sign(y || 1) * 1e6; }
  }
  return out;
}

function metrics(run, setpoint, disturb) {
  const { t, y } = run;
  const end = disturb ? DISTURB_AT : T_END;
  const idx = (time) => Math.round(time / DT);
  const a = idx(STEP_AT), b = idx(end);
  const seg = y.slice(a, b);
  const r = setpoint;
  const res = { overshoot: 0, rise: null, settle: null, sse: null, dist: null, unstable: false };
  if (r <= 0) return res;

  res.overshoot = Math.max(0, (Math.max(...seg) - r) / r * 100);

  const hi = seg.findIndex((x) => x >= 0.9 * r), lo = seg.findIndex((x) => x >= 0.1 * r);
  if (hi >= 0 && lo >= 0) res.rise = (hi - lo) * DT;

  let last = -1;
  for (let i = 0; i < seg.length; i++) if (Math.abs(seg[i] - r) > 0.02 * r) last = i;
  res.settle = last === seg.length - 1 ? null : (last + 1) * DT;

  const tail = seg.slice(-Math.round(0.5 / DT));
  res.sse = r - tail.reduce((s, x) => s + x, 0) / tail.length;

  if (disturb) {
    const after = y.slice(idx(DISTURB_AT));
    res.dist = Math.max(...after.map((x) => Math.abs(x - r)));
  }
  res.unstable = Math.max(...y) > 1e3 || (disturb ? false : Math.abs(res.sse) > 0.5 * r && last > seg.length * 0.9 && res.overshoot > 100);
  return res;
}

const api = { PLANTS, simulate, metrics, DT, T_END, STEP_AT, DISTURB_AT };
if (typeof module !== "undefined") module.exports = api;
else window.PIDSim = api;
})();
