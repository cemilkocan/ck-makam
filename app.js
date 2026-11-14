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
  "Hicaz":    { steps: [5, 12, 5, 9, 8, 5, 9], mood: "sad" },
  "Rast":     { steps: [9, 8, 5, 9, 9, 8, 5], mood: "happy" },
  "Çargah":   { steps: [9, 9, 4, 9, 9, 9, 4], mood: "happy" },
  "Uşşak":    { steps: [8, 5, 9, 9, 8, 5, 9], mood: "calm" },
  "Kürdi":    { steps: [4, 9, 9, 9, 4, 9, 9], mood: "sad" },
  "Hüzzam":   { steps: [5, 9, 5, 12, 5, 9, 8], mood: "sad" },
  "Nihavend": { steps: [9, 4, 9, 9, 4, 9, 9], mood: "sad" }
};

const TONICS = [
  ["G", 196.00], ["A", 220.00], ["Bb", 233.08],
  ["B", 246.94], ["C", 261.63], ["D", 293.66]
];

const DRUM_ROWS = ["doum", "tek", "tekhi", "mid", "mute",
                   "davul_dum", "davul_tek", "bendir", "zil", "tef", "snare", "clap"];

// Usul presets. steps = cells per bar, quarters = bar length in quarter notes,
// groups = cells per beat. Patterns: X strong, x normal, o soft, . off.
const USULS = {
  "Maqsum (4/4)": {
    steps: 8, quarters: 4, groups: [2, 2, 2, 2],
    rows: { doum: "X...x...", tek: ".x.x..x." }
  },
  "Ayyub (2/4)": {
    steps: 8, quarters: 2, groups: [4, 4],
    rows: { doum: "X...x...", mute: "...o....", tek: "......x." }
  },
  "Çiftetelli (4/4)": {
    steps: 16, quarters: 4, groups: [4, 4, 4, 4],
    rows: { doum: "X.......x.x.....", tek: "...x..x.....x..." }
  },
  "Sofyan (4/4)": {
    steps: 8, quarters: 4, groups: [2, 2, 2, 2],
    rows: { doum: "X.......", tek: "....x...", mute: ".....o.." }
  },
  "Karşılama (9/8)": {
    steps: 9, quarters: 4.5, groups: [2, 2, 2, 3],
    rows: { doum: "X...x....", tek: "..x...x.x" }
  },
  "Aksak (9/8)": {
    steps: 9, quarters: 4.5, groups: [2, 2, 2, 3],
    rows: { doum: "X...x....", tek: "......x..", mute: "..o.....o" }
  },
  "Düyek (8/8)": {
    steps: 8, quarters: 4, groups: [2, 2, 2, 2],
    rows: { doum: "X..x....", tek: "...x.x.x", mute: "....o..." }
  },
  "Boş (4/4)": { steps: 16, quarters: 4, groups: [4, 4, 4, 4], rows: {} }
};

const SOUND_FILES = (() => {
  const m = {};
  for (const k of Object.keys(BAGLAMA_F0)) m["bag_" + k] = "sounds/baglama/" + k + ".mp3";
  for (const s of ["doum", "tek", "tekhi", "mid", "mute"]) m[s] = "sounds/darbuka/" + s + ".wav";
  for (const s of ["davul_dum", "davul_tek", "bendir", "zil", "tef", "snare", "clap"])
    m[s] = "sounds/drums/" + s + ".wav";
  return m;
})();

/* ---------- language ---------- */

