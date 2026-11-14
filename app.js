/* CK Makam - free browser music maker for Turkish makam music.
   Everything runs locally: Web Audio playback, loop recording, MP3/WAV/stem export. */
"use strict";

/* ---------- data ---------- */

// Measured fundamental frequency (Hz) of each bağlama sample (YIN, 48 kHz).
const BAGLAMA_F0 = {
  gl: 98.26, abl: 104.51, ab2l: 107.37, a: 110.26, bb2: 120.59, eb2: 160.57,
  e: 165.29, f: 174.28, fsharp3: 180.34, fsharp: 185.67, g: 195.87, ab: 208.17,
  cs: 209.23, ab2: 213.38, ah: 220.36, bbh: 233.47, bb: 234.8, bb2h: 240.27,
  b: 247.67, bh: 248.06, c: 261.95, ch: 262.89, cs3: 270.73, cs3h: 280.94,
  csh: 289.17, d1n: 293.94, dh: 299.11, eb: 312.66, ebh: 314.09, eh: 334.27
};

// Makam scales as 53-comma (AEU) step patterns from the tonic.
const MAKAMS = {
  "Hicaz":    [5, 12, 5, 9, 8, 5, 9],
  "Rast":     [9, 8, 5, 9, 9, 8, 5],
  "Ussak":    [8, 5, 9, 9, 8, 5, 9],
  "Kurdi":    [4, 9, 9, 9, 4, 9, 9],
  "Huzzam":   [5, 9, 5, 12, 5, 9, 8],
  "Nihavend": [9, 4, 9, 9, 4, 9, 9]
};

const TONICS = [
  ["G", 196.00], ["A", 220.00], ["Bb", 233.08],
  ["B", 246.94], ["C", 261.63], ["D", 293.66]
];

// Drum rows: darbuka strokes plus two synthesized extras Samet approved.
const DRUM_ROWS = [
  { id: "doum",  label: "Dum" },
  { id: "tek",   label: "Tek" },
  { id: "tekhi", label: "Tek hi" },
  { id: "mid",   label: "Mid" },
  { id: "mute",  label: "Ka" },
  { id: "snare", label: "Snare" },
  { id: "clap",  label: "Clap" }
];

// Usul presets. steps = cells per bar, beatGroups marks the beat borders.
// Pattern strings: X = accent, x = normal, o = soft, . = off.
const USULS = {
  "Maqsum (4/4)": {
    steps: 8, beatGroups: [2, 2, 2, 2],
    rows: { doum: "X...x...", tek: ".x.x..x." }
  },
  "Ayyub (2/4)": {
    steps: 8, beatGroups: [4, 4],
    rows: { doum: "X...x...", mute: "...o....", tek: "......x." }
  },
  "Ciftetelli (4/4)": {
    steps: 16, beatGroups: [4, 4, 4, 4],
    rows: { doum: "X.......x.x.....", tek: "...x..x.....x..." }
  },
  "Sofyan (4/4)": {
    steps: 8, beatGroups: [2, 2, 2, 2],
    rows: { doum: "X.......", tek: "....x...", mute: ".....o.." }
  },
  "Karsilama (9/8)": {
    steps: 9, beatGroups: [2, 2, 2, 3],
    rows: { doum: "X...x....", tek: "..x...x.x" }
  },
  "Aksak (9/8)": {
    steps: 9, beatGroups: [2, 2, 2, 3],
    rows: { doum: "X...x....", tek: "......x..", mute: "..o.....o" }
  },
  "Empty (4/4)": { steps: 16, beatGroups: [4, 4, 4, 4], rows: {} }
};

const SOUND_FILES = (() => {
  const m = {};
  for (const k of Object.keys(BAGLAMA_F0)) m["bag_" + k] = "sounds/baglama/" + k + ".mp3";
  for (const s of ["doum", "tek", "tekhi", "mid", "mute"]) m[s] = "sounds/darbuka/" + s + ".wav";
  m.snare = "sounds/drums/snare.wav";
  m.clap = "sounds/drums/clap.wav";
  return m;
})();

/* ---------- state ---------- */

const state = {
  bpm: 100,
  usul: "Maqsum (4/4)",
  bars: 2,
  grid: {},            // rowId -> Uint8Array(steps*bars), 0 off / 1 normal / 2 accent / 3 soft
  notes: [],           // { t: seconds into loop, keyIndex }
  playing: false,
  recording: false,
  makam: "Hicaz",
  tonic: 220.0,
  strings: "metal",
  volDrums: 0.9,
  volBaglama: 0.9
};

