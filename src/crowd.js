// crowd.js — the audience as a physical system.
//
//  • Onset/offset of clapping by social contagion: you start when you're moved and hear others; you stop when
//    they stop (Mann, Faria, Sumpter & Krause 2013, "The dynamics of audience applause").
//  • Two clapping modes: fast, loose "mode I" (~4 Hz) and slow, even "mode II" (~2 Hz, half the dispersion). Only in
//    mode II is the crowd able to lock phase: a Kuramoto mean field of what everyone hears. When they want to be
//    louder they speed up again and the rhythm dissolves (Néda, Ravasz, Brechet, Vicsek & Barabási 2000).
//  • Standing: you stand when moved enough, or when the people you can see in front of you are standing
//    (Miller & Page 2004, "The standing ovation problem"). So it starts at the front and rolls backwards and up.
//
// The model runs a little ahead of the picture so audio can be scheduled sample-accurately; the picture reads
// per-person clap times from the past.

function createCrowd(house, night, t0) {
  t0 = t0 || 0;
  const P = house.people, N = house.N, rng = makeRng(night.seed * 7 + 1);
  const A = n => new Float32Array(n);
  const base = A(N), e = A(N), drift = A(N), local = A(N);
  const clap = new Uint8Array(N), th = A(N), f1 = A(N), f2 = A(N), joins = A(N), m = A(N), force = A(N);
  const stand = new Uint8Array(N), standH = A(N), tau = A(N), sigma = A(N), pendT = A(N), arms = A(N);
  const lastClap = new Float64Array(N).fill(t0 - 9), prevClap = new Float64Array(N).fill(t0 - 9);
  const whistler = new Uint8Array(N), stamper = new Uint8Array(N), leave = A(N), leaveAt = new Float32Array(N).fill(1e9);
  const gaze = A(N), react = A(N);
  const mode = new Uint8Array(N), rest = A(N), stamina = A(N), holdout = new Uint8Array(N), armsT = A(N), phone = A(N), phoneT = A(N), shout = A(N);
  for (let i = 0; i < N; i++) {
    const p = P[i];
    // how much this person loved it: tonight's mood, plus the front rows are always a little keener
    base[i] = clamp(night.mood + 0.16 * rng.gauss() + (p.tier === 0 ? 0.06 * (1 - p.row / 20) : 0) + (p.tier === 4 ? 0.05 : 0), 0.05, 1.2);
    f1[i] = clamp(3.9 + 0.5 * rng.gauss(), 2.8, 5.3) * night.tempo;
    f2[i] = clamp(1.95 + 0.09 * rng.gauss(), 1.65, 2.3) * night.tempo;
    joins[i] = rng() < night.rhythmic ? 1 : 0.15 * rng();
    th[i] = rng() * TAU;
    tau[i] = clamp(0.92 + 0.14 * rng.gauss(), 0.7, 1.2);     // stand on your own above this
    sigma[i] = clamp(0.45 + 0.2 * rng.gauss(), 0.15, 0.85);  // stand if this share of those in front are standing
    whistler[i] = rng() < 0.05 ? 1 : 0;
    stamper[i] = rng() < 0.45 ? 1 : 0;
    react[i] = 0.25 + 0.9 * rng() * rng();                  // reaction delay
    stamina[i] = 9 + 16 * rng();                            // seconds of clapping before your hands need a moment
    phoneT[i] = rng() < 0.035 ? 0.95 + 0.2 * rng() : 9;    // the ones who film it
    armsT[i] = rng() < 0.3 ? 0 : 0.25 + 0.4 * rng() + (p.tier === 0 ? p.row / 50 : 0.1);   // who throws their arms up
    if (rng() < 0.018) { holdout[i] = 1; base[i] *= 0.35; } // there is always someone who didn't care for it
  }
  const S = {
    t: t0, G: 0, D: 0, hush: 0, gone: 0, frac: 0, R: 0, Psi: 0, standFrac: 0, leaving: 0, lastIdx: -1, lastMode: 0,
    events: [], clapRate: 0, meanM: 0,
  };
  let gazeDir = [0, 1], gazeFocus = 0;
  const fracNear = A(N);

  function setGaze(dirX, dirZ, focus) { gazeDir = [dirX, dirZ]; gazeFocus = focus; }

  // A bow (or anything the performer does) lands harder on the people you're facing.
  function stimulate(amount, spread) {
    for (let i = 0; i < N; i++) {
      const p = P[i]; const dx = p.x - night.perfX, dz = p.z - PERF_Z, l = Math.hypot(dx, dz) || 1;
      const facing = (dx * gazeDir[0] + dz * gazeDir[1]) / l;
      const w = spread + (1 - spread) * smooth(0.55, 0.97, facing);
      local[i] = Math.min(0.6, local[i] + amount * w * (0.8 + 0.4 * rng()));
    }
  }

  function firstClapper() {
    // someone keen, near the front and near the middle, so you can see where it starts
    let best = -1, bs = -1;
    for (let i = 0; i < N; i++) { const p = P[i]; if (p.tier !== 0 || p.row > 6 || Math.abs(p.x) > 3.4) continue; const s = base[i] + rng() * 0.3; if (s > bs) { bs = s; best = i; } }
    if (best < 0) best = 0;
    local[best] = 0.6; base[best] = 1.2; clap[best] = 1; th[best] = TAU - 0.05; return best;
  }

  const DT = 1 / 120;
  function step(dt) {
    const t = S.t += dt;
    const G = S.G;
    // mean fields: the whole room, and the pulse of those clapping in the slow mode (the rhythm you can hear forming)
    let nc = 0, sx = 0, sy = 0, ws = 0, ns = 0, mm = 0, n2 = 0, sx2 = 0, sy2 = 0, w2 = 0;
    for (let i = 0; i < N; i++) if (clap[i] && leave[i] === 0) {
      nc++; const w = force[i] || 1, c = Math.cos(th[i]), sn = Math.sin(th[i]); sx += w * c; sy += w * sn; ws += w; mm += m[i];
      if (mode[i]) { n2++; sx2 += w * c; sy2 += w * sn; w2 += w; }
    }
    const present = N - S.leaving * N;
    S.frac = nc / Math.max(1, present); S.R = ws ? Math.hypot(sx, sy) / ws : 0; S.Psi = Math.atan2(sy, sx); S.meanM = nc ? mm / nc : 0;
    const R2 = w2 ? Math.hypot(sx2, sy2) / w2 : 0, Psi2 = Math.atan2(sy2, sx2); S.R2 = R2; S.n2 = nc ? n2 / nc : 0;
    const R = S.R, Psi = S.Psi, frac = S.frac;
    for (let i = 0; i < N; i++) {
      if (leave[i] > 0) { const was = leave[i]; leave[i] += dt / 7; clap[i] = 0; standH[i] = approach(standH[i], 1, 5, dt); arms[i] = approach(arms[i], 0, 3, dt); phone[i] = 0; if (was < 1 && leave[i] >= 1) S.gone += 1 / N; continue; }
      if (t > leaveAt[i]) { leave[i] = 1e-4; stand[i] = 1; clap[i] = 0; S.events.push({ t, type: 'thunk', i, g: 0.7 }); S.leaving += 1 / N; continue; }
      const p = P[i];
      // excitement: tonight's love × the room's energy, plus what you did to me, plus my own wandering attention
      drift[i] += (-drift[i] * 0.4 + 0.18 * rng.gauss()) * dt;
      local[i] *= Math.exp(-dt / 6);
      const ei = e[i] = Math.max(0, base[i] * G + local[i] + drift[i] * 0.25 * G);
      // how much applause I can hear around me
      let nn = 0; const ne = p.near; for (let k = 0; k < ne.length; k++) nn += clap[ne[k]]; fracNear[i] = ne.length ? nn / ne.length : frac;
      const heard = 0.55 * fracNear[i] + 0.45 * frac;
      if (i === S.lastIdx && S.lastMode) {
        // the last one: slow, deliberate, alone
        clap[i] = S.lastMode === 1 ? 1 : 0; m[i] = 1; force[i] = 1.5;
        arms[i] = approach(arms[i], S.lastMode === 3 ? 1 : 0, 2.5, dt);   // you bowed to them: both arms up
        const prev = th[i]; th[i] += TAU * 0.95 * dt;
        if (clap[i] && Math.floor(th[i] / TAU) !== Math.floor(prev / TAU)) emitClap(i, t - (th[i] % TAU) / (TAU * 0.95));
        standH[i] = approach(standH[i], 1, 3, dt); continue;
      }
      if (rest[i] > 0) { rest[i] -= dt; if (rest[i] <= 0 && ei > 0.3) { clap[i] = 1; th[i] = (mode[i] ? Psi2 : Psi) + (rng() - .5) * 2; } }
      else if (!clap[i]) {
        const rOn = Math.max(0, ei - 0.12) * (0.2 + 9 * heard) * (1 - S.hush) * (holdout[i] ? 0.15 : 1);
        if (rng() < rOn * dt) { clap[i] = 1; th[i] = (mode[i] ? Psi2 : Psi) + (rng() - .5) * 5.5; stamina[i] = 9 + 16 * rng(); }
      } else {
        const rOff = Math.max(0, 0.22 - ei) * 7 + (1 - heard) * 0.35 * (ei < 0.45 ? 1 : 0) + S.hush * 5 + (ei < 0.05 ? 2 : 0);
        if (rng() < rOff * dt) clap[i] = 0;
        // hands sting: a short pause, then back in
        stamina[i] -= dt * (1 + 0.5 * (1 - mode[i]));
        if (stamina[i] < 0 && S.lastMode === 0) { clap[i] = 0; rest[i] = 0.8 + 2.2 * rng(); stamina[i] = 9 + 16 * rng(); }
      }
      // standing: my own feeling, or what I see in front of me
      let fs = 0; const fr = p.front; for (let k = 0; k < fr.length; k++) fs += stand[fr[k]]; const seen = fr.length ? fs / fr.length : 0;
      const wantUp = (ei > tau[i] || (seen > sigma[i] && ei > 0.42)) && S.hush < 0.3;
      const wantDown = (ei < tau[i] - 0.4 && seen < 0.35) || S.hush > 0.5 || ei < 0.15;
      if (!stand[i] && wantUp) { pendT[i] += dt; if (pendT[i] > react[i]) { stand[i] = 1; pendT[i] = 0; S.events.push({ t: t + 0.12, type: 'thunk', i, g: 1 }); } }
      else if (stand[i] && wantDown) { pendT[i] += dt; if (pendT[i] > react[i] * 1.6) { stand[i] = 0; pendT[i] = 0; } }
      else pendT[i] = Math.max(0, pendT[i] - dt);
      standH[i] = approach(standH[i], stand[i], 5, dt);
      if (stand[i]) ns++;
      phone[i] = approach(phone[i], stand[i] && ei > phoneT[i] && S.lastMode === 0 ? 1 : 0, 1.5, dt);
      arms[i] = approach(arms[i], stand[i] && ei > 1.05 + armsT[i] ? 1 : 0, 2, dt);
      // clapping mode (Néda et al.): each person is either clapping fast and loose, or has dropped to the slow, even
      // mode at half the rate. You drop into it when the room wants rhythm and you can hear the pulse; you leave it
      // the moment the room wants to be louder.
      if (!mode[i]) { if (rng() < S.D * joins[i] * (0.25 + 2.2 * R2 * S.n2) * dt) { mode[i] = 1; th[i] = n2 > 3 ? Psi2 + (rng() - .5) * 1.2 : th[i]; } }
      else if (rng() < ((1 - S.D) * 1.6 + (joins[i] < 0.5 ? 0.5 : 0)) * dt) mode[i] = 0;
      m[i] = approach(m[i], mode[i], 5, dt);
      if (!clap[i]) continue;
      force[i] = (0.55 + 0.55 * Math.min(1.3, ei)) * (1 + 0.35 * m[i]) * (1 + 0.1 * stand[i]);
      const f = f1[i] * (0.9 + 0.15 * Math.min(1, ei)) * (1 - m[i]) + f2[i] * m[i];
      const K = 5.6 * m[i] * m[i];
      const prev = th[i];
      th[i] += (TAU * f + K * R2 * Math.sin(Psi2 - th[i])) * dt + 0.85 * Math.sqrt(dt) * rng.gauss();
      if (Math.floor(th[i] / TAU) !== Math.floor(prev / TAU)) {
        const tc = t - (((th[i] % TAU) + TAU) % TAU) / (TAU * f);
        emitClap(i, tc);
        if (m[i] > 0.8 && stamper[i] && S.D > 0.7 && R2 > 0.5 && (Math.floor(th[i] / TAU) & 1)) S.events.push({ t: tc + 0.01, type: 'stamp', i, g: 0.5 + 0.5 * m[i] });
      }
      if (whistler[i] && ei > 0.8 && rng() < (ei - 0.8) * 0.25 * dt) S.events.push({ t, type: 'whistle', i, g: 0.6 + 0.4 * rng() });
    }
    S.standFrac = ns / Math.max(1, present);
  }
  function emitClap(i, tc) {
    prevClap[i] = lastClap[i]; lastClap[i] = tc;
    S.events.push({ t: tc, type: 'clap', i, g: force[i] });
    S.clapRate += 1;
  }

  // everyone leaves, in a plausible order: aisle seats and the back first; one person stays
  // where someone is on their way out: along the row to the aisle, then up it; from the boxes, back through the door
  const walkOut = [0, 0];
  function walkOffset(i) {
    const lv = leave[i], p = P[i];
    if (lv <= 0) { walkOut[0] = 0; walkOut[1] = 0; return walkOut; }
    if (p.tier === 0) { const ax = Math.sign(p.x || 1) * 4.0, u = smooth(0, 0.35, lv), w = Math.max(0, lv - 0.35) / 0.65; walkOut[0] = (ax - p.x) * u; walkOut[1] = w * (24 - p.z); }
    else { const u = Math.min(1, lv * 1.6); walkOut[0] = -p.fx * 2.4 * u; walkOut[1] = -p.fz * 2.4 * u; }
    return walkOut;
  }
  // milk it, and a few people quietly reach for their coats while the rest are still clapping
  function earlyLeavers(frac, t0) {
    for (let i = 0; i < N; i++) { const p = P[i]; if (leaveAt[i] < 1e8 || i === S.lastIdx) continue;
      const aisle = p.tier === 0 ? Math.abs(Math.abs(p.x) - 4.0) < 1.2 : rng() < 0.5;
      if (aisle && rng() < frac) leaveAt[i] = t0 + rng() * 6; }
  }
  function beginLeaving(t0, nobody) {
    let last = -1, bs = -1;
    for (let i = 0; i < N && !nobody; i++) { const p = P[i]; if (p.tier === 0 && p.row >= 3 && p.row <= 5 && Math.abs(p.x) > 0.8 && Math.abs(p.x) < 2.6) { const s = base[i] + rng() * 0.2; if (s > bs) { bs = s; last = i; } } }
    S.lastIdx = last;
    for (let i = 0; i < N; i++) {
      if (i === last) continue;
      const p = P[i], aisle = p.tier === 0 ? Math.min(Math.abs(Math.abs(p.x) - 4.0), 3) / 3 : rng();
      leaveAt[i] = t0 + 1.0 + 16 * Math.pow(rng(), 0.8) * (0.5 + 0.5 * aisle) + (p.tier === 0 ? 0 : 2 * rng());
    }
  }

  return { S, N, P, e, clap, mode, rest, holdout, th, f1, f2, m, stand, standH, arms, leave, lastClap, prevClap, base, local, force, DT, step, stimulate, setGaze, firstClapper, beginLeaving, earlyLeavers, phone, walkOffset, shout };
}
