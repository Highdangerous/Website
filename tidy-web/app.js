"use strict";

const CATEGORIES = {
  Images: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".heic", ".bmp"],
  Documents: [".pdf", ".doc", ".docx", ".txt", ".md", ".odt", ".rtf", ".pptx", ".ppt"],
  Spreadsheets: [".csv", ".xls", ".xlsx", ".ods"],
  Archives: [".zip", ".tar", ".gz", ".7z", ".rar", ".bz2"],
  Audio: [".mp3", ".wav", ".flac", ".m4a", ".ogg"],
  Video: [".mp4", ".mov", ".mkv", ".avi", ".webm"],
  Code: [".py", ".js", ".ts", ".html", ".css", ".json", ".sh", ".java", ".c", ".cpp"],
  Installers: [".exe", ".dmg", ".msi", ".deb", ".apk", ".pkg"],
};

const $ = (id) => document.getElementById(id);

function setStatus(msg, isError = false) {
  const el = $("status");
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

function extOf(name) {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
}

function categoryFor(name) {
  const ext = extOf(name);
  for (const [cat, exts] of Object.entries(CATEGORIES)) if (exts.includes(ext)) return cat;
  return "Other";
}

// Returns name, or "name (1).ext" etc. if already taken, and records it in `used`.
function uniqueName(name, used) {
  if (!used.has(name)) { used.add(name); return name; }
  const ext = extOf(name);
  const stem = name.slice(0, name.length - ext.length);
  let n = 1;
  while (used.has(`${stem} (${n})${ext}`)) n++;
  const result = `${stem} (${n})${ext}`;
  used.add(result);
  return result;
}

/* ---------- tiny ZIP writer (no compression, so no libraries needed) ---------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// entries: [{ path: "Images/a.png", data: Uint8Array }]
function makeZip(entries) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const { path, data } of entries) {
    const name = enc.encode(path);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
}

async function downloadZip(plan, filename) {
  setStatus("Building zip…");
  try {
    const entries = [];
    for (const { file, path } of plan) {
      entries.push({ path, data: new Uint8Array(await file.arrayBuffer()) });
    }
    const url = URL.createObjectURL(makeZip(entries));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Downloaded ${filename}.`);
  } catch {
    setStatus("Could not build the zip. Try fewer or smaller files.", true);
  }
}

/* ---------- tabs and drop zones ---------- */

document.querySelectorAll(".tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    document.querySelectorAll(".panel").forEach((p) => (p.hidden = p.id !== `tab-${btn.dataset.tab}`));
    setStatus("");
  });
});

function wireDrop(inputId, onFiles) {
  const input = $(inputId);
  const zone = input.closest(".drop");
  input.addEventListener("change", () => onFiles([...input.files]));
  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("over"); }));
  zone.addEventListener("drop", (e) => onFiles([...e.dataTransfer.files]));
}

/* ---------- organize ---------- */

let organizePlan = [];

function showOrganize(files) {
  files = files.filter((f) => !f.name.startsWith("."));
  if (!files.length) { setStatus("No files selected.", true); return; }

  const usedPerCat = {};
  organizePlan = files.map((file) => {
    const cat = categoryFor(file.name);
    const used = (usedPerCat[cat] ??= new Set());
    return { file, cat, path: `${cat}/${uniqueName(file.name, used)}` };
  });

  const groups = {};
  organizePlan.forEach((p) => (groups[p.cat] ??= []).push(p));

  const out = $("organize-result");
  out.replaceChildren();
  for (const [cat, items] of Object.entries(groups)) {
    const g = document.createElement("div");
    g.className = "group";
    const h = document.createElement("h3");
    h.textContent = `${cat} (${items.length})`;
    const ul = document.createElement("ul");
    items.forEach((i) => { const li = document.createElement("li"); li.textContent = i.file.name; ul.append(li); });
    g.append(h, ul);
    out.append(g);
  }
  $("organize-download").hidden = false;
  setStatus(`${files.length} file(s) sorted into ${Object.keys(groups).length} folder(s).`);
}

