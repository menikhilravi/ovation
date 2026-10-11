// audio.js — synthesises every sound the house makes (no samples), builds the hall's reverb, and schedules the
// crowd's events onto the audio thread with the physical delay of sound travelling from each seat to the stage.

function createAudio(house) {
  const A = { ctx: null, node: null, ready: false, sr: 48000, offset: null, muffle: 0, empty: 0, level: 0.5 };
  const NAMES = ['clap', 'stamp', 'thunk', 'whistle', 'cough', 'rustle', 'step', 'flower', 'clunk', 'creak', 'heart', 'bowtap', 'shout', 'boo'];
  const ID = Object.fromEntries(NAMES.map((n, i) => [n, i]));
  const P = house.people, N = house.N;

  // ── zones of the house: bearing × distance from the performer's mark ─────────────
  const AZB = 6, DB = [11, 19];
  const zoneOf = new Int16Array(N), zones = [];
  for (let k = 0; k < AZB * (DB.length + 1); k++) zones.push({ x: 0, y: 0, z: 0, n: 0, d: 0 });
  for (let i = 0; i < N; i++) {
    const p = P[i], ab = clamp(Math.floor((p.az + 1.25) / 2.5 * AZB), 0, AZB - 1), db = p.dist < DB[0] ? 0 : p.dist < DB[1] ? 1 : 2;
    const k = db * AZB + ab; zoneOf[i] = k; const z = zones[k]; z.x += p.x; z.y += p.y + 1.2; z.z += p.z; z.n++;
  }
  zones.forEach(z => { if (z.n) { z.x /= z.n; z.y /= z.n; z.z /= z.n; } });
  const NZ = zones.length;

  // ── synthesis helpers ─────────────────────────────────
  let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd()); };
  function biquad(sr, type, fc, Q, gainDb = 0) {
    const w = TAU * Math.min(fc, sr * 0.45) / sr, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * Q), Ag = Math.pow(10, gainDb / 40);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; }
    else { b0 = 1 + al * Ag; b1 = -2 * cw; b2 = 1 - al * Ag; a0 = 1 + al / Ag; a1 = -2 * cw; a2 = 1 - al / Ag; }
    const c0 = b0 / a0, c1 = b1 / a0, c2 = b2 / a0, d1 = a1 / a0, d2 = a2 / a0; let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return v => { const y = c0 * v + c1 * x1 + c2 * x2 - d1 * y1 - d2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; return y; };
  }
  // A small parallel-formant voice: a glottal pulse train at a gliding pitch, plus breath, through three vowel formants
  // that can glide from one vowel to another. Used only for wordless shouts and a boo, heard far away in a big room.
  const VOWELS = { a: [730, 1090, 2440], o: [570, 840, 2410], u: [320, 870, 2240], e: [530, 1840, 2480], ae: [660, 1720, 2410] };
  function voice(sr, dur, f0fn, v0, v1, female, breath) {
    const L = Math.floor(dur * sr), y = new Float32Array(L), k = female ? 1.17 : 1;
    const A = VOWELS[v0].map(f => f * k), B = VOWELS[v1].map(f => f * k), bws = [80, 110, 160];
    const st = [[0, 0], [0, 0], [0, 0]]; let ph = 0, prev = 0;
    for (let i = 0; i < L; i++) {
      const u = i / L, t = i / sr;
      const f0 = f0fn(u) * (1 + 0.012 * Math.sin(t * 2 * Math.PI * 5.5));
      ph += f0 / sr; if (ph >= 1) ph -= 1;
      const pulse = ph < 0.42 ? 0.5 - 0.5 * Math.cos(2 * Math.PI * ph / 0.42) : 0, src = (pulse - prev) * 6; prev = pulse;
      const env = smooth(0, 0.07, u) * (1 - smooth(0.72, 1, u)), x = (src + gauss() * breath) * env;
      let out = 0;
      for (let f = 0; f < 3; f++) {   // two-pole resonators, parallel
        const F = lerp(A[f], B[f], smooth(0.2, 0.8, u)), r = Math.exp(-Math.PI * bws[f] / sr), c = 2 * r * Math.cos(2 * Math.PI * F / sr);
        const yv = (1 - r) * x + c * st[f][0] - r * r * st[f][1]; st[f][1] = st[f][0]; st[f][0] = yv; out += yv * [1, 0.7, 0.35][f];
      }
      y[i] = out;
    }
    return y;
  }
  const norm = (y, peak = 1) => { let m = 0; for (const v of y) m = Math.max(m, Math.abs(v)); if (m) for (let i = 0; i < y.length; i++) y[i] *= peak / m; return y; };

  function* makeBanks(sr, B) {
    // Hand claps. Each "hand configuration" (Repp 1987; Peltola et al. 2007) is a noise burst through the resonance of the
    // air pocket between the palms: flat palms ring high and short, cupped palms low and longer.
    B.clap = [];
    for (let b = 0; b < 128; b++) {
      const cup = rnd(), fc = 2500 * Math.pow(0.3, cup) * (0.85 + 0.3 * rnd()), Q = 1.3 + 4.5 * cup + rnd();
      const tau = (0.0028 + 0.0075 * cup + 0.003 * rnd()) * sr, L = Math.floor(0.032 * sr), y = new Float32Array(L);
      const f = biquad(sr, 'bp', fc, Q), f2 = biquad(sr, 'bp', fc * (1.9 + 0.4 * rnd()), 3), h = biquad(sr, 'hp', 2800, 0.7);
      for (let i = 0; i < L; i++) { const n = gauss() * Math.min(1, i / (0.00025 * sr)) * Math.exp(-i / tau); y[i] = f(n) + 0.25 * f2(n) + h(n) * 0.32 * Math.exp(-i / (0.0009 * sr)); }
      B.clap.push(norm(y));
      if ((b & 15) === 15) yield;
    }
    yield;
    // Feet stamping on a raked wooden floor (in the rhythmic encore call).
    B.stamp = [];
    for (let b = 0; b < 16; b++) {
      const L = Math.floor(0.14 * sr), y = new Float32Array(L), f1 = biquad(sr, 'bp', 65 + 45 * rnd(), 2.5), f2 = biquad(sr, 'bp', 170 + 120 * rnd(), 3.5), f3 = biquad(sr, 'bp', 800 + 700 * rnd(), 1.5);
      for (let i = 0; i < L; i++) { const n = gauss(); y[i] = (f1(n) * 3 + f2(n) * 1.4) * Math.exp(-i / (0.03 * sr)) + f3(n) * 0.35 * Math.exp(-i / (0.005 * sr)); }
      B.stamp.push(norm(y));
    }
    yield;
    // Tip-up seats springing back as people stand: a wooden knock with a little spring.
    B.thunk = [];
    for (let b = 0; b < 20; b++) {
      const L = Math.floor(0.2 * sr), y = new Float32Array(L), f1 = biquad(sr, 'bp', 150 + 130 * rnd(), 9), f2 = biquad(sr, 'bp', 520 + 480 * rnd(), 7), f3 = biquad(sr, 'hp', 2500, 0.7), sp = 1800 + 1500 * rnd();
      for (let i = 0; i < L; i++) { const n = gauss() * (i < 0.0015 * sr ? 1 : 0.08); const t = i / sr;
        y[i] = f1(n) * 2.2 * Math.exp(-t / 0.035) + f2(n) * Math.exp(-t / 0.014) + f3(n) * 0.3 * Math.exp(-t / 0.002) + 0.02 * Math.sin(TAU * sp * t) * Math.exp(-t / 0.05); }
      B.thunk.push(norm(y));
    }
    yield;
    // Two-finger whistles: a nearly pure tone that swoops, with breath.
    B.whistle = [];
    for (let b = 0; b < 14; b++) {
      const dur = 0.45 + 0.6 * rnd(), L = Math.floor(dur * sr), y = new Float32Array(L), f0 = 2100 + 1300 * rnd(), kind = rnd(), br = biquad(sr, 'bp', f0, 6); let ph = 0;
      for (let i = 0; i < L; i++) {
        const t = i / L; let f;
        if (kind < 0.45) f = f0 * (1 + 0.28 * Math.sin(Math.PI * Math.min(1, t * 1.5)) - 0.4 * Math.max(0, t - 0.65));
        else if (kind < 0.8) f = f0 * (t < 0.42 ? 1 + 0.35 * t : 1.15 - 0.55 * (t - 0.42));
        else f = f0 * (1.2 - 0.25 * t) * (1 + 0.03 * Math.sin(t * 40));
        f *= 1 + 0.005 * Math.sin(i / sr * TAU * 6.5); ph += TAU * f / sr;
        const env = Math.min(1, t * 30) * Math.min(1, (1 - t) * 7);
        y[i] = (Math.sin(ph) + 0.08 * Math.sin(2 * ph) + br(gauss()) * 0.5) * env;
      }
      B.whistle.push(norm(y));
    }
    yield;
    // Coughs: two turbulent bursts shaped by a throat.
    B.cough = [];
    for (let b = 0; b < 12; b++) {
      const L = Math.floor(0.5 * sr), y = new Float32Array(L), f1 = biquad(sr, 'bp', 380 + 250 * rnd(), 3), f2 = biquad(sr, 'bp', 1300 + 600 * rnd(), 4), f3 = biquad(sr, 'bp', 2700 + 500 * rnd(), 4);
      const parts = rnd() < 0.6 ? [[0, 0.075], [0.14 + 0.05 * rnd(), 0.06]] : [[0, 0.09]];
      for (let i = 0; i < L; i++) { const t = i / sr; let env = 0; for (const [s, d] of parts) if (t >= s) env += Math.exp(-(t - s) / d) * Math.min(1, (t - s) * 500); const n = gauss() * env; y[i] = f1(n) * 2 + f2(n) + f3(n) * 0.6; }
      B.cough.push(norm(y));
    }
    yield;
    // Programmes, coats, handbags: sparse crackle through paper-ish resonances.
    B.rustle = [];
    for (let b = 0; b < 10; b++) {
      const L = Math.floor((0.4 + 0.5 * rnd()) * sr), y = new Float32Array(L), f = biquad(sr, 'bp', 3000 + 2500 * rnd(), 1.2), f2 = biquad(sr, 'bp', 900 + 500 * rnd(), 1);
      let env = 0;
      for (let i = 0; i < L; i++) { if (rnd() < 0.004) env = 0.4 + rnd(); env *= 0.9965; const t = i / L; const n = gauss() * (env + 0.12) * Math.sin(Math.PI * t); y[i] = f(n) + f2(n) * 0.4; }
      B.rustle.push(norm(y));
    }
    yield;
    // The performer's own shoes on the stage boards.
    B.step = [];
    for (let b = 0; b < 10; b++) {
      const L = Math.floor(0.16 * sr), y = new Float32Array(L), f1 = biquad(sr, 'bp', 110 + 60 * rnd(), 4), f2 = biquad(sr, 'bp', 1700 + 900 * rnd(), 3), f3 = biquad(sr, 'bp', 420 + 200 * rnd(), 6);
      for (let i = 0; i < L; i++) { const t = i / sr; const n = gauss(); y[i] = f1(n) * 1.6 * Math.exp(-t / 0.03) + f2(n) * 0.5 * Math.exp(-t / 0.004) + f3(n) * 0.8 * Math.exp(-t / 0.02); }
      B.step.push(norm(y));
    }
    yield;
    // A board that creaks under you, now and then.
    B.creak = [];
    for (let b = 0; b < 4; b++) {
      const L = Math.floor(0.35 * sr), y = new Float32Array(L), f0 = 180 + 160 * rnd(); let ph = 0, env = 0;
      const r1 = biquad(sr, 'bp', 900 + 500 * rnd(), 8), r2 = biquad(sr, 'bp', 2200 + 700 * rnd(), 10);
      for (let i = 0; i < L; i++) { const t = i / L; const f = f0 * (1 + 0.25 * Math.sin(t * 3.1)); ph += f / sr; if (ph >= 1) { ph -= 1; env = 1; } env *= 0.9; const pulse = env * Math.sin(Math.PI * t); y[i] = r1(pulse) + 0.6 * r2(pulse); }
      B.creak.push(norm(y));
    }
    yield;
    // Roses landing: a soft thud and cellophane.
    B.flower = [];
    for (let b = 0; b < 5; b++) {
      const L = Math.floor(0.4 * sr), y = new Float32Array(L), f1 = biquad(sr, 'bp', 140, 2), f2 = biquad(sr, 'hp', 3500, 0.7); let env = 0;
      for (let i = 0; i < L; i++) { const t = i / sr; if (rnd() < 0.01 * Math.exp(-t / 0.08)) env = 1; env *= 0.97; const n = gauss(); y[i] = f1(n) * 2 * Math.exp(-t / 0.03) + f2(n) * env * 0.5; }
      B.flower.push(norm(y));
    }
    yield;
    // The follow-spot: a heavy switch and the lamp's hum settling.
    B.clunk = [];
    for (let b = 0; b < 2; b++) {
      const L = Math.floor(0.9 * sr), y = new Float32Array(L), f1 = biquad(sr, 'bp', 95, 4), f2 = biquad(sr, 'bp', 1300, 3), f3 = biquad(sr, 'bp', 3400, 5);
      for (let i = 0; i < L; i++) { const t = i / sr; const n = gauss() * (t < 0.004 ? 1 : 0.04);
        y[i] = f1(n) * 3 * Math.exp(-t / 0.08) + f2(n) * Math.exp(-t / 0.02) + f3(n) * 0.5 * Math.exp(-t / 0.01) + 0.012 * Math.sin(TAU * 100 * t) * Math.min(1, t * 8) * Math.exp(-t / 0.5) + (t > 0.03 && t < 0.035 ? f2(gauss()) * 0.6 : 0); }
      B.clunk.push(norm(y));
    }
    yield;
    // The orchestra in the pit applauds the old way: bows tapped on music stands.
    B.bowtap = [];
    for (let b = 0; b < 12; b++) {
      const L = Math.floor(0.05 * sr), y = new Float32Array(L), f1 = biquad(sr, 'bp', 2200 + 1800 * rnd(), 9), f2 = biquad(sr, 'bp', 5200 + 1500 * rnd(), 6);
      for (let i = 0; i < L; i++) { const t = i / sr; const n = gauss() * (t < 0.0008 ? 1 : 0.02); y[i] = f1(n) * Math.exp(-t / 0.012) + f2(n) * 0.5 * Math.exp(-t / 0.004); }
      B.bowtap.push(norm(y));
    }
    yield;
    // Wordless shouts for the roar: woo, yeah, ohh, hey. Many short voices at scattered pitches: never one held note.
    B.shout = [];
    const kinds = [['u', 'o', (u, p) => p * (1 + 0.35 * Math.sin(Math.PI * Math.min(1, u * 1.4)))], ['e', 'a', (u, p) => p * (1.15 - 0.3 * u)], ['o', 'o', (u, p) => p * (1 + 0.2 * Math.sin(Math.PI * u))], ['e', 'e', (u, p) => p * (1.1 - 0.1 * u)], ['ae', 'a', (u, p) => p * (1.2 - 0.35 * u)]];
    for (let b = 0; b < 56; b++) {
      const female = rnd() < 0.5, [v0, v1, fn] = kinds[b % kinds.length], p0 = female ? 280 + 140 * rnd() : 150 + 90 * rnd();
      const dur = [0.75, 0.5, 0.85, 0.3, 0.55][b % kinds.length] * (0.8 + 0.5 * rnd());
      B.shout.push(norm(voice(sr, dur, u => fn(u, p0), v0, v1, female, 0.35 + 0.3 * rnd())));
      if ((b & 7) === 7) yield;
    }
    // And for the one who's had enough: a single boo from the gallery.
    B.boo = [];
    for (let b = 0; b < 3; b++) { const p0 = 135 + 25 * rnd(); B.boo.push(norm(voice(sr, 1.15 + 0.3 * rnd(), u => p0 * (1.05 - 0.28 * u) * (u < 0.08 ? 0.9 + u : 1), 'u', 'u', false, 0.25))); }
    yield;
    // Your own heart, in the silence before anyone claps: lub-dub, felt more than heard.
    B.heart = [];
    for (let b = 0; b < 3; b++) {
      const L = Math.floor(0.42 * sr), y = new Float32Array(L);
      for (let i = 0; i < L; i++) { const t = i / sr;
        const lub = Math.sin(TAU * (52 + 6 * b) * t) * Math.exp(-t / 0.045) * smooth(0, 0.008, t);
        const t2 = t - 0.24, dub = t2 > 0 ? Math.sin(TAU * 64 * t2) * Math.exp(-t2 / 0.035) * smooth(0, 0.006, t2) * 0.7 : 0;
        y[i] = lub + dub; }
      B.heart.push(norm(y));
    }
    B.done = true;
  }

  // The hall's impulse response: frequency-dependent decay (the bass lingers), with early reflections off the
  // parapets. An empty hall rings longer than a full one: bodies absorb sound.
  function* hallIRGen(sr, rt, out) {
    const len = Math.floor(rt * 1.7 * sr), chans = [new Float32Array(len), new Float32Array(len)];
    const bands = [[90, 1.25], [250, 1.15], [700, 1.0], [2000, 0.85], [5000, 0.6], [10000, 0.38]];
    for (let ch = 0; ch < 2; ch++) {
      const d = chans[ch];
      for (const [fc, k] of bands) { const f = biquad(sr, 'bp', fc, 1.1); const T = rt * k; for (let i = 0; i < len; i++) { const t = i / sr; d[i] += f(gauss()) * Math.exp(-6.9 * t / T) * smooth(0.008, 0.04, t); } yield; }
      for (let r = 0; r < 30; r++) { const at = Math.floor((0.012 + 0.11 * Math.pow(rnd(), 1.4)) * sr); d[at] += (rnd() < 0.5 ? -1 : 1) * 0.9 * Math.exp(-r / 12); }
      let e = 0; for (const v of d) e += v * v; const sc = 1 / Math.sqrt(e); for (let i = 0; i < len; i++) d[i] *= sc;
    }
    out.push(chans);
  }
  function irBuffer(ctx, chans) { const b = ctx.createBuffer(2, chans[0].length, ctx.sampleRate); b.copyToChannel(chans[0], 0); b.copyToChannel(chans[1], 1); return b; }

  // ── everything that can be made before anyone taps is made in small slices, so the first tap never stalls ──
  const SR0 = 48000, PRE = { banks: {}, irs: [] };
  const work = [makeBanks(SR0, PRE.banks), hallIRGen(SR0, 1.55, PRE.irs), hallIRGen(SR0, 2.6, PRE.irs)];
  function prepareSome(ms) { const t0 = performance.now(); while (work.length && performance.now() - t0 < ms) { if (work[0].next().done) work.shift(); } return !work.length; }
  (function tick() { if (!prepareSome(10)) setTimeout(tick, 16); })();

  // The engine runs in an AudioWorklet where it can; where it can't (an older browser, or a sandbox that refuses the
  // module), the very same processor runs on the main thread inside a ScriptProcessor.
  function scriptProcessorEngine(ctx, banks) {
    let Cls = null;
    const Base = class { constructor() { this.port = null; } };
    new Function('AudioWorkletProcessor', 'registerProcessor', 'sampleRate', WORKLET_SRC)(Base, (n, c) => { Cls = c; }, ctx.sampleRate);
    const proc = new Cls({ processorOptions: { banks, zones: NZ } });
    const sp = ctx.createScriptProcessor(1024, 1, 4);
    const L = new Float32Array(128), R = new Float32Array(128), SL = new Float32Array(128), SR = new Float32Array(128), outs = [[L, R], [SL, SR]];
    sp.onaudioprocess = e => {
      const ob = e.outputBuffer, o = [0, 1, 2, 3].map(c => ob.getChannelData(c));
      let f = Math.round(e.playbackTime * ctx.sampleRate);
      for (let off = 0; off < ob.length; off += 128) {
        L.fill(0); R.fill(0); SL.fill(0); SR.fill(0); proc.frame = f; proc.process([], outs);
        o[0].set(L, off); o[1].set(R, off); o[2].set(SL, off); o[3].set(SR, off); f += 128;
      }
    };
    const split = ctx.createChannelSplitter(4), dry = ctx.createChannelMerger(2), send = ctx.createChannelMerger(2);
    sp.connect(split); split.connect(dry, 0, 0); split.connect(dry, 1, 1); split.connect(send, 2, 0); split.connect(send, 3, 1);
    const silent = ctx.createConstantSource ? ctx.createConstantSource() : null; if (silent) { silent.offset.value = 0; silent.connect(sp); silent.start(); }
    return { port: { postMessage: m => proc.msg(m) }, dry, send, kind: 'script' };
  }

  // ── start (must be called from a user gesture) ────────
  let starting = null;
  let keeper = null, keeperOn = false;
  function keepAwakeAudio() { // iOS: a playing <audio> element moves Web Audio out of the ringer-switch's "ambient" category
    if (keeperOn) return;
    try {
      if (!keeper) { keeper = document.createElement('audio'); keeper.setAttribute('playsinline', ''); keeper.loop = true; keeper.volume = 0.01;
        keeper.src = 'data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA=='; }
      const p = keeper.play(); if (p && p.then) p.then(() => { keeperOn = true; }).catch(() => {});
    } catch (e) {}
  }
  function start() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    keepAwakeAudio();                                     // retried on every gesture until it takes
    if (A.ctx) { if (A.ctx.state !== 'running') A.ctx.resume().catch(() => {}); return starting || Promise.resolve(); }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { A.failed = true; return Promise.resolve(); }
    let ctx; try { ctx = new AC({ latencyHint: 'interactive', sampleRate: SR0 }); } catch (e) { ctx = new AC(); }
    A.ctx = ctx; A.sr = ctx.sampleRate;
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    starting = boot(ctx).catch(e => { console.warn('audio unavailable:', e && e.message); try { ctx.close(); } catch (_) {} A.ctx = null; A.ready = false; A.failed = true; starting = null; });
    return starting;
  }
  async function boot(ctx) {
    prepareSome(1e9);                                     // finish whatever the slices haven't done yet
    let banks = PRE.banks, irs = PRE.irs;
    if (ctx.sampleRate !== SR0) { banks = {}; for (const _ of makeBanks(ctx.sampleRate, banks)); irs = []; for (const _ of hallIRGen(ctx.sampleRate, 1.55, irs)); for (const _ of hallIRGen(ctx.sampleRate, 2.6, irs)); }
    let engine = null;
    if (ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined' && !/engine=script/.test(location.search)) {
      for (const url of [URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'text/javascript' })), 'worklet.js']) {
        try { await ctx.audioWorklet.addModule(url); const n = new AudioWorkletNode(ctx, 'house', { numberOfInputs: 0, numberOfOutputs: 2, outputChannelCount: [2, 2], processorOptions: { banks, zones: NZ } }); engine = { port: n.port, dry: n, send: n, node: n, kind: 'worklet' }; break; }
        catch (e) { /* try the next way */ }
      }
    }
    if (!engine) engine = scriptProcessorEngine(ctx, banks);
    A.engine = engine; A.node = { port: engine.port };
    const master = A.master = ctx.createGain(); master.gain.value = 0;
    const full = ctx.createConvolver(); full.normalize = false; full.buffer = irBuffer(ctx, irs[0]);
    const empty = ctx.createConvolver(); empty.normalize = false; empty.buffer = irBuffer(ctx, irs[1]);
    const wetFull = A.wetFull = ctx.createGain(), wetEmpty = A.wetEmpty = ctx.createGain(); wetFull.gain.value = 0.55; wetEmpty.gain.value = 0;
    const dry = ctx.createGain(); dry.gain.value = 1;
    if (engine.kind === 'worklet') { engine.node.connect(dry, 0); engine.node.connect(full, 1); engine.node.connect(empty, 1); }
    else { engine.dry.connect(dry); engine.send.connect(full); engine.send.connect(empty); }
    full.connect(wetFull); empty.connect(wetEmpty);
    const bus = ctx.createGain(); dry.connect(bus); wetFull.connect(bus); wetEmpty.connect(bus);
    const muf = A.muf = ctx.createBiquadFilter(); muf.type = 'lowpass'; muf.frequency.value = 20000; muf.Q.value = 0.5;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 2; lim.ratio.value = 12; lim.attack.value = 0.002; lim.release.value = 0.18;
    bus.connect(muf); muf.connect(master); master.connect(lim); lim.connect(ctx.destination);
    master.gain.setTargetAtTime(A.level, ctx.currentTime, 0.9);
    A.ready = true;
  }
  A.running = () => !!(A.ctx && A.ready && A.ctx.state === 'running');

  // ── scheduling ─────────────────────────────────────────
  // modelNow: the model's clock at the moment being displayed. Events carry model times a little in the future.
  function schedule(events, modelNow, listener) {
    if (!A.running()) { events.length = 0; A.offset = null; return; }
    const ctx = A.ctx, sr = A.sr;
    const off = ctx.currentTime - modelNow;
    if (A.offset === null || Math.abs(off - A.offset) > 0.08) A.offset = off; else A.offset += (off - A.offset) * 0.02;
    const base = A.offset + 0.03;
    const out = []; let n = 0;
    for (const ev of events) {
      const i = ev.i;
      let frame, bank = ID[ev.type], idx = 0, zone = -1, pan = 0, g = ev.g;
      if (ev.type === 'clap' || ev.type === 'stamp' || ev.type === 'thunk' || ev.type === 'whistle' || ev.type === 'cough' || ev.type === 'shout' || ev.type === 'boo') {
        const p = P[i];
        const dx = p.x - listener.x, dz = p.z - PERF_Z, dy = p.y + 1.2 - (STAGE_Y + EYE), d = Math.hypot(dx, dy, dz);
        frame = (ev.t + d / 343 + base) * sr;
        const dd = 2.6 / (1 + d * 0.22);   // direct sound: row A is ~8 dB above the back of the stalls; the reverb carries the far field
        if (ev.type === 'clap') {
          idx = (i * 7 + ((Math.random() * 3) | 0) * 41) % 128; g *= 0.3 * dd * (0.85 + 0.3 * Math.random()) * (1 + 0.9 * (listener.surge || 0)); zone = zoneOf[i];
          // the nearest hands, each in its own place: you can pick out the people in the first rows
          if (p.dist < 11.5 && p.tier === 0) { zone = -1; pan = clamp(-Math.sin(Math.atan2(dx, dz) - listener.yaw) * 1.3, -1, 1); g *= 1.8; }
        }
        else if (ev.type === 'stamp') { idx = i % 16; g *= 0.11 * dd; zone = zoneOf[i]; }
        else if (ev.type === 'thunk') { idx = (i * 3 + ((Math.random() * 20) | 0)) % 20; g *= 0.16 * dd; zone = zoneOf[i]; }
        else { // voices of the house: whistles and coughs are placed individually
          idx = (Math.random() * 60) | 0; pan = clamp(-Math.sin(Math.atan2(dx, dz) - listener.yaw) * 1.1, -1, 1);   // screen-right is world −x
          g *= (ev.type === 'whistle' ? 0.13 : ev.type === 'shout' ? 0.075 : ev.type === 'boo' ? 0.22 : 0.1) / (1 + d * 0.05);
        }
      } else {
        frame = ((ev.t == null ? modelNow : ev.t) + base) * sr; idx = (Math.random() * 20) | 0; pan = ev.pan || 0; zone = ev.zone == null ? -1 : ev.zone;
      }
      out.push(frame, bank, idx, zone, g, pan); n++;
    }
    events.length = 0;
    if (n) A.node.port.postMessage({ type: 'ev', data: new Float64Array(out), names: NAMES });
  }

  function fx(type, g, pan, dryish) { if (!A.running()) return; const off = A.offset == null ? 0 : A.offset; schedule([{ t: A.ctx.currentTime - off + 0.05, type, g, pan: pan || 0, zone: dryish ? -2 : -1 }], A.ctx.currentTime - off, { x: 0, yaw: 0 }); }

  // ── the listener moves: re-pan and re-filter each zone ─────────────
  let zoneMsgT = 0;
  function update(dt, listener, crowdS, dir) {
    if (!A.running()) return;
    const ctx = A.ctx, sr = A.sr;
    zoneMsgT -= dt;
    if (zoneMsgT <= 0) {
      zoneMsgT = 0.05;
      const data = new Float32Array(NZ * 4);
      for (let k = 0; k < NZ; k++) {
        const z = zones[k]; if (!z.n) continue;
        const dx = z.x - listener.x, dz = z.z - PERF_Z, dy = z.y - (STAGE_Y + EYE), d = Math.hypot(dx, dy, dz);
        const az = Math.atan2(dx, dz) - listener.yaw, pan = clamp(-Math.sin(az) * 1.15, -1, 1);
        const behind = Math.cos(az) < 0 ? 0.6 : 1;
        const g = behind;
        const fc = 15000 * Math.exp(-Math.max(0, d - 5) / 22);
        data[k * 4] = g * Math.sqrt((1 - pan) / 2); data[k * 4 + 1] = g * Math.sqrt((1 + pan) / 2);
        data[k * 4 + 2] = Math.exp(-TAU * fc / sr); data[k * 4 + 3] = 0.22;
      }
      A.node.port.postMessage({ type: 'zones', data });
      // room tone and murmur follow the phase of the night
      const ph = dir.phase, lights = ph === 'preshow' ? 0 : 1;
      const murmur = ph === 'leaving' ? 0.05 * (1 - crowdS.leaving) + 0.01 : ph === 'lights' || ph === 'breath' ? 0 : ph === 'ovation' ? 0.004 * (1 - Math.min(1, crowdS.frac * 4)) : 0;
      A.node.port.postMessage({ type: 'amb', room: 0.006 * lights * (ph === 'end' ? 0 : 1), murmur, cheer: 0 });
    }
    // off in the wings the house is behind a wall of scenery and drapes
    const muf = clamp((Math.abs(listener.x) - (WING_X - 0.6)) / 2.2, 0, 1);
    A.muf.frequency.setTargetAtTime(20000 * Math.pow(0.05, muf), ctx.currentTime, 0.12);
    // people absorb sound: as the house empties it rings longer
    A.wetFull.gain.setTargetAtTime(0.55 * (1 - crowdS.leaving * 0.8), ctx.currentTime, 0.5);
    A.wetEmpty.gain.setTargetAtTime(0.75 * crowdS.leaving, ctx.currentTime, 0.5);
    A.master.gain.setTargetAtTime(dir.phase === 'end' ? 0 : A.level * (1 - 0.25 * muf), ctx.currentTime, 0.3);
  }

  return Object.assign(A, { start, schedule, update, fx, zoneOf, NZ });
}