let ctx = null;
const buffers = {};
let nodes = null;        // live graph nodes
let keyFreqs = [];       // keyboard frequencies
let schedTimer = null;
let stepCursor = 0;      // absolute step index since play start
let nextStepTime = 0;
let loopStartTime = 0;
let scheduledNotesLoop = -1;

/* ---------- helpers ---------- */

const $ = id => document.getElementById(id);
const usulDef = () => USULS[state.usul];
const stepsPerBar = () => usulDef().steps;
const totalSteps = () => stepsPerBar() * state.bars;
function stepDur() {
  const u = usulDef();
  const beats = u.beatGroups.length;                  // quarter-ish beats per bar
  const barDur = beats * 60 / state.bpm;
  return barDur / u.steps;
}
const loopDur = () => stepDur() * totalSteps();

function pickSample(freq) {
  let best = null, bestAbs = 1e9;
  for (const [name, f0] of Object.entries(BAGLAMA_F0)) {
    const r = Math.abs(Math.log2(freq / f0));
    if (r < bestAbs) { bestAbs = r; best = name; }
  }
  return { name: "bag_" + best, rate: freq / BAGLAMA_F0[best] };
}

function buildKeyFreqs() {
  const pat = MAKAMS[state.makam];
  const freqs = [];
  let commas = -53;                                   // start one octave below tonic
  for (let oct = 0; oct < 2; oct++) {
    for (let d = 0; d < 7; d++) {
      freqs.push({ f: state.tonic * Math.pow(2, commas / 53), deg: d, oct });
      commas += pat[d];
    }
  }
  freqs.push({ f: state.tonic * Math.pow(2, commas / 53), deg: 0, oct: 2 });
  keyFreqs = freqs;
}

/* ---------- audio ---------- */

