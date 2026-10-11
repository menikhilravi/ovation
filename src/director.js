// director.js — the shape of one night. Nothing here is scripted beat-for-beat: it sets the room's energy (G), its wish
// for rhythm (D) and the lights, and the crowd model does the rest. The performer (you) is state here too.

function newNight(seed) {
  const r = makeRng(seed * 13 + 5);
  // every night is a different house: warmer or cooler, more or less inclined to fall into rhythm
  const mood = clamp(0.86 + 0.11 * r.gauss(), 0.64, 1.04);
  return { seed, mood, tempo: clamp(1 + 0.05 * r.gauss(), 0.9, 1.1), rhythmic: clamp(0.72 + 0.16 * r.gauss(), 0.35, 0.95), perfX: 0 };
}

function createDirector(night, crowd) {
  const S = crowd.S;
  const D = {
    phase: 'preshow', t: 0, phaseT: 0, audioOn: false,
    // lights
    spot: 0, spotX: 0, stage: 0, house: 0, chand: 0.08, fade: 1, title: 1,
    // performer
    x: 0, tx: 0, vx: 0, bow: 0, bowing: false, bowHeld: 0, bowPeak: 0, bowFired: false, lookYaw: 0, lookPitch: 0, walkYaw: 0, stepPhase: 0,
    offstage: false, offT: 0, returns: 0,
    // the room's economy of love
    fresh: 1, budget: 1, lastStim: -99, quietT: 0, lastPhaseWave: 0,
    flowers: [], cues: [], lastBowAt: -99, lastTapT: -99, cheer: 0, applauseT: 0, roses: 0, torch: 0, torchT: 0, everOff: false,
    conductor: { clap: 0, arms: 0 },
    endText: 0,
  };
  const cue = (type, extra) => D.cues.push(Object.assign({ type, t: D.t }, extra || {}));
  const setPhase = p => { D.phase = p; D.phaseT = 0; };

  function start(withAudio) {
    if (D.phase !== 'preshow') return;
    D.audioOn = withAudio; setPhase('lights');
  }

  // ── input ───────────────────────────────────────────────
  function press() {
    D.lastTapT = D.t; D.touched = true;
    if (D.phase === 'preshow') { start(true); return; }
    if (D.phase === 'lights') return;
    if (D.phase === 'end') return;
    if (D.offstage || Math.abs(D.tx) > WING_X) { D.tx = 0; return; }   // in the wings a tap means: go back on
    D.bowing = true; D.bowHeld = 0; D.bowFired = false; D.pressT = D.t; D.releaseAsked = false;
  }
  // a tap still makes a whole bow: you go down, you stay a beat, you come up
  function release() { D.releaseAsked = true; }
  function walkBy(dxMetres) { D.tx = clamp(D.tx + dxMetres, -9.4, 9.4); noteExit(); }
  function walkTo(x) { D.tx = clamp(x, -9.4, 9.4); noteExit(); }
  // the moment you head for the wings is the moment the house judges your exit
  function noteExit() { if (Math.abs(D.tx) > WING_X && !D.exitJudged && D.phase === 'ovation') { D.exitJudged = true; D.goodExit = S.G > 0.42 && D.phaseT > 4 && D.returns < 4 && D.budget > 0.12; D.callLen = 8 + 7 * D.budget; D.exitAt = D.t; } if (Math.abs(D.tx) <= WING_X) D.exitJudged = false; }
  function look(nx, ny) { D.lookYaw = nx * 0.2; D.lookPitch = -ny * 0.09; }

  // ── the bow lands ──────────────────────────────────────
  function bowLands(depth) {
    const deep = smooth(0.4, 1, depth);
    if (D.phase === 'ovation' || D.phase === 'breath') {
      if (D.phase === 'breath') { setPhase('ovation'); D.first = crowd.firstClapper(); S.G = 0.2; D.lastStim = D.t; D.bows = 0; return; }   // your bow breaks the silence
      // a bow is worth most when the room is starting to let go, least when it's already on its feet; the first one
      // is the one they've been waiting for; every one draws on a finite reserve of love
      const timing = clamp(1.3 - 0.55 * S.G, 0.55, 1.2), first = D.bows ? 1 : 1.3;
      const gain = (0.2 + 0.26 * deep) * D.fresh * timing * first * Math.pow(D.budget, 0.7);
      S.G = Math.min(1.32, S.G + gain);
      D.cheer = Math.min(1, D.cheer + 0.25 + 0.6 * gain); S.surge = Math.min(1, (S.surge || 0) + gain * 2.2);
      crowd.stimulate(0.55 * gain, 0.35);            // those you face feel it most, but it comes from the same reserve
      S.D = Math.max(0, S.D - 0.55);                 // wanting more breaks the rhythm
      const greedy = D.budget < 0.3 && D.fresh < 0.55;
      D.budget = Math.max(0, D.budget - 0.055 * (1 + 1.5 * (1 - D.fresh))); D.fresh *= 0.72; D.lastStim = D.t;
      D.bows = (D.bows || 0) + 1;
      if (greedy) { if (!D.booed) { D.booed = true; cue('boo'); } if (S.leaving < 0.2) crowd.earlyLeavers(0.05 + 0.1 * (0.3 - D.budget), crowd.S.t + 1); }
      // bow on and on after there's nothing left to give, and the house manager brings the lights up on you mid-bow
      if (D.budget <= 0) { D.spent = (D.spent || 0) + 1; if (D.spent >= 3) { D.spoiled = true; setPhase('leaving'); crowd.beginLeaving(crowd.S.t + 0.5, true); S.G = Math.min(S.G, 0.3); cue('houselights'); } }
      if (S.G > 0.8 && S.standFrac > 0.35 && Math.random() < 0.6) throwFlowers(2 + (Math.random() * 3 | 0));
    } else if (D.phase === 'leaving') {
      // a few people on their way out turn and clap again, briefly; the ones nearest the stage most
      S.G = Math.min(0.3, S.G + 0.16 * D.fresh); crowd.stimulate(0.22 * D.fresh, 0.08); D.fresh *= 0.6; D.cheer = Math.max(D.cheer, 0.15 * D.fresh);
    } else if (D.phase === 'last' && !D.lastBowed) {
      D.lastBowed = true; if (S.lastMode === 1) { S.lastMode = 3; D.lastStep = 2; D.lastStopAt = D.t; cue('cheerOne'); }
    }
  }

  function throwFlowers(n) {
    const P = crowd.P;
    for (let k = 0; k < n; k++) {
      let i = -1; for (let tries = 0; tries < 400; tries++) { const j = (Math.random() * crowd.N) | 0; if ((P[j].tier === 0 && P[j].row < 5) || (P[j].tier === 1 && P[j].row === 0 && Math.random() < 0.3)) { i = j; break; } }
      if (i >= 0) crowd.stand[i] = 1;   // you stand up to throw
      if (i < 0) continue;
      const aim = Math.abs(D.tx) < WING_X ? D.tx : D.x, p = P[i], tx = clamp(aim + (Math.random() - .5) * 2.6, -6.5, 6.5), tz = PERF_Z + 0.5 + Math.random() * 2.4;
      D.flowers.push({ x0: p.x, y0: p.y + 1.7, z0: p.z, x1: tx, z1: tz, t0: D.t + k * 0.35 + Math.random() * 0.3, dur: 1.0 + Math.random() * 0.35, spin: (Math.random() - .5) * 14, rot0: Math.random() * TAU, landed: false, hue: Math.random() });
    }
  }

  // ── per-frame ──────────────────────────────────────────
  function update(dt) {
    D.t += dt; D.phaseT += dt;
    // performer body
    const dx = D.tx - D.x; const want = clamp(dx * 2.2, -1.7, 1.7);
    D.vx = approach(D.vx, want, 6, dt); D.x += D.vx * dt; night.perfX = D.x;
    const moving = Math.abs(D.vx) > 0.15;
    if (moving) { const prev = D.stepPhase; D.stepPhase += Math.abs(D.vx) * dt / 0.7; if (Math.floor(prev) !== Math.floor(D.stepPhase)) cue('step', { x: D.x }); }
    D.walkYaw = approach(D.walkYaw, moving ? clamp(D.vx * 0.1, -0.15, 0.15) : 0, 3, dt);
    if (D.bowing) { D.bowHeld += dt; if (D.releaseAsked && D.t - D.pressT > 0.5) D.bowing = false; }
    const bowTarget = D.bowing ? clamp(0.45 + D.bowHeld * 0.5, 0, 1) : 0;
    D.bow = approach(D.bow, bowTarget, D.bowing ? 3.6 : 3.2, dt);
    if (D.bowing && !D.bowFired && D.bow > 0.34) { D.bowFired = true; D.bowPeak = 0; D.lastBowAt = D.t; }
    if (D.bowFired && D.bowing) D.bowPeak = Math.max(D.bowPeak, D.bow);
    if (D.bowFired && (!D.bowing || D.bowHeld > 1.6) && !D.bowLanded) { D.bowLanded = true; bowLands(Math.max(D.bowPeak, D.bow)); }
    if (!D.bowing) { D.bowFired = false; D.bowLanded = false; }
    // where you face decides who feels it most
    const yaw = D.lookYaw + D.walkYaw;
    crowd.setGaze(Math.sin(yaw), Math.cos(yaw), 1);
    // the follow-spot operator keeps up, a little late
    // …and when you leave, it goes back to where you stood and waits for you
    D.spotX = approach(D.spotX, D.offT > 1.0 ? 0 : clamp(D.x, -WING_X + 0.4, WING_X - 0.4), D.offT > 1.0 ? 1.6 : 2.2, dt);
    const wasOff = D.offstage; D.offstage = Math.abs(D.x) > WING_X; if (D.offstage) D.everOff = true;
    // the stage manager, once, when the first wave has peaked and you haven't thought of leaving: a torch waves from the wing
    if (D.phase === 'ovation' && !D.offstage && Math.abs(D.tx) < WING_X && D.returns < 3 && D.phaseT > 9 && S.G > 0.5 && D.t - (D.lastTorch || -99) > 16 && D.t - (D.lastReturnT || -99) > 7) { D.lastTorch = D.t; D.torchT = 6; if (!D.glanced) { D.glanced = true; D.glanceT = 1.4; } }
    D.glanceT = Math.max(0, (D.glanceT || 0) - dt);
    D.torchT = Math.max(0, D.torchT - dt); D.torch = approach(D.torch, D.torchT > 0 && !D.offstage ? 1 : 0, 4, dt);
    // the conductor claps along with the house, and cheers you back on
    const cond = D.conductor; cond.clap = (D.phase === 'ovation' && S.G > 0.3) || (D.phase === 'leaving' && D.phaseT < 3) ? 1 : 0;
    cond.arms = approach(cond.arms, D.condCheer > D.t ? 1 : 0, 3, dt);
    if (D.phase === 'leaving' && D.phaseT > 4 || D.phase === 'last' || D.phase === 'closing' || D.phase === 'end') cond.gone = Math.min(1, (cond.gone || 0) + dt / 6);
    D.fresh += (1 - D.fresh) * 0.045 * dt;
    D.cheer = Math.max(0, D.cheer - dt * 0.28); S.surge = Math.max(0, (S.surge || 0) - dt * 0.45);
    if (D.phase === 'ovation' && D.phaseT > 1.5 && D.phaseT < 3.5) D.cheer = Math.max(D.cheer, 0.55 * night.mood);

    const P = D.phase;
    if (P === 'preshow') {
      D.title = 1; if (D.phaseT > 3.8) start(false);
    } else if (P === 'lights') {
      D.title = approach(D.title, 0, 7, dt); if (D.title < 0.25) D.fade = approach(D.fade, 0, 2.5, dt);
      if (D.phaseT > 0.35 && !D.clunked) { D.clunked = true; cue('clunk'); }
      if (D.clunked) { D.spot = approach(D.spot, 1, 14, dt); D.stage = approach(D.stage, 1, 2, dt); }
      if (D.phaseT > 1.2) { setPhase('breath'); cue('cough'); }
    } else if (P === 'breath') {
      D.title = approach(D.title, 0, 7, dt); D.fade = approach(D.fade, 0, 2.5, dt);
      D.spot = approach(D.spot, 1, 8, dt); D.stage = approach(D.stage, 1, 2, dt);
      if (D.t - (D.lastBeat || -9) > 0.62) { D.lastBeat = D.t; cue('heart'); }
      // they wait for you to bow. If you never do, someone can't hold it in any longer.
      if (D.phaseT > 9) { setPhase('ovation'); D.first = crowd.firstClapper(); S.G = 0.2; D.lastStim = D.t; }
    } else if (P === 'ovation') {
      D.fade = approach(D.fade, 0, 2, dt);
      // the first wave: it builds by itself for a few seconds after that first clap
      const opening = D.phaseT < 4.5;
      if (opening) S.G = Math.min(0.76 * night.mood + 0.04, S.G + dt * 0.3);
      else if (!D.offstage) {
        const tau = 14 * (1 + 1.0 * smooth(0.15, 0.5, S.n2 || 0));   // a rhythmic house is a patient house
        S.G -= S.G / tau * dt;
      }
      // Néda's cycle: a house that has held its rhythm for a while wants to be louder, speeds up, and loses it
      if ((S.n2 || 0) > 0.55 && !D.offstage) { D.syncT = (D.syncT || 0) + dt; if (D.syncT > (D.syncLen || (D.syncLen = 7 + 6 * Math.random()))) { D.surgeT = 3.2; D.syncT = 0; D.syncLen = 7 + 6 * Math.random(); S.G = Math.min(1.1, S.G + 0.07); D.cheer = Math.max(D.cheer, 0.35); } }
      else D.syncT = Math.max(0, (D.syncT || 0) - dt * 2);
      if (D.surgeT > 0) { D.surgeT -= dt; S.D = approach(S.D, 0.02, 3, dt); }
      // walking off: a good exit makes them call you back, in rhythm; a hasty one just lets the applause go
      if (D.offstage) {
        if (D.offT === 0 && !D.exitJudged) { D.goodExit = S.G > 0.42 && D.returns < 4 && D.budget > 0.12; D.callLen = 8 + 7 * D.budget; }
        D.offT += dt;
        if (D.goodExit && D.offT < D.callLen) { S.G = Math.min(1.0, S.G + 0.01 * dt); S.D = approach(S.D, 1, 0.35, dt); }
        else { S.G -= S.G / (D.goodExit ? 5 : D.offT < 6 ? 9 : 3.5) * dt; S.D = approach(S.D, 0, 0.3, dt); }
      } else {
        if (wasOff) { // you came back
          const calling = D.goodExit && D.offT < D.callLen + 1; D.exitJudged = false;
          const g = calling ? 0.5 * Math.pow(0.72, D.returns) * (0.3 + 0.7 * D.budget) : 0.12;
          if (S.G > 0.05 || !calling) {
            S.G = Math.min(1.32, S.G + g); D.cheer = calling ? 1 : 0.2; crowd.stimulate(calling ? 0.25 * Math.pow(0.7, D.returns) * (0.3 + 0.7 * D.budget) : 0.04, 0.6); S.D = Math.max(0, S.D - 0.7);
            if (calling) { throwFlowers(3 + (Math.random() * 4 | 0)); D.condCheer = D.t + 2.5; }
          }
          if (calling) { D.returns++; D.budget = Math.max(0, D.budget - 0.14); } D.lastReturnT = D.t;
          D.lastStim = D.t;
        }
        D.offT = 0;
        // left alone at a good level, the house finds its rhythm (on some nights more than others)
        const settled = D.t - D.lastStim > 3 && S.G > 0.38 && S.frac > 0.45 && !(D.surgeT > 0);
        S.D = approach(S.D, settled ? night.rhythmic : 0, settled ? 0.24 : 0.5, dt);
      }
      S.D = clamp(S.D, 0, 1);
      // when it has died away, the house lights come up
      if (S.frac < 0.035 && S.G < 0.14 && D.phaseT > 14 && (!D.offstage || D.offT > 12)) D.quietT += dt; else D.quietT = 0;
      if (D.quietT > 2.6) { setPhase('leaving'); crowd.beginLeaving(crowd.S.t + 0.5); S.G = 0; cue('houselights'); }
    } else if (P === 'leaving') {
      D.house = approach(D.house, 0.62, 0.5, dt); D.chand = approach(D.chand, 0.8, 0.4, dt);
      S.G -= S.G / (D.t - D.lastBowAt < 3 ? 6 : 3) * dt; S.D = approach(S.D, 0, 1, dt);
      if (Math.random() < 0.8 * dt * (1 - S.leaving)) cue('rustle');
      if (S.gone > 0.97 && D.phaseT > 9) { if (S.lastIdx >= 0) { setPhase('last'); D.lastStep = 0; } else setPhase('closing'); }
    } else if (P === 'last') {
      D.house = approach(D.house, 0.5, 0.35, dt); D.chand = approach(D.chand, 0.45, 0.35, dt);
      // the one who stayed
      if (D.lastStep === 0 && D.phaseT > 1.4) { D.lastStep = 1; S.lastMode = 1; D.lastClapStart = D.t; }
      if (D.lastStep === 1 && (D.lastBowed || D.t - D.lastClapStart > 8.5)) { D.lastStep = 2; S.lastMode = 2; D.lastStopAt = D.t; }
      if (D.lastStep === 2 && D.t - D.lastStopAt > (D.lastBowed ? 3.2 : 1.4)) { D.lastStep = 3; crowd.leave[S.lastIdx] = 1e-4; }
      if (D.lastStep === 3 && D.t - D.lastStopAt > 6.5) setPhase('closing');
    } else if (P === 'closing') {
      D.house = approach(D.house, 0, 0.5, dt); D.chand = approach(D.chand, 0, 0.5, dt);
      if (D.phaseT > 3.5 && !D.offClunk) { D.offClunk = true; cue('clunk'); }
      if (D.offClunk) { D.spot = approach(D.spot, 0, 12, dt); D.stage = approach(D.stage, 0, 1.2, dt); D.fade = approach(D.fade, 1, 0.5, dt); }
      if (D.phaseT > 7) setPhase('end');
    } else if (P === 'end') {
      D.fade = approach(D.fade, 1, 1, dt); D.endText = approach(D.endText, 1, 1.2, dt);
    }
    // flowers in flight
    for (const f of D.flowers) if (!f.landed && D.t > f.t0 + f.dur) { f.landed = true; D.roses++; cue('flower', { x: f.x1, z: f.z1 }); }
    if (S.frac > 0.2 && D.phase === 'ovation') D.applauseT += dt;
    D.maxStand = Math.max(D.maxStand || 0, S.standFrac || 0);
  }

  return Object.assign(D, { start, press, release, walkBy, walkTo, look, update, throwFlowers });
}