const I18N = {
  tr: {
    play: "Çal", stop: "Dur", usul: "Usul", bars: "Ölçü", clear: "Temizle", vol: "Ses",
    swing: "Salınım", theme: "Tema",
    makam: "Makam", tonic: "Karar", strings: "Tel", metal: "Metal tel", plastic: "Plastik tel",
    smart: "Akıllı dizi", smartHelp: "Açıkken dizi dışı tuşlar en yakın makam perdesine kayar, yanlış nota çalamazsın. Kapatırsan klavye tam kromatik olur, diyezler kendi sesini verir.",
    record: "Kayıt", recording: "Kaydediyor", quantize: "Gride yapış", undo: "Geri al",
    notes: "nota", export: "İndir", loops: "Tekrar", save: "Projeyi kaydet", load: "Proje aç",
    rendering: "Hazırlanıyor...", encoding: "MP3 kodlanıyor...", packing: "Paketleniyor...",
    done: "Bitti.", failed: "Hata: ", loaded: "Proje yüklendi.",
    strong: "Güçlü", normal: "Normal", soft: "Hafif", off: "Boş",
    strongT: "Aksanlı, en sert vuruş", normalT: "Normal vuruş", softT: "Kısık, yumuşak vuruş", offT: "Sessiz",
    muteTip: "Tıkla: bu satırı sustur veya aç",
    rollHint: "Boş yere tıkla, nota ekle. Notayı sürükleyerek yerini değiştir. Sağ tık siler. Gridde sağ tık vuruşu susturur, satır adına tıklamak o çalgıyı susturur.",
    midi: "MIDI bağla", midiOn: "MIDI: ", midiNone: "MIDI cihazı yok", midiNo: "Tarayıcı MIDI desteklemiyor",
    kbHint: "Bilgisayardan çal: A S D F G H J K L tuşları beyaz, W E T Y U O P siyah perdeler. Z X C V B N M darbuka. Boşluk çal/dur.",
    rotate: "Daha geniş çalışmak için telefonu yan çevir.",
    credits: "Emeği geçenler",
    creditsBody: '<a href="https://cemilkocan.com">Cemil Koçan</a> yaptı. Kulağı ve önerileri için Samet Yenipınar\'a (<a href="https://www.youtube.com/@art-s-y">ARTSY</a>) teşekkürler.',
    tagline: "Ücretsiz. Her şey tarayıcında çalışır, hiçbir veri gönderilmez.",
    noteNames: ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"],
    moods: { happy: "neşeli", sad: "hüzünlü", calm: "sakin" },
    drums: {
      doum: "Düm", tek: "Tek", tekhi: "Tek tiz", mid: "Orta", mute: "Ka",
      davul_dum: "Davul düm", davul_tek: "Davul çubuk", bendir: "Bendir",
      zil: "Zil", tef: "Tef", snare: "Trampet", clap: "Alkış"
    },
    usulInfo: {
      "Maqsum (4/4)": "Arap ve Türk popunun en çok duyulan ritmi. Düm tek tek, düm tek. Oynak ve tanıdık.",
      "Ayyub (2/4)": "Hızlı dönen iki zamanlı kalıp. Göbek dansında ve sufi müziğinde duyarsın.",
      "Çiftetelli (4/4)": "Düğün ritmi. Vuruşlar aralıklı, salınan bir his verir.",
      "Sofyan (4/4)": "Dört zamanlı en sade usul. Yeni başlayan için iyi bir zemin.",
      "Karşılama (9/8)": "Trakya'nın dokuz zamanlısı. 2+2+2+3 sayılır, son grup uzundur.",
      "Aksak (9/8)": "Halk müziğinin temel aksak kalıbı. 2+2+2+3, topallayan bir yürüyüş gibi.",
      "Düyek (8/8)": "Fasıl ve ilahilerde çok kullanılan sekiz zamanlı usul. Ağır ve oturaklı.",
      "Boş (4/4)": "Hiçbir vuruş yok. Kendi ritmini sıfırdan kurmak için."
    },
    makamInfo: {
      "Hicaz": "Hüzünlü ve doğulu. İkinci perde pes, üçüncü perde tiz; aradaki geniş aralık onu tanınır kılar.",
      "Rast": "Neşeli ve kararlı. Batı majörüne en yakın makam, üçüncü ve yedinci perdeler biraz pes.",
      "Çargah": "Açık ve neşeli. Batı majör dizisinin tam karşılığı, kulağa en alışık gelen makam.",
      "Uşşak": "Sakin ve içli. Türk halk müziğinin en çok kullanılan dizisi.",
      "Kürdi": "Üzgün ve yalın. İkinci perde pes olduğu için baştan koyu bir renk verir.",
      "Hüzzam": "Dokunaklı, kıvrımlı. Hicaz'a benzer ama karar sesi başka yerde durur.",
      "Nihavend": "Romantik ve üzgün. Batı minörünün karşılığı."
    }
  },
  en: {
    play: "Play", stop: "Stop", usul: "Usul", bars: "Bars", clear: "Clear", vol: "Vol",
    swing: "Swing", theme: "Theme",
    makam: "Makam", tonic: "Tonic", strings: "Strings", metal: "Metal strings", plastic: "Plastic strings",
    smart: "Smart scale", smartHelp: "When on, out-of-scale keys snap to the nearest makam pitch, so you cannot play a wrong note. Turn it off for a fully chromatic keyboard where sharps play their own pitch.",
    record: "Record", recording: "Recording", quantize: "Snap to grid", undo: "Undo",
    notes: "notes", export: "Export", loops: "Loops", save: "Save project", load: "Open project",
    rendering: "Rendering...", encoding: "Encoding MP3...", packing: "Packing...",
    done: "Done.", failed: "Error: ", loaded: "Project loaded.",
    strong: "Strong", normal: "Normal", soft: "Soft", off: "Off",
    strongT: "Accented, hardest stroke", normalT: "Normal stroke", softT: "Muted, gentle stroke", offT: "Silent",
    muteTip: "Click to mute or unmute this row",
    rollHint: "Click an empty spot to add a note. Drag a note to move it. Right-click deletes it. In the grid, right-click silences a stroke and clicking a row name mutes that drum.",
    midi: "Connect MIDI", midiOn: "MIDI: ", midiNone: "No MIDI device", midiNo: "Browser has no MIDI support",
    kbHint: "Play from the computer: A S D F G H J K L are white keys, W E T Y U O P are black. Z X C V B N M hit the drums. Space starts and stops.",
    rotate: "Turn the phone sideways for more room.",
    credits: "Credits",
    creditsBody: 'Made by <a href="https://cemilkocan.com">Cemil Koçan</a>. Thanks to Samet Yenipınar (<a href="https://www.youtube.com/@art-s-y">ARTSY</a>) for his ears and advice.',
    tagline: "Free. Everything runs in your browser, nothing is uploaded.",
    noteNames: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    moods: { happy: "bright", sad: "melancholic", calm: "calm" },
    drums: {
      doum: "Dum", tek: "Tek", tekhi: "Tek hi", mid: "Mid", mute: "Ka",
      davul_dum: "Davul low", davul_tek: "Davul stick", bendir: "Bendir",
      zil: "Zil", tef: "Tef", snare: "Snare", clap: "Clap"
    },
    usulInfo: {
      "Maqsum (4/4)": "The most common rhythm in Arabic and Turkish pop. Dum tek tek, dum tek. Bouncy and familiar.",
      "Ayyub (2/4)": "A fast turning two-beat pattern, heard in belly dance and sufi music.",
      "Çiftetelli (4/4)": "The wedding rhythm. Spaced-out strokes with a swaying feel.",
      "Sofyan (4/4)": "The simplest four-beat usul. A good starting point.",
      "Karşılama (9/8)": "The nine-beat rhythm of Thrace, counted 2+2+2+3 with a long last group.",
      "Aksak (9/8)": "The core limping folk pattern, 2+2+2+3, like a walk with a hitch in it.",
      "Düyek (8/8)": "An eight-beat usul common in classical and devotional music. Steady and grounded.",
      "Boş (4/4)": "Empty grid. Build your own rhythm from scratch."
    },
    makamInfo: {
      "Hicaz": "Melancholic and eastern. The flat second and raised third leave a wide gap that makes it instantly recognisable.",
      "Rast": "Bright and settled. The closest makam to a Western major scale, with a slightly lower third and seventh.",
      "Çargah": "Open and cheerful. The exact equivalent of the Western major scale.",
      "Uşşak": "Calm and inward. The most used scale in Turkish folk music.",
      "Kürdi": "Sad and plain. The flat second gives it a dark colour from the first note.",
      "Hüzzam": "Poignant and winding. Close to Hicaz but it comes to rest elsewhere.",
      "Nihavend": "Romantic and sad. The equivalent of the Western minor scale."
    }
  }
};

