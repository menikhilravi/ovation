// worklet.js — runs on the audio thread. Every sound is a pre-synthesised grain written *ahead* into ring buffers at
// its exact sample: crowd sounds into one mono ring per zone of the house (each zone then gets air absorption and a
// pan relative to where the performer stands), everything else into stereo rings. Two outputs: dry, and a send for
// the hall's convolution reverb. The same class also runs on the main thread inside a ScriptProcessor where
// AudioWorklet is unavailable, so it keeps its own sample clock (this.frame) instead of reading worklet globals.
const RING = 1 << 18; // ~5.4 s at 48 kHz
const MASK = RING - 1;

class House extends AudioWorkletProcessor {
  constructor(opts) {
    super();
    const o = opts.processorOptions;
    this.banks = o.banks;                  // { name: [Float32Array, ...] }
    this.nz = o.zones;
    this.zbuf = []; this.z = [];
    for (let k = 0; k < this.nz; k++) {
      this.zbuf.push(new Float32Array(RING));
      this.z.push({ gl: 0, gr: 0, tgl: 0, tgr: 0, a: 0.5, s1: 0, s2: 0, send: 0.4, tsend: 0.4 });
    }
    this.fx = [new Float32Array(RING), new Float32Array(RING)];
    this.fxs = [new Float32Array(RING), new Float32Array(RING)];
    this.room = 0; this.troom = 0; this.mur = 0; this.tmur = 0; this.muf = 0; this.cheer = 0; this.tcheer = 0;
    this.n1 = 0; this.n2 = 0; this.b = 0;
    this.talk = Array.from({ length: 10 }, (_, i) => ({ ph: Math.random() * 6.28, f: 2.5 + Math.random() * 3, lp1: 0, lp2: 0, bp: 0, fc: 0.04 + 0.05 * Math.random(), pan: Math.random() * 2 - 1, amp: 0 }));
    this.seed = 1234567; this.frame = 0; this.lastN = 128;
    if (this.port) this.port.onmessage = (e) => this.msg(e.data);
  }
  rnd() { this.seed = (this.seed * 1664525 + 1013904223) >>> 0; return this.seed / 4294967296 * 2 - 1; }
  msg(d) {
    if (d.type === 'ev') {
      const a = d.data, names = d.names;
      for (let i = 0; i < a.length; i += 6) {
        const frame = Math.round(a[i]), bank = this.banks[names[a[i + 1] | 0]], g = a[i + 4];
        if (!bank) continue;
        const buf = bank[(a[i + 2] | 0) % bank.length], zone = a[i + 3] | 0;
        const now = this.frame + this.lastN;
        let start = frame - now, k0 = 0;
        if (start < 0) { if (start < -0.04 * sampleRate) continue; start = 0; }   // a little late: play it whole, now
        if (start + buf.length > RING - 256) continue;
        const w0 = now + start;
        if (zone >= 0) {
          const zb = this.zbuf[zone];
          for (let k = k0; k < buf.length; k++) zb[(w0 + k - k0) & MASK] += buf[k] * g;
        } else {
          const pan = a[i + 5], gl = g * Math.sqrt((1 - pan) / 2), gr = g * Math.sqrt((1 + pan) / 2), s = a[i + 3] === -2 ? 0.25 : 0.55;
          const L = this.fx[0], R = this.fx[1], SL = this.fxs[0], SR = this.fxs[1];
          for (let k = k0; k < buf.length; k++) { const j = (w0 + k - k0) & MASK, v = buf[k]; L[j] += v * gl; R[j] += v * gr; SL[j] += v * gl * s; SR[j] += v * gr * s; }
        }
      }
    } else if (d.type === 'zones') {
      const a = d.data;
      for (let k = 0; k < this.nz; k++) { const z = this.z[k]; z.tgl = a[k * 4]; z.tgr = a[k * 4 + 1]; z.a = a[k * 4 + 2]; z.tsend = a[k * 4 + 3]; }
    } else if (d.type === 'amb') { this.troom = d.room; this.tmur = d.murmur; if (d.cheer != null) this.tcheer = d.cheer; }
  }
  process(_, outs) {
    const dry = outs[0], send = outs[1];
    if (typeof currentFrame !== 'undefined') this.frame = currentFrame;
    const L = dry[0], R = dry[1], SL = send[0], SR = send[1], n = L.length, f0 = this.frame; this.lastN = n;
    for (let k = 0; k < this.nz; k++) {
      const z = this.z[k], zb = this.zbuf[k], a = z.a;
      let s1 = z.s1, s2 = z.s2, gl = z.gl, gr = z.gr, sd = z.send; const dgl = (z.tgl - gl) / n, dgr = (z.tgr - gr) / n, dsd = (z.tsend - sd) / n;
      for (let i = 0; i < n; i++) {
        const j = (f0 + i) & MASK, v = zb[j]; zb[j] = 0;
        s1 = v + (s1 - v) * a; s2 = s1 + (s2 - s1) * a;
        gl += dgl; gr += dgr; sd += dsd;
        L[i] += s2 * gl; R[i] += s2 * gr; const w = s2 * sd; SL[i] += w; SR[i] += w;
      }
      z.s1 = s1; z.s2 = s2; z.gl = gl; z.gr = gr; z.send = sd;
    }
    const FL = this.fx[0], FR = this.fx[1], XL = this.fxs[0], XR = this.fxs[1];
    for (let i = 0; i < n; i++) { const j = (f0 + i) & MASK; L[i] += FL[j]; R[i] += FR[j]; SL[i] += XL[j]; SR[i] += XR[j]; FL[j] = 0; FR[j] = 0; XL[j] = 0; XR[j] = 0; }
    // room tone (air handling, a big quiet space) and the murmur of a waiting or departing audience
    this.room += (this.troom - this.room) * 0.002; this.mur += (this.tmur - this.mur) * 0.001;
    if (this.room > 1e-5 || this.mur > 1e-5) {
      for (let i = 0; i < n; i++) {
        const w = this.rnd();
        this.b = this.b * 0.997 + w * 0.03; this.n1 = this.n1 * 0.9 + w * 0.1;
        const rt = (this.b * 1.4 + this.n1 * 0.08) * this.room;
        L[i] += rt; R[i] += rt * 0.96; SL[i] += rt * 0.3; SR[i] += rt * 0.3;
      }
      if (this.mur > 1e-5) {
        for (const tk of this.talk) {
          const df = tk.f / sampleRate * 6.2832;
          for (let i = 0; i < n; i++) {
            tk.ph += df * (1 + 0.3 * Math.sin(tk.ph * 0.37));
            const syl = Math.max(0, Math.sin(tk.ph)) ** 2 * (0.6 + 0.4 * Math.sin(tk.ph * 0.13));
            const w = this.rnd();
            tk.lp1 += (w - tk.lp1) * tk.fc * 3; tk.lp2 += (tk.lp1 - tk.lp2) * tk.fc * 1.5;
            const v = (tk.lp1 - tk.lp2) * syl * this.mur * 0.9;
            L[i] += v * (1 - tk.pan) * 0.3; R[i] += v * (1 + tk.pan) * 0.3; SL[i] += v * 0.8; SR[i] += v * 0.8;
          }
        }
      }
    }
    return true;
  }
}
registerProcessor('house', House);