async function initAudio() {
  if (ctx) { if (ctx.state === "suspended") await ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  nodes = buildGraph(ctx);
  const entries = Object.entries(SOUND_FILES);
  await Promise.all(entries.map(async ([key, url]) => {
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    buffers[key] = await ctx.decodeAudioData(ab);
  }));
}

function buildGraph(ac) {
  const master = ac.createGain();
  master.connect(ac.destination);

  const drums = ac.createGain();
  drums.gain.value = state.volDrums;
  drums.connect(master);

  const bagIn = ac.createGain();
  const bagOut = ac.createGain();
  bagOut.gain.value = state.volBaglama;
  bagOut.connect(master);

  const metal = ac.createGain();
  bagIn.connect(metal).connect(bagOut);

  // "Plastic strings": tame the bright upper harmonics of the metal-string samples.
  const lp1 = ac.createBiquadFilter(); lp1.type = "lowpass"; lp1.frequency.value = 1600; lp1.Q.value = 0.9;
  const lp2 = ac.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 2400;
  const dip = ac.createBiquadFilter(); dip.type = "peaking"; dip.frequency.value = 700; dip.Q.value = 1.2; dip.gain.value = -7;
  const low = ac.createBiquadFilter(); low.type = "peaking"; low.frequency.value = 200; low.Q.value = 1.0; low.gain.value = 3;
  const makeup = ac.createGain(); makeup.gain.value = 1.7;
  const plastic = ac.createGain();
  bagIn.connect(lp1).connect(lp2).connect(dip).connect(low).connect(makeup).connect(plastic).connect(bagOut);

  const metalOn = state.strings === "metal";
  metal.gain.value = metalOn ? 1 : 0;
  plastic.gain.value = metalOn ? 0 : 1;

  return { master, drums, bagIn, bagOut, metal, plastic };
}

function playDrum(ac, g, rowId, time, vel) {
  const buf = buffers[rowId];
  if (!buf) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const gain = ac.createGain();
  gain.gain.value = vel;
  src.connect(gain).connect(g.drums);
  src.start(time);
}

function playBaglamaNote(ac, g, keyIndex, time, vel = 0.9) {
  const k = keyFreqs[keyIndex];
  if (!k) return;
  const pick = pickSample(k.f);
  const buf = buffers[pick.name];
  if (!buf) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pick.rate;
  const gain = ac.createGain();
  gain.gain.value = vel;
  src.connect(gain).connect(g.bagIn);
  src.start(time);
}

const VELS = [0, 0.8, 1.0, 0.5];  // off, normal, accent, soft
function humanVel(v) { return Math.max(0.1, v + (Math.random() - 0.5) * 0.08); }

/* ---------- transport ---------- */

function startPlayback() {
  stepCursor = 0;
  scheduledNotesLoop = -1;
  nextStepTime = ctx.currentTime + 0.1;
  loopStartTime = nextStepTime;
  schedTimer = setInterval(schedule, 25);
  state.playing = true;
  $("play").textContent = "Stop";
  $("play").classList.add("playing");
}

function stopPlayback() {
  clearInterval(schedTimer);
  schedTimer = null;
  state.playing = false;
  if (state.recording) toggleRec(false);
  $("play").textContent = "Play";
  $("play").classList.remove("playing");
  document.querySelectorAll(".cell.now").forEach(c => c.classList.remove("now"));
}

function schedule() {
  const ahead = ctx.currentTime + 0.12;
  while (nextStepTime < ahead) {
    const steps = totalSteps();
    const local = stepCursor % steps;
    const loopIdx = Math.floor(stepCursor / steps);
    if (local === 0) {
      loopStartTime = nextStepTime;
      if (scheduledNotesLoop < loopIdx) {
        scheduledNotesLoop = loopIdx;
        for (const n of state.notes)
          playBaglamaNote(ctx, nodes, n.keyIndex, nextStepTime + n.t);
      }
    }
    for (const row of DRUM_ROWS) {
      const v = state.grid[row.id][local];
      if (v) playDrum(ctx, nodes, row.id, nextStepTime + (Math.random() - 0.5) * 0.004, humanVel(VELS[v]));
    }
    markPlayhead(local, nextStepTime);
    stepCursor++;
    nextStepTime += stepDur();
  }
}

function markPlayhead(local, when) {
  const delay = Math.max(0, (when - ctx.currentTime) * 1000);
  setTimeout(() => {
    if (!state.playing) return;
    document.querySelectorAll(".cell.now").forEach(c => c.classList.remove("now"));
    document.querySelectorAll('.cell[data-step="' + local + '"]').forEach(c => c.classList.add("now"));
  }, delay);
}

/* ---------- grid UI ---------- */

function initGrid(applyPreset) {
  const steps = totalSteps();
  for (const row of DRUM_ROWS) {
    const old = state.grid[row.id];
    const arr = new Uint8Array(steps);
    if (!applyPreset && old) arr.set(old.subarray(0, Math.min(old.length, steps)));
    state.grid[row.id] = arr;
  }
  if (applyPreset) {
    const u = usulDef();
    for (const [rowId, pat] of Object.entries(u.rows)) {
      for (let b = 0; b < state.bars; b++)
        for (let i = 0; i < u.steps; i++) {
          const ch = pat[i];
          state.grid[rowId][b * u.steps + i] = ch === "X" ? 2 : ch === "x" ? 1 : ch === "o" ? 3 : 0;
        }
    }
  }
  renderGrid();
}

function renderGrid() {
  const u = usulDef();
  const grid = $("grid");
  grid.innerHTML = "";
  const beatStarts = new Set();
  let acc = 0;
  for (const gLen of u.beatGroups) { beatStarts.add(acc); acc += Math.round(gLen * u.steps / u.beatGroups.reduce((a, b) => a + b, 0)); }
  // simpler: compute starts in step units
  beatStarts.clear(); acc = 0;
  const unit = u.steps / u.beatGroups.reduce((a, b) => a + b, 0);
  for (const gLen of u.beatGroups) { beatStarts.add(Math.round(acc)); acc += gLen * unit; }

  for (const row of DRUM_ROWS) {
    const div = document.createElement("div");
    div.className = "row";
    const lab = document.createElement("div");
    lab.className = "rowlabel";
    lab.textContent = row.label;
    div.appendChild(lab);
    for (let i = 0; i < totalSteps(); i++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.dataset.step = i;
      if (beatStarts.has(i % u.steps)) cell.classList.add("beat");
      paintCell(cell, state.grid[row.id][i]);
      cell.addEventListener("click", () => {
        const cur = state.grid[row.id][i];
        const next = cur === 0 ? 1 : cur === 1 ? 2 : cur === 2 ? 3 : 0;
        state.grid[row.id][i] = next;
        paintCell(cell, next);
        if (next && ctx) playDrum(ctx, nodes, row.id, ctx.currentTime, VELS[next]);
      });
      div.appendChild(cell);
    }
    grid.appendChild(div);
  }
}

function paintCell(cell, v) {
  cell.classList.toggle("on", v === 1);
  cell.classList.toggle("accent", v === 2);
  cell.classList.toggle("soft", v === 3);
}

/* ---------- keyboard UI ---------- */

function renderKeys() {
  buildKeyFreqs();
  const wrap = $("keys");
  wrap.innerHTML = "";
  keyFreqs.forEach((k, i) => {
    const btn = document.createElement("button");
    btn.className = "key" + (k.deg === 0 ? " tonic" : "");
    const marks = k.oct === 0 ? "," : k.oct === 2 ? "''" : "";
    btn.innerHTML = '<span class="deg">' + (k.deg + 1) + marks + '</span><span class="freq">' + k.f.toFixed(0) + " Hz</span>";
    btn.addEventListener("pointerdown", async e => {
      e.preventDefault();
      await initAudio();
      playBaglamaNote(ctx, nodes, i, ctx.currentTime);
      btn.classList.add("active");
      setTimeout(() => btn.classList.remove("active"), 150);
      if (state.recording && state.playing) recordNote(i);
    });
    wrap.appendChild(btn);
  });
}

function recordNote(keyIndex) {
  let t = (ctx.currentTime - loopStartTime) % loopDur();
  if (t < 0) t += loopDur();
  if ($("quantize").checked) {
    const q = stepDur();
    t = Math.round(t / q) * q;
    if (t >= loopDur()) t = 0;
  }
  state.notes.push({ t, keyIndex });
  updateNoteCount();
}

function updateNoteCount() {
  $("noteCount").textContent = state.notes.length ? state.notes.length + " notes" : "";
}

function toggleRec(force) {
  state.recording = force !== undefined ? force : !state.recording;
  $("rec").classList.toggle("armed", state.recording);
  $("rec").textContent = state.recording ? "Recording" : "Record";
}

/* ---------- export ---------- */

async function renderOffline(repeats, parts) {
  const dur = loopDur() * repeats + 1.5;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * 48000), 48000);
  const g = buildGraph(oc);
  const sd = stepDur(), steps = totalSteps();
  for (let r = 0; r < repeats; r++) {
    const base = 0.05 + r * loopDur();
    if (parts.drums)
      for (let i = 0; i < steps; i++)
        for (const row of DRUM_ROWS) {
          const v = state.grid[row.id][i];
          if (v) playDrum(oc, g, row.id, base + i * sd, humanVel(VELS[v]));
        }
    if (parts.baglama)
      for (const n of state.notes) playBaglamaNote(oc, g, n.keyIndex, base + n.t);
  }
  return oc.startRendering();
}