let lang = "tr";
let theme = "toprak";
try {
  lang = localStorage.getItem("ckm_lang") || "tr";
  theme = localStorage.getItem("ckm_theme") || "toprak";
} catch (e) {}
const t = k => I18N[lang][k];

const THEMES = { toprak: "Toprak", gece: "Gece", orman: "Orman", gul: "Gül", komur: "Kömür" };

/* ---------- state ---------- */

const state = {
  bpm: 100, usul: "Maqsum (4/4)", bars: 2, swing: 0,
  grid: {}, notes: [], muted: new Set(),
  playing: false, recording: false,
  makam: "Hicaz", tonic: 220.0, smart: true, strings: "metal",
  volDrums: 0.9, volBaglama: 0.9
};

let ctx = null, nodes = null;
const buffers = {};
let keys = [];                 // piano keys: { midi, white, freq, inScale, isTonic }
let schedTimer = null, stepCursor = 0, nextStepTime = 0, loopStartTime = 0, scheduledLoop = -1, rafId = 0;
const held = new Set();

/* ---------- helpers ---------- */

const $ = id => document.getElementById(id);
const usulDef = () => USULS[state.usul];
const totalSteps = () => usulDef().steps * state.bars;
const stepDur = () => usulDef().quarters * 60 / state.bpm / usulDef().steps;
const loopDur = () => stepDur() * totalSteps();
const swingShift = i => (i % 2 === 1 ? state.swing * stepDur() * 0.5 : 0);

const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
const isWhite = m => WHITE_PCS.includes(((m % 12) + 12) % 12);
const midiToName = m => t("noteNames")[((m % 12) + 12) % 12] + Math.floor(m / 12);