wireDrop("organize-files", showOrganize);
$("organize-download").addEventListener("click", () => downloadZip(organizePlan, "sorted-files.zip"));

/* ---------- rename ---------- */

let renameFiles = [];
let renamePlan = [];

function cleanPrefix(value) {
  // keep it safe as a file name
  return value.trim().replace(/[\\/:*?"<>|]+/g, "_") || "file";
}

function showRename() {
  if (!renameFiles.length) return;
  const prefix = cleanPrefix($("rename-prefix").value);
  const start = Math.max(0, parseInt($("rename-start").value, 10) || 0);
  const width = Math.max(3, String(start + renameFiles.length).length);

  renamePlan = renameFiles.map((file, i) => ({
    file,
    path: `${prefix}_${String(start + i).padStart(width, "0")}${extOf(file.name)}`,
  }));

  const ul = document.createElement("ul");
  ul.className = "group";
  renamePlan.forEach((p) => {
    const li = document.createElement("li");
    li.textContent = `${p.file.name}  →  ${p.path}`;
    ul.append(li);
  });
  $("rename-result").replaceChildren(ul);
  $("rename-download").hidden = false;
  setStatus(`${renamePlan.length} file(s) ready to rename.`);
}

wireDrop("rename-files", (files) => {
  renameFiles = files.filter((f) => !f.name.startsWith("."));
  if (!renameFiles.length) { setStatus("No files selected.", true); return; }
  showRename();
});
$("rename-prefix").addEventListener("input", showRename);
$("rename-start").addEventListener("input", showRename);
$("rename-download").addEventListener("click", () => downloadZip(renamePlan, "renamed-files.zip"));

/* ---------- CSV summary ---------- */

// Small CSV parser that handles quotes, escaped quotes and newlines inside quotes.
function parseCSV(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function summarise(rows) {
  const [header, ...data] = rows;
  return header.map((name, col) => {
    const values = data.map((r) => (r[col] ?? "").trim());
    const present = values.filter((v) => v !== "");
    const nums = present.map((v) => Number(v.replace(/,/g, "")));
    const info = { name: name || `column ${col + 1}`, missing: values.length - present.length, unique: new Set(present).size };
    if (present.length && nums.every((n) => Number.isFinite(n))) {
      const sorted = [...nums].sort((a, b) => a - b);
      const mid = sorted.length >> 1;
      info.type = "number";
      info.detail = `min ${sorted[0]}, max ${sorted.at(-1)}, mean ${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)}, median ${sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2}`;
    } else {
      const counts = new Map();
      present.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
      info.type = "text";
      info.detail = "top: " + ([...counts].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v, n]) => `${v} ×${n}`).join(", ") || "—");
    }
    return info;
  });
}

async function showCsv([file]) {
  if (!file) return;
  try {
    const rows = parseCSV(await file.text());
    if (rows.length < 1) { setStatus("That CSV looks empty.", true); return; }
    const cols = summarise(rows);
    const table = document.createElement("table");
    table.innerHTML = "<thead><tr><th>Column</th><th>Type</th><th>Missing</th><th>Unique</th><th>Details</th></tr></thead>";
    const body = document.createElement("tbody");
    cols.forEach((c) => {
      const tr = document.createElement("tr");
      [c.name, c.type, c.missing, c.unique, c.detail].forEach((v) => {
        const td = document.createElement("td");
        td.textContent = v;
        tr.append(td);
      });
      body.append(tr);
    });
    table.append(body);
    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `${file.name}: ${rows.length - 1} rows, ${cols.length} columns`;
    $("csv-result").replaceChildren(meta, table);
    setStatus("");
  } catch {
    setStatus("Could not read that file.", true);
  }
}

wireDrop("csv-file", showCsv);
