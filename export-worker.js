/* MP3 encoding off the main thread so the page stays responsive. */
importScripts("lib/lame.min.js");

onmessage = e => {
  try {
    const { l, r } = e.data;
    const enc = new lamejs.Mp3Encoder(2, 48000, 320);
    const li = new Int16Array(l.length), ri = new Int16Array(r.length);
    for (let i = 0; i < l.length; i++) {
      li[i] = Math.max(-1, Math.min(1, l[i])) * 32767;
      ri[i] = Math.max(-1, Math.min(1, r[i])) * 32767;
    }
    const chunks = [], block = 1152;
    for (let i = 0; i < li.length; i += block) {
      const d = enc.encodeBuffer(li.subarray(i, i + block), ri.subarray(i, i + block));
      if (d.length) chunks.push(new Uint8Array(d));
    }
    const end = enc.flush();
    if (end.length) chunks.push(new Uint8Array(end));
    postMessage({ chunks });
  } catch (err) {
    postMessage({ error: err.message });
  }
};