function pickSample(freq) {
  let best = null, bestDist = 1e9;
  for (const [name, f0] of Object.entries(BAGLAMA_F0)) {
    const d = Math.abs(Math.log2(freq / f0));
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return { name: "bag_" + best, rate: freq / BAGLAMA_F0[best] };
}

/* ---------- keyboard model ---------- */

function buildKeys() {
  const pat = MAKAMS[state.makam].steps;
  const tonicMidi = Math.round(69 + 12 * Math.log2(state.tonic / 440));

  // Makam degrees over two octaves, measured in commas from an octave below the tonic.
  const degrees = [];
  let commas = -53;
  for (let oct = 0; oct < 2; oct++)
    for (let d = 0; d < 7; d++) { degrees.push({ commas, deg: d }); commas += pat[d]; }
  degrees.push({ commas, deg: 0 });

  let lo = tonicMidi - 12, hi = tonicMidi + 12;
  while (!isWhite(lo)) lo--;
  while (!isWhite(hi)) hi++;

  keys = [];
  for (let m = lo; m <= hi; m++) {
    const cents = (m - tonicMidi) * 100;
    const hit = degrees.find(d => Math.abs(d.commas * 1200 / 53 - cents) < 25);
    keys.push({
      midi: m,
      white: isWhite(m),
      freq: hit ? state.tonic * Math.pow(2, hit.commas / 53)
                : state.tonic * Math.pow(2, (m - tonicMidi) / 12),
      inScale: !!hit,
      isTonic: hit ? hit.deg === 0 : false,
      cents
    });
  }
  // Smart scale: an out-of-scale key snaps to the nearest makam pitch.
  for (const k of keys) {
    if (k.inScale) { k.snapFreq = k.freq; continue; }
    let best = degrees[0], bd = 1e9;
    for (const d of degrees) {
      const dist = Math.abs(d.commas * 1200 / 53 - k.cents);
      if (dist < bd) { bd = dist; best = d; }
    }
    k.snapFreq = state.tonic * Math.pow(2, best.commas / 53);
  }
}

const keyFreq = k => (state.smart ? k.snapFreq : k.freq);

/* ---------- audio ---------- */

async function initAudio() {
  if (ctx) { if (ctx.state === "suspended") await ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  nodes = buildGraph(ctx);
  await Promise.all(Object.entries(SOUND_FILES).map(async ([key, url]) => {
    const res = await fetch(url);
    buffers[key] = await ctx.decodeAudioData(await res.arrayBuffer());
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

  // Plastic strings: tame the bright upper harmonics of the metal-string samples.
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
  src.start(Math.max(time, ac.currentTime));
}

function playNote(ac, g, freq, time, vel = 0.9) {
  const pick = pickSample(freq);
  const buf = buffers[pick.name];
  if (!buf) return;
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = pick.rate;
  const gain = ac.createGain();
  gain.gain.value = vel;
  src.connect(gain).connect(g.bagIn);
  src.start(Math.max(time, ac.currentTime));
}

const VELS = [0, 0.8, 1.0, 0.5];                 // off, normal, strong, soft
const humanVel = v => Math.max(0.1, v + (Math.random() - 0.5) * 0.08);

/* ---------- transport ---------- */

function startPlayback() {
  stepCursor = 0; scheduledLoop = -1;
  nextStepTime = loopStartTime = ctx.currentTime + 0.1;
  schedTimer = setInterval(schedule, 25);
  state.playing = true;
  $("play").textContent = t("stop");
  $("play").classList.add("playing");
  rafId = requestAnimationFrame(movePlayhead);
}

function movePlayhead() {
  const ph = $("playhead");
  if (ph && ctx) {
    let p = (ctx.currentTime - loopStartTime) % loopDur();
    if (p < 0) p += loopDur();
    ph.style.top = (p / loopDur()) * rollH() + "px";
  }
  if (state.playing) rafId = requestAnimationFrame(movePlayhead);
}

function stopPlayback() {
  clearInterval(schedTimer); schedTimer = null;
  cancelAnimationFrame(rafId);
  state.playing = false;
  if (state.recording) toggleRec(false);
  $("play").textContent = t("play");
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
      if (scheduledLoop < loopIdx) {
        scheduledLoop = loopIdx;
        for (const n of state.notes) playNote(ctx, nodes, n.f, nextStepTime + n.t, n.vel);
      }
    }
    const at = nextStepTime + swingShift(local);
    for (const row of DRUM_ROWS) {
      if (state.muted.has(row)) continue;
      const v = state.grid[row][local];
      if (v) playDrum(ctx, nodes, row, at + (Math.random() - 0.5) * 0.004, humanVel(VELS[v]));
    }
    markPlayhead(local, nextStepTime);
    stepCursor++;
    nextStepTime += stepDur();
  }
}

function markPlayhead(local, when) {
  setTimeout(() => {
    if (!state.playing) return;
    document.querySelectorAll(".cell.now").forEach(c => c.classList.remove("now"));
    document.querySelectorAll('.cell[data-step="' + local + '"]').forEach(c => c.classList.add("now"));
  }, Math.max(0, (when - ctx.currentTime) * 1000));
}

/* ---------- drum grid ---------- */

function initGrid(applyPreset) {
  const steps = totalSteps();
  for (const row of DRUM_ROWS) {
    const old = state.grid[row];
    const arr = new Uint8Array(steps);
    if (!applyPreset && old) arr.set(old.subarray(0, Math.min(old.length, steps)));
    state.grid[row] = arr;
  }
  if (applyPreset) {
    const u = usulDef();
    for (const [rowId, pat] of Object.entries(u.rows))
      for (let b = 0; b < state.bars; b++)
        for (let i = 0; i < u.steps; i++) {
          const ch = pat[i];
          state.grid[rowId][b * u.steps + i] = ch === "X" ? 2 : ch === "x" ? 1 : ch === "o" ? 3 : 0;
        }
  }
  renderGrid();
}

function renderGrid() {
  const u = usulDef();
  const beatStarts = new Set();
  let acc = 0;
  for (const g of u.groups) { beatStarts.add(acc); acc += g; }

  const grid = $("grid");
  grid.innerHTML = "";
  for (const row of DRUM_ROWS) {
    const div = document.createElement("div");
    div.className = "row";
    const lab = document.createElement("button");
    lab.className = "rowlabel" + (state.muted.has(row) ? " muted" : "");
    lab.textContent = t("drums")[row];
    lab.title = t("muteTip");
    const toggleMute = e => {
      e.preventDefault();
      state.muted.has(row) ? state.muted.delete(row) : state.muted.add(row);
      lab.classList.toggle("muted", state.muted.has(row));
    };
    lab.addEventListener("click", toggleMute);
    lab.addEventListener("contextmenu", toggleMute);
    div.appendChild(lab);
    for (let i = 0; i < totalSteps(); i++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.dataset.step = i;
      if (beatStarts.has(i % u.steps)) cell.classList.add("beat");
      paintCell(cell, state.grid[row][i]);
      cell.addEventListener("click", async () => {
        const cur = state.grid[row][i];
        const next = cur === 0 ? 1 : cur === 1 ? 2 : cur === 2 ? 3 : 0;
        state.grid[row][i] = next;
        paintCell(cell, next);
        if (next) { await initAudio(); playDrum(ctx, nodes, row, ctx.currentTime, VELS[next]); }
      });
      // Right-click silences the cell outright instead of cycling through.
      cell.addEventListener("contextmenu", e => {
        e.preventDefault();
        state.grid[row][i] = 0;
        paintCell(cell, 0);
      });
      div.appendChild(cell);
    }
    grid.appendChild(div);
  }
}

function paintCell(cell, v) {
  cell.classList.toggle("on", v === 1);
  cell.classList.toggle("strong", v === 2);
  cell.classList.toggle("soft", v === 3);
}

/* ---------- piano ---------- */

let layout = { width: 0 };

function renderKeys() {
  buildKeys();
  const wide = window.innerWidth > 760;
  const WW = wide ? 46 : 38, BW = wide ? 28 : 23;
  const piano = $("piano");
  piano.innerHTML = "";

  const whites = document.createElement("div");
  whites.className = "whites";
  const blacks = document.createElement("div");
  blacks.className = "blacks";

  let whiteCount = 0;
  keys.forEach((k, i) => {
    const btn = document.createElement("button");
    btn.className = (k.white ? "wkey" : "bkey") +
      (k.isTonic ? " tonic" : "") + (k.inScale ? " inscale" : " outscale");
    btn.dataset.i = i;
    btn.innerHTML = '<span class="lbl">' + midiToName(k.midi) + "</span>";
    btn.title = Math.round(keyFreq(k)) + " Hz";
    btn.addEventListener("pointerdown", e => { e.preventDefault(); hitKey(i); });
    if (k.white) {
      k.x = whiteCount * WW; k.w = WW;
      btn.style.width = WW + "px";
      whites.appendChild(btn);
      whiteCount++;
    } else {
      k.x = whiteCount * WW - BW / 2; k.w = BW;
      btn.style.width = BW + "px";
      btn.style.left = k.x + "px";
      blacks.appendChild(btn);
    }
  });
  layout.width = whiteCount * WW;
  whites.style.width = layout.width + "px";
  piano.appendChild(whites);
  piano.appendChild(blacks);
  $("rollInner").style.width = layout.width + "px";
  $("kbHint").textContent = t("kbHint");
  renderRoll();
}

async function hitKey(i, vel = 0.9) {
  const k = keys[i];
  if (!k) return;
  await initAudio();
  playNote(ctx, nodes, keyFreq(k), ctx.currentTime, vel);
  const btn = document.querySelector('[data-i="' + i + '"]');
  if (btn) { btn.classList.add("active"); setTimeout(() => btn.classList.remove("active"), 140); }
  if (state.recording && state.playing) recordNote(k, vel);
}

function recordNote(k, vel) {
  let time = (ctx.currentTime - loopStartTime) % loopDur();
  if (time < 0) time += loopDur();
  if ($("quantize").checked) {
    const q = stepDur();
    time = Math.round(time / q) * q;
    if (time >= loopDur()) time = 0;
  }
  state.notes.push({ t: time, f: keyFreq(k), midi: k.midi, vel, len: stepDur() });
  updateNoteCount();
  renderRoll();
}

/* ---------- piano roll: notes fall from the top down to the keyboard ---------- */

const rollH = () => (window.innerWidth > 760 ? 260 : 180);
const keyByMidi = m => keys.find(k => k.midi === m);

function keyAtX(x) {
  for (const k of keys) if (!k.white && x >= k.x && x < k.x + k.w) return k;   // black keys sit on top
  for (const k of keys) if (k.white && x >= k.x && x < k.x + k.w) return k;
  return null;
}

function placeNote(el, n) {
  const k = keyByMidi(n.midi) || keys[0];
  const h = rollH();
  el.style.left = k.x + "px";
  el.style.width = k.w + "px";
  el.style.top = (n.t / loopDur()) * h + "px";
  el.style.height = Math.max(9, (n.len / loopDur()) * h) + "px";
  el.classList.toggle("black", !k.white);
}

function renderRoll() {
  const roll = $("roll");
  if (!roll) return;
  const h = rollH(), u = usulDef();
  roll.style.height = h + "px";
  roll.innerHTML = "";

  // step and beat lines
  const beatStarts = new Set();
  let acc = 0;
  for (const g of u.groups) { beatStarts.add(acc); acc += g; }
  for (let i = 0; i < totalSteps(); i++) {
    const line = document.createElement("div");
    line.className = "rline" + (beatStarts.has(i % u.steps) ? " beat" : "");
    line.style.top = (i / totalSteps()) * h + "px";
    roll.appendChild(line);
  }
  // lane shading for keys outside the makam
  for (const k of keys) {
    if (k.inScale || !k.white) continue;
    const lane = document.createElement("div");
    lane.className = "lane";
    lane.style.left = k.x + "px";
    lane.style.width = k.w + "px";
    roll.appendChild(lane);
  }

  for (const n of state.notes) {
    if (n.midi === undefined) {                       // notes from an older project file
      let best = keys[0], bd = 1e9;
      for (const k of keys) { const d = Math.abs(Math.log2(n.f / keyFreq(k))); if (d < bd) { bd = d; best = k; } }
      n.midi = best.midi;
    }
    if (n.len === undefined) n.len = stepDur();
    const el = document.createElement("div");
    el.className = "note";
    placeNote(el, n);
    el.addEventListener("pointerdown", e => startDrag(e, n, el));
    el.addEventListener("contextmenu", e => {
      e.preventDefault();
      state.notes.splice(state.notes.indexOf(n), 1);
      updateNoteCount();
      renderRoll();
    });
    roll.appendChild(el);
  }

  const ph = document.createElement("div");
  ph.className = "playhead";
  ph.id = "playhead";
  roll.appendChild(ph);

  // click on empty space adds a note
  roll.onpointerdown = async e => {
    if (e.target !== roll) return;
    const r = roll.getBoundingClientRect();
    const k = keyAtX(e.clientX - r.left);
    if (!k) return;
    let time = (e.clientY - r.top) / h * loopDur();
    if ($("quantize").checked) time = Math.round(time / stepDur()) * stepDur();
    time = Math.max(0, Math.min(time, loopDur() - stepDur() / 2));
    state.notes.push({ t: time, f: keyFreq(k), midi: k.midi, vel: 0.9, len: stepDur() });
    updateNoteCount();
    renderRoll();
    await initAudio();
    playNote(ctx, nodes, keyFreq(k), ctx.currentTime);
  };
}

function startDrag(e, n, el) {
  e.preventDefault();
  e.stopPropagation();
  const roll = $("roll"), r = roll.getBoundingClientRect(), h = rollH();
  const grabY = e.clientY - r.top - (n.t / loopDur()) * h;
  el.setPointerCapture(e.pointerId);
  el.classList.add("dragging");

  const move = ev => {
    let time = (ev.clientY - r.top - grabY) / h * loopDur();
    if ($("quantize").checked) time = Math.round(time / stepDur()) * stepDur();
    n.t = Math.max(0, Math.min(time, loopDur() - stepDur() / 2));
    const k = keyAtX(ev.clientX - r.left);
    if (k) { n.midi = k.midi; n.f = keyFreq(k); }
    placeNote(el, n);
  };
  const up = () => {
    el.classList.remove("dragging");
    el.removeEventListener("pointermove", move);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
  el.addEventListener("pointermove", move);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
}

function updateNoteCount() {
  $("noteCount").textContent = state.notes.length ? state.notes.length + " " + t("notes") : "";
}

function toggleRec(force) {
  state.recording = force !== undefined ? force : !state.recording;
  $("rec").classList.toggle("armed", state.recording);
  $("rec").textContent = state.recording ? t("recording") : t("record");
}

/* ---------- computer keyboard and MIDI ---------- */

const KEY_MAP = {
  KeyA: 0, KeyW: 1, KeyS: 2, KeyE: 3, KeyD: 4, KeyF: 5, KeyT: 6, KeyG: 7,
  KeyY: 8, KeyH: 9, KeyU: 10, KeyJ: 11, KeyK: 12, KeyO: 13, KeyL: 14,
  KeyP: 15, Semicolon: 16, Quote: 17
};
const DRUM_KEYS = ["KeyZ", "KeyX", "KeyC", "KeyV", "KeyB", "KeyN", "KeyM"];

function onKeyDown(e) {
  if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "select" || tag === "textarea") return;

  if (e.code === "Space") {
    e.preventDefault();
    initAudio().then(() => state.playing ? stopPlayback() : startPlayback());
    return;
  }
  const di = DRUM_KEYS.indexOf(e.code);
  if (di >= 0) {
    e.preventDefault();
    initAudio().then(() => playDrum(ctx, nodes, DRUM_ROWS[di], ctx.currentTime, 1.0));
    return;
  }
  const off = KEY_MAP[e.code];
  if (off === undefined) return;
  e.preventDefault();
  const start = keys.findIndex(k => k.midi >= keys[0].midi + 12);
  const i = (start < 0 ? 0 : start) + off;
  if (!held.has(e.code)) { held.add(e.code); hitKey(i); }
}

function onKeyUp(e) { held.delete(e.code); }

async function connectMidi() {
  const st = $("midiStatus");
  if (!navigator.requestMIDIAccess) { st.textContent = t("midiNo"); return; }
  try {
    const access = await navigator.requestMIDIAccess();
    const bind = () => {
      const names = [];
      for (const inp of access.inputs.values()) { inp.onmidimessage = onMidi; names.push(inp.name); }
      st.textContent = names.length ? t("midiOn") + names.join(", ") : t("midiNone");
    };
    bind();
    access.onstatechange = bind;
  } catch (err) {
    st.textContent = t("failed") + err.message;
  }
}

function onMidi(msg) {
  const [status, note, vel] = msg.data;
  if ((status & 0xf0) !== 0x90 || !vel) return;
  let i = keys.findIndex(k => k.midi === note);
  if (i < 0) {                                  // fold octaves into the visible range
    const lo = keys[0].midi, hi = keys[keys.length - 1].midi;
    let n = note;
    while (n < lo) n += 12;
    while (n > hi) n -= 12;
    i = keys.findIndex(k => k.midi === n);
  }
  if (i >= 0) hitKey(i, Math.max(0.2, vel / 127));
}

/* ---------- export ---------- */

async function renderOffline(repeats, parts) {
  const dur = loopDur() * repeats + 1.8;
  const oc = new OfflineAudioContext(2, Math.ceil(dur * 48000), 48000);
  const g = buildGraph(oc);
  const sd = stepDur(), steps = totalSteps();
  for (let r = 0; r < repeats; r++) {
    const base = 0.05 + r * loopDur();
    if (parts.drums)
      for (let i = 0; i < steps; i++)
        for (const row of DRUM_ROWS) {
          if (state.muted.has(row)) continue;
          const v = state.grid[row][i];
          if (v) playDrum(oc, g, row, base + i * sd + swingShift(i), humanVel(VELS[v]));
        }
    if (parts.baglama)
      for (const n of state.notes) playNote(oc, g, n.f, base + n.t, n.vel);
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

const CRC_TABLE = (() => {
  const tb = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    tb[n] = c >>> 0;
  }
  return tb;
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
    const local = new Uint8Array([0x50, 0x4B, 0x03, 0x04, ...le16(20), ...le16(0), ...le16(0),
      ...le16(0), ...le16(0), ...le32(crc), ...le32(data.length), ...le32(data.length),
      ...le16(nameB.length), ...le16(0)]);
    chunks.push(local, nameB, data);
    central.push({ nameB, crc, size: data.length, offset });
    offset += local.length + nameB.length + data.length;
  }
  const cdStart = offset;
  for (const e of central) {
    const rec = new Uint8Array([0x50, 0x4B, 0x01, 0x02, ...le16(20), ...le16(20), ...le16(0),
      ...le16(0), ...le16(0), ...le16(0), ...le32(e.crc), ...le32(e.size), ...le32(e.size),
      ...le16(e.nameB.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0),
      ...le32(e.offset)]);
    chunks.push(rec, e.nameB);
    offset += rec.length + e.nameB.length;
  }
  chunks.push(new Uint8Array([0x50, 0x4B, 0x05, 0x06, ...le16(0), ...le16(0),
    ...le16(central.length), ...le16(central.length), ...le32(offset - cdStart), ...le32(cdStart), ...le16(0)]));
  return new Blob(chunks, { type: "application/zip" });
}

function stamp() {
  const d = new Date(), p = n => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
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
  status.textContent = t("rendering");
  const repeats = parseInt($("repeats").value, 10);
  try {
    if (kind === "stems") {
      const drums = await renderOffline(repeats, { drums: true });
      const bag = await renderOffline(repeats, { baglama: true });
      status.textContent = t("packing");
      download(makeZip([["darbuka.wav", bufferToWav(drums)], ["baglama.wav", bufferToWav(bag)]]),
               "ck-makam-stems-" + stamp() + ".zip");
    } else {
      const mix = await renderOffline(repeats, { drums: true, baglama: true });
      if (kind === "wav")
        download(new Blob([bufferToWav(mix)], { type: "audio/wav" }), "ck-makam-" + stamp() + ".wav");
      else {
        status.textContent = t("encoding");
        download(await encodeMp3(mix), "ck-makam-" + stamp() + ".mp3");
      }
    }
    status.textContent = t("done");
  } catch (err) {
    status.textContent = t("failed") + err.message;
  }
  setTimeout(() => { if (status.textContent === t("done")) status.textContent = ""; }, 4000);
}

/* ---------- project files ---------- */

function saveProject() {
  const data = {
    v: 1, bpm: state.bpm, usul: state.usul, bars: state.bars, swing: state.swing,
    makam: state.makam, tonic: state.tonic, smart: state.smart, strings: state.strings,
    notes: state.notes,
    grid: Object.fromEntries(DRUM_ROWS.map(r => [r, Array.from(state.grid[r])]))
  };
  download(new Blob([JSON.stringify(data)], { type: "application/json" }),
           "ck-makam-" + stamp() + ".ckm.json");
}

function loadProject(file) {
  const fr = new FileReader();
  fr.onload = () => {
    try {
      const d = JSON.parse(fr.result);
      if (state.playing) stopPlayback();
      state.bpm = d.bpm; state.usul = USULS[d.usul] ? d.usul : state.usul;
      state.bars = d.bars; state.swing = d.swing || 0;
      state.makam = MAKAMS[d.makam] ? d.makam : state.makam;
      state.tonic = d.tonic; state.smart = !!d.smart; state.strings = d.strings || "metal";
      state.notes = Array.isArray(d.notes) ? d.notes : [];
      initGrid(false);
      for (const r of DRUM_ROWS)
        if (d.grid && d.grid[r]) state.grid[r] = Uint8Array.from(d.grid[r].slice(0, totalSteps()));
      $("bpm").value = $("bpmRange").value = state.bpm;
      $("usul").value = state.usul; $("bars").value = state.bars;
      $("swing").value = state.swing; $("makam").value = state.makam;
      $("shift").value = state.tonic; $("smart").checked = state.smart;
      $("strings").value = state.strings;
      if (nodes) {
        const metalOn = state.strings === "metal";
        nodes.metal.gain.value = metalOn ? 1 : 0;
        nodes.plastic.gain.value = metalOn ? 0 : 1;
      }
      renderGrid(); renderKeys(); updateNoteCount(); updateInfo();
      $("exportStatus").textContent = t("loaded");
    } catch (err) {
      $("exportStatus").textContent = t("failed") + err.message;
    }
  };
  fr.readAsText(file);
}

/* ---------- UI wiring ---------- */

function fillSelect(sel, items, selected) {
  sel.innerHTML = "";
  for (const it of items) {
    const o = document.createElement("option");
    o.value = Array.isArray(it) ? it[1] : it;
    o.textContent = Array.isArray(it) ? it[0] : it;
    if (o.value == selected) o.selected = true;
    sel.appendChild(o);
  }
}

function fillMakams() {
  const sel = $("makam");
  sel.innerHTML = "";
  for (const [name, m] of Object.entries(MAKAMS)) {
    const o = document.createElement("option");
    o.value = name;
    o.textContent = name + " (" + t("moods")[m.mood] + ")";
    if (name === state.makam) o.selected = true;
    sel.appendChild(o);
  }
}

function renderLegend() {
  const items = [["normal", "normalT"], ["strong", "strongT"], ["soft", "softT"], ["off", "offT"]];
  $("legend").innerHTML = items.map(([k, tip]) =>
    '<span class="lg" title="' + t(tip) + '"><span class="sw ' + k + '"></span>' + t(k) + "</span>"
  ).join("");
}

function updateInfo() {
  const ui = t("usulInfo")[state.usul] || "";
  const mi = t("makamInfo")[state.makam] || "";
  $("usulHelp").title = ui;
  $("makamHelp").title = mi;
  $("usulInfo").textContent = ui;
  $("makamInfo").textContent = mi;
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  $("lang").textContent = lang === "tr" ? "EN" : "TR";
  const s = $("strings");
  s.innerHTML = "";
  for (const v of ["metal", "plastic"]) {
    const o = document.createElement("option");
    o.value = v; o.textContent = t(v);
    if (v === state.strings) o.selected = true;
    s.appendChild(o);
  }
  $("smartHelp").title = t("smartHelp");
  $("play").textContent = state.playing ? t("stop") : t("play");
  $("rec").textContent = state.recording ? t("recording") : t("record");
  fillMakams();
  renderLegend();
  renderGrid();
  renderKeys();
  updateNoteCount();
  updateInfo();
}

function applyTheme() {
  document.documentElement.dataset.theme = theme;
  $("themeSel").value = theme;
}

function init() {
  fillSelect($("usul"), Object.keys(USULS), state.usul);
  fillSelect($("shift"), TONICS, state.tonic);
  fillSelect($("themeSel"), Object.entries(THEMES).map(([k, v]) => [v, k]), theme);

  applyTheme();
  initGrid(true);
  applyLang();

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
  $("swing").addEventListener("input", e => { state.swing = +e.target.value; });
  $("lang").addEventListener("click", () => {
    lang = lang === "tr" ? "en" : "tr";
    try { localStorage.setItem("ckm_lang", lang); } catch (e) {}
    applyLang();
  });
  $("themeSel").addEventListener("change", e => {
    theme = e.target.value;
    try { localStorage.setItem("ckm_theme", theme); } catch (e) {}
    applyTheme();
  });
  $("usul").addEventListener("change", e => {
    if (state.playing) stopPlayback();
    state.usul = e.target.value;
    initGrid(true);
    updateInfo();
  });
  $("bars").addEventListener("change", e => {
    if (state.playing) stopPlayback();
    state.bars = +e.target.value;
    initGrid(false);
  });
  $("clearDrums").addEventListener("click", () => {
    for (const row of DRUM_ROWS) state.grid[row].fill(0);
    renderGrid();
  });
  $("makam").addEventListener("change", e => { state.makam = e.target.value; renderKeys(); updateInfo(); });
  $("shift").addEventListener("change", e => { state.tonic = +e.target.value; renderKeys(); });
  $("smart").addEventListener("change", e => { state.smart = e.target.checked; renderKeys(); });
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
  $("undo").addEventListener("click", () => { state.notes.pop(); updateNoteCount(); renderRoll(); });
  $("clearNotes").addEventListener("click", () => { state.notes = []; updateNoteCount(); renderRoll(); });
  $("midiBtn").addEventListener("click", connectMidi);
  $("usulHelp").addEventListener("click", () => $("usulInfo").classList.toggle("open"));
  $("makamHelp").addEventListener("click", () => $("makamInfo").classList.toggle("open"));
  $("smartHelp").addEventListener("click", () => $("makamInfo").classList.toggle("open"));
  $("saveBtn").addEventListener("click", saveProject);
  $("loadBtn").addEventListener("click", () => $("loadFile").click());
  $("loadFile").addEventListener("change", e => { if (e.target.files[0]) loadProject(e.target.files[0]); });
  document.querySelectorAll("[data-export]").forEach(b =>
    b.addEventListener("click", () => doExport(b.dataset.export)));

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(renderKeys, 200); });
}

init();
