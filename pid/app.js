"use strict";

const { PLANTS, simulate, metrics, T_END, STEP_AT, DISTURB_AT } = window.PIDSim;
const $ = (id) => document.getElementById(id);

const state = { plant: "motor", kp: 0, ki: 0, kd: 0, setpoint: 0, disturb: false, noise: false, windup: true };

// Round the top of the axis up so the 4 gridlines land on clean numbers (e.g. 0, 20, 40, 60, 80).
function niceMax(raw) {
  const rough = raw / 4;
  const mag = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough);
  return step * 4;
}

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ---------- drawing ---------- */

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function drawChart(canvas, { series, yMin, yMax, unit, yTicks, showX, marks }) {
  const { ctx, w, h } = setupCanvas(canvas);
  const padL = 46, padR = 10, padT = 8, padB = showX ? 22 : 6;
  const pw = w - padL - padR, ph = h - padT - padB;
  const X = (t) => padL + (t / T_END) * pw;
  const Y = (v) => padT + (1 - (v - yMin) / (yMax - yMin)) * ph;

  ctx.font = "11px Inter, system-ui, sans-serif";
  ctx.lineWidth = 1;
  ctx.strokeStyle = css("--border");
  ctx.fillStyle = css("--muted");

  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let i = 0; i <= yTicks; i++) {
    const v = yMin + ((yMax - yMin) * i) / yTicks;
    const y = Math.round(Y(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(v % 1 ? 1 : 0), padL - 6, y);
  }
  if (showX) {
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    for (let t = 0; t <= T_END; t += 2) ctx.fillText(`${t}s`, X(t), h - padB + 6);
  }

  ctx.save();
  ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();

  for (const m of marks) {
    ctx.strokeStyle = css("--muted"); ctx.setLineDash([2, 4]);
    ctx.beginPath(); ctx.moveTo(X(m.t), padT); ctx.lineTo(X(m.t), padT + ph); ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const s of series) {
    ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.setLineDash(s.dash || []);
    ctx.beginPath();
    s.values.forEach((v, i) => {
      const x = X(s.t[i]), y = Y(v);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();

  ctx.fillStyle = css("--muted"); ctx.textAlign = "left"; ctx.textBaseline = "top";
  for (const m of marks) ctx.fillText(m.label, X(m.t) + 4, padT + 2);
  if (unit) { ctx.textAlign = "left"; ctx.fillText(unit, 4, padT); }
}

/* ---------- metrics tiles ---------- */

function fmt(v, unit, digits = 2) {
  return v == null ? "—" : `${v.toFixed(digits)}${unit}`;
}

function showMetrics(m, P) {
  const tiles = [
    ["Overshoot", fmt(m.overshoot, "%", 1), m.overshoot > 25],
    ["Rise time", fmt(m.rise, " s"), false],
    ["Settling time", m.settle == null ? "never" : fmt(m.settle, " s"), m.settle == null],
    ["Steady error", fmt(m.sse, " " + P.unit), Math.abs(m.sse) > 0.05 * state.setpoint],
  ];
  if (state.disturb) tiles.push(["Worst dip after hit", fmt(m.dist, " " + P.unit), false]);
  $("metrics").replaceChildren(...tiles.map(([label, value, warn]) => {
    const d = document.createElement("div");
    d.className = "metric" + (warn ? " warn" : "");
    const l = document.createElement("span"); l.textContent = label;
    const s = document.createElement("strong"); s.textContent = value;
    d.append(l, s);
    return d;
  }));
}

/* ---------- main render ---------- */

function render() {
  const P = PLANTS[state.plant];
  const run = simulate(state.plant, {
    kp: state.kp, ki: state.ki, kd: state.kd, setpoint: state.setpoint,
    disturb: state.disturb, noise: state.noise ? 1 : 0, antiWindup: state.windup,
  });

  const maxY = Math.max(...run.y), minY = Math.min(...run.y);
  const yMax = niceMax(Math.max(state.setpoint * 1.35, Math.min(maxY * 1.05, P.setMax * 3)));
  const yMin = Math.min(0, Math.max(minY, -P.setMax));
  const marks = [{ t: STEP_AT, label: "target" }];
  if (state.disturb) marks.push({ t: DISTURB_AT, label: P.disturbance });

  drawChart($("chart"), {
    series: [
      { t: run.t, values: run.r, color: css("--muted"), width: 1.5, dash: [6, 4] },
      { t: run.t, values: run.y, color: css("--accent"), width: 2.25 },
    ],
    yMin, yMax, unit: P.unit, yTicks: 4, showX: false, marks,
  });

  const span = P.uMax - P.uMin;
  drawChart($("effort"), {
    series: [{ t: run.t, values: run.u.map((u) => ((u - P.uMin) / span) * 100), color: css("--accent-2"), width: 1.75 }],
    yMin: 0, yMax: 100, unit: "%", yTicks: 2, showX: true, marks,
  });

  const m = metrics(run, state.setpoint, state.disturb);
  showMetrics(m, P);
  $("chart").setAttribute("aria-label",
    `${P.name}: overshoot ${m.overshoot.toFixed(1)} percent, ` +
    (m.settle == null ? "does not settle" : `settles in ${m.settle.toFixed(2)} seconds`) + ".");
}

/* ---------- controls ---------- */

function syncControls() {
  const P = PLANTS[state.plant];
  $("kp").value = state.kp; $("ki").value = state.ki; $("kd").value = state.kd;
  $("sp").max = P.setMax; $("sp").value = state.setpoint;
  $("kp-out").value = state.kp.toFixed(2);
  $("ki-out").value = state.ki.toFixed(2);
  $("kd-out").value = state.kd.toFixed(2);
  $("sp-out").value = `${state.setpoint} ${P.unit}`;
  $("sp-unit").textContent = `(${P.unit})`;
}

function applyGains([kp, ki, kd]) {
  Object.assign(state, { kp, ki, kd });
  syncControls();
  render();
}

function selectPlant(key) {
  const P = PLANTS[key];
  state.plant = key;
  state.setpoint = P.setpoint;
  $("blurb").textContent = P.blurb;
  document.querySelectorAll("#plants button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.plant === key)));

  $("presets").replaceChildren(...Object.entries(P.presets).map(([name, gains]) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = name;
    b.addEventListener("click", () => applyGains(gains));
    return b;
  }), Object.assign(document.createElement("button"), { type: "button", textContent: "Reset", onclick: () => selectPlant(state.plant) }));

  applyGains(P.gains);
}

$("plants").replaceChildren(...Object.entries(PLANTS).map(([key, P]) => {
  const b = document.createElement("button");
  b.type = "button"; b.role = "tab"; b.dataset.plant = key; b.textContent = P.name;
  b.addEventListener("click", () => selectPlant(key));
  return b;
}));

for (const [id, key] of [["kp", "kp"], ["ki", "ki"], ["kd", "kd"], ["sp", "setpoint"]]) {
  $(id).addEventListener("input", () => { state[key] = parseFloat($(id).value); syncControls(); render(); });
}
for (const [id, key] of [["disturb", "disturb"], ["noise", "noise"], ["windup", "windup"]]) {
  $(id).addEventListener("change", () => { state[key] = $(id).checked; render(); });
}

window.addEventListener("resize", render);
new MutationObserver(render).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

selectPlant("motor");
document.fonts?.ready.then(render);
