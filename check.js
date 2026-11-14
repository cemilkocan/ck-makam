#!/usr/bin/env node
/* Sanity checks run before publishing: every id the code touches must exist in
   the page, every drum row needs a label and a file, and every i18n key used
   must be present in both languages. */
const fs = require("fs");
const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
let bad = 0;
const fail = m => { console.log("HATA: " + m); bad++; };

const ids = [...new Set([...app.matchAll(/\$\("([a-zA-Z0-9_]+)"\)/g)].map(m => m[1]))];
for (const id of ids)
  if (id !== "playhead" && !html.includes('id="' + id + '"')) fail("id yok: " + id);

const rows = JSON.parse("[" + app.match(/const DRUM_ROWS = \[([\s\S]*?)\];/)[1].replace(/\s+/g, " ") + "]");
const drumsTr = app.match(/drums: \{ doum: "Düm"[\s\S]*?\},/)[0];
const drumsEn = app.match(/drums: \{ doum: "Dum"[\s\S]*?\},/)[0];
for (const r of rows) {
  if (!drumsTr.includes(r + ":")) fail("tr etiketi yok: " + r);
  if (!drumsEn.includes(r + ":")) fail("en etiketi yok: " + r);
  if (!["doum","tek","tekhi","mid","mute"].includes(r) && !fs.existsSync("sounds/drums/" + r + ".wav"))
    fail("ses dosyası yok: " + r);
}

const keys = [...new Set([...app.matchAll(/data-i18n="([a-zA-Z0-9_]+)"/g)].map(m => m[1])
  .concat([...html.matchAll(/data-i18n(?:-html)?="([a-zA-Z0-9_]+)"/g)].map(m => m[1]))
  .concat([...app.matchAll(/\bt\("([a-zA-Z0-9_]+)"\)/g)].map(m => m[1])))];
const tr = app.slice(app.indexOf("  tr: {"), app.indexOf("  en: {"));
const en = app.slice(app.indexOf("  en: {"));
for (const k of keys) {
  if (!new RegExp("\\b" + k + ":").test(tr)) fail("tr çevirisi yok: " + k);
  if (!new RegExp("\\b" + k + ":").test(en)) fail("en çevirisi yok: " + k);
}

for (const m of ["Hicaz","Rast","Uşşak"])
  if (!app.includes('"' + m + '": "')) fail("makam açıklaması yok: " + m);

const demos = fs.readFileSync("demos.js", "utf8");
global.window = {};
eval(demos);
const makams = app.match(/const MAKAMS = \{[\s\S]*?\n\};/)[0];
const usuls = app.match(/const USULS = \{[\s\S]*?\n\};/)[0];
for (const d of window.DEMOS) {
  if (!makams.includes('"' + d.makam + '"')) fail("demo makamı yok: " + d.makam);
  if (!usuls.includes('"' + d.usul + '"')) fail("demo usulü yok: " + d.usul);
  if (!d.notes.length) fail("demo boş: " + d.id);
}
console.log(bad ? bad + " sorun" : "hepsi tamam (" + ids.length + " id, " + rows.length + " satır, " + keys.length + " metin, " + window.DEMOS.length + " demo)");
process.exit(bad ? 1 : 0);