function bufferToWav(buf) {
  const len = buf.length, ch = 2, bytes = 44 + len * ch * 2;
  const ab = new ArrayBuffer(bytes), v = new DataView(ab);
  const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, bytes - 8, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
  v.setUint32(24, 48000, true); v.setUint32(28, 48000 * ch * 2, true);
  v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, len * ch * 2, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let o = 44;
  for (let i = 0; i < len; i++) {
    v.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); o += 2;
    v.setInt16(o, Math.max(-1, Math.min(1, R[i])) * 32767, true); o += 2;
  }
  return new Uint8Array(ab);
}

function encodeMp3(buf) {
  // Runs in a Web Worker so the page does not freeze while encoding.
  return new Promise((resolve, reject) => {
    const w = new Worker("export-worker.js");
    const l = new Float32Array(buf.getChannelData(0));
    const r = new Float32Array(buf.getChannelData(1));
    w.onmessage = e => {
      e.data.error ? reject(new Error(e.data.error))
                   : resolve(new Blob(e.data.chunks, { type: "audio/mpeg" }));
      w.terminate();
    };
    w.onerror = e => { reject(new Error(e.message || "Worker error")); w.terminate(); };
    w.postMessage({ l, r }, [l.buffer, r.buffer]);
  });
}

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
}

/* minimal ZIP writer (stored, no compression) */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(d) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function makeZip(files) {
  const chunks = [], central = [];
  let offset = 0;
  const le16 = n => [n & 255, (n >> 8) & 255];
  const le32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
  for (const [name, data] of files) {
    const nameB = new TextEncoder().encode(name);
    const crc = crc32(data);
    const local = new Uint8Array([
      0x50, 0x4B, 0x03, 0x04, ...le16(20), ...le16(0), ...le16(0), ...le16(0), ...le16(0),
      ...le32(crc), ...le32(data.length), ...le32(data.length), ...le16(nameB.length), ...le16(0)
    ]);
    chunks.push(local, nameB, data);
    central.push({ nameB, crc, size: data.length, offset });
    offset += local.length + nameB.length + data.length;
  }
  const cdStart = offset;
  for (const e of central) {
    const rec = new Uint8Array([
      0x50, 0x4B, 0x01, 0x02, ...le16(20), ...le16(20), ...le16(0), ...le16(0), ...le16(0), ...le16(0),
      ...le32(e.crc), ...le32(e.size), ...le32(e.size), ...le16(e.nameB.length),
      ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(e.offset)
    ]);
    chunks.push(rec, e.nameB);
    offset += rec.length + e.nameB.length;
  }
  chunks.push(new Uint8Array([
    0x50, 0x4B, 0x05, 0x06, ...le16(0), ...le16(0), ...le16(central.length), ...le16(central.length),
    ...le32(offset - cdStart), ...le32(cdStart), ...le16(0)
  ]));
  return new Blob(chunks, { type: "application/zip" });
}

function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}

async function doExport(kind) {
  await initAudio();
  if (state.playing) stopPlayback();
  const status = $("exportStatus");
  status.textContent = "Rendering...";
  const repeats = parseInt($("repeats").value, 10);
  try {
    if (kind === "stems") {
      const [drums, bag] = [
        await renderOffline(repeats, { drums: true }),
        await renderOffline(repeats, { baglama: true })
      ];
      status.textContent = "Packing...";
      const zip = makeZip([
        ["darbuka.wav", bufferToWav(drums)],
        ["baglama.wav", bufferToWav(bag)]
      ]);
      download(zip, "ck-makam-stems-" + stamp() + ".zip");
    } else {
      const mix = await renderOffline(repeats, { drums: true, baglama: true });
      if (kind === "wav") download(new Blob([bufferToWav(mix)], { type: "audio/wav" }), "ck-makam-" + stamp() + ".wav");
      else { status.textContent = "Encoding MP3..."; download(await encodeMp3(mix), "ck-makam-" + stamp() + ".mp3"); }
    }
    status.textContent = "Done.";
  } catch (err) {
    status.textContent = "Export failed: " + err.message;
  }
  setTimeout(() => { if (status.textContent === "Done.") status.textContent = ""; }, 4000);
}

/* ---------- wiring ---------- */

function fillSelect(sel, items, selected) {
  sel.innerHTML = "";
  for (const it of items) {
    const o = document.createElement("option");
    o.value = Array.isArray(it) ? it[1] : it;
    o.textContent = Array.isArray(it) ? it[0] : it;
    if (o.textContent === selected || o.value == selected) o.selected = true;
    sel.appendChild(o);
  }
}

function init() {
  fillSelect($("usul"), Object.keys(USULS), state.usul);
  fillSelect($("makam"), Object.keys(MAKAMS), state.makam);
  fillSelect($("shift"), TONICS, "A");
  $("shift").value = "220";

  initGrid(true);
  renderKeys();

  $("play").addEventListener("click", async () => {
    await initAudio();
    state.playing ? stopPlayback() : startPlayback();
  });
  $("bpm").addEventListener("input", e => {
    state.bpm = Math.min(180, Math.max(60, +e.target.value || 100));
    $("bpmRange").value = state.bpm;
  });
  $("bpmRange").addEventListener("input", e => {
    state.bpm = +e.target.value;
    $("bpm").value = state.bpm;
  });
  $("usul").addEventListener("change", e => {
    if (state.playing) stopPlayback();
    state.usul = e.target.value;
    initGrid(true);
  });
  $("bars").addEventListener("change", e => {
    if (state.playing) stopPlayback();
    state.bars = +e.target.value;
    initGrid(false);
  });
  $("clearDrums").addEventListener("click", () => {
    for (const row of DRUM_ROWS) state.grid[row.id].fill(0);
    renderGrid();
  });
  $("makam").addEventListener("change", e => { state.makam = e.target.value; renderKeys(); });
  $("shift").addEventListener("change", e => { state.tonic = +e.target.value; renderKeys(); });
  $("strings").addEventListener("change", e => {
    state.strings = e.target.value;
    if (nodes) {
      const metalOn = state.strings === "metal";
      nodes.metal.gain.value = metalOn ? 1 : 0;
      nodes.plastic.gain.value = metalOn ? 0 : 1;
    }
  });
  $("volDrums").addEventListener("input", e => {
    state.volDrums = +e.target.value;
    if (nodes) nodes.drums.gain.value = state.volDrums;
  });
  $("volBaglama").addEventListener("input", e => {
    state.volBaglama = +e.target.value;
    if (nodes) nodes.bagOut.gain.value = state.volBaglama;
  });
  $("rec").addEventListener("click", () => toggleRec());
  $("undo").addEventListener("click", () => { state.notes.pop(); updateNoteCount(); });
  $("clearNotes").addEventListener("click", () => { state.notes = []; updateNoteCount(); });
  document.querySelectorAll("[data-export]").forEach(b =>
    b.addEventListener("click", () => doExport(b.dataset.export)));
}

init();
