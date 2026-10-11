// main.js — one clock, one loop. The crowd is simulated a moment ahead of what you see so its sound can be placed on
// the audio thread to the sample; the picture reads the crowd's clap times from the past.

const Q = new URLSearchParams(location.search);
const DEBUG = Q.has('debug');
const LOOKAHEAD = 0.1;
const SPEED = +(Q.get('speed') || 1);   // testing only
const CALM = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('c');
const $said = document.getElementById('said'), $tally = document.getElementById('tally'), $title = document.getElementById('title'), $hint = document.getElementById('hint'), $end = document.getElementById('end'), $again = document.getElementById('again');
const house = buildHouse(1);
let nightSeed = +(Q.get('seed') || ((Date.now() / 1000) | 0) % 100000);
let night, crowd, dir, now = 0;
const cam = { eye: [0, 0, 0], yaw: 0, pitch: 0, roll: 0, zoom: 1 };
const L = { stage: 0, spot: 0, house: 0, chand: 0, time: 0, bow: 0, perfX: 0, spotX: 0, wing: 0, exposure: 1, fade: 1, inBeam: 1, lift: 0, seek: 0 };
function begin(seed, skipPreshow) {
  night = newNight(seed); crowd = createCrowd(house, night, now); dir = createDirector(night, crowd); L.night = (seed % 997) / 997;
  if (skipPreshow) { night.again = true; dir.title = 0; dir.start(true); }
  cam.zoom = 1; L.lift = 0; L.seek = 0;
}
begin(nightSeed, false);

const audio = createAudio(house);
let R = null, glFailed = false;
function makeRenderer() { try { R = createRenderer(canvas, house); } catch (e) { console.error(e); R = null; } if (!R) glFailed = true; }
makeRenderer();
if (!R) $title.innerHTML = '<p id="fail">This needs WebGL 2, which this browser doesn’t offer.<br>Try a recent Chrome, Safari, Firefox or Edge.</p>';
// phones drop GPU contexts: stop drawing, and rebuild when it comes back
canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); R = null; });
canvas.addEventListener('webglcontextrestored', () => { makeRenderer(); });

// ── input ───────────────────────────────────────────────
// A press becomes a bow unless it turns out to be a drag (a walk) within a moment; a quick tap is still a whole bow.
let down = null, keysWalk = 0, dragging = false, pressTimer = 0, pressed = false;
function unlock() { audio.start(); }
function doPress() { if (!pressed) { pressed = true; dir.press(); } }
canvas.addEventListener('pointerdown', e => {
  if (down) return;                                   // one performer, one body: ignore a second finger
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  unlock();
  down = { x: e.clientX, y: e.clientY, id: e.pointerId, lastX: e.clientX };
  dragging = false; pressed = false;
  if (dir.phase === 'preshow' || dir.phase === 'end') { doPress(); return; }
  clearTimeout(pressTimer); if (!(dir.torch > 0.3 && R && R.torchScreenX != null && e.clientX > R.torchScreenX - innerWidth * 0.12)) pressTimer = setTimeout(() => { if (down && !dragging) doPress(); }, 130);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse' && !down) dir.look(-(e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);   // screen-right is world −x
  if (!down || e.pointerId !== down.id) return;
  const dx = e.clientX - down.x;
  if (!dragging && Math.abs(dx) > 14) { dragging = true; clearTimeout(pressTimer); if (pressed) dir.release(); }
  if (dragging) { dir.walkBy(-(e.clientX - down.lastX) / Math.max(320, innerWidth) * 12); down.lastX = e.clientX; }
});
const up = e => {
  if (!down || e.pointerId !== down.id) return;
  unlock();                                           // on touch screens, only the lift of the finger may start audio
  clearTimeout(pressTimer);
  if (!dragging && !pressed && e.type === 'pointerup') {
    if (dir.torch > 0.3 && R && R.torchScreenX != null && e.clientX > R.torchScreenX - innerWidth * 0.12) dir.walkTo(-9.4);   // follow the torch toward the wing
    else doPress();
  }
  down = null; dir.release();
};
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());
const isLeft = k => k === 'ArrowLeft' || k === 'a' || k === 'A', isRight = k => k === 'ArrowRight' || k === 'd' || k === 'D';
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target === $again) return;
  if (e.repeat) { if (isLeft(e.key) || isRight(e.key) || e.key === ' ') e.preventDefault(); return; }
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); unlock(); if (dir.phase === 'end') return; dir.press(); }
  else if (isLeft(e.key) || isRight(e.key)) { e.preventDefault(); unlock(); const s = isLeft(e.key) ? 1 : -1; keysWalk = s; if (dir.phase === 'preshow') dir.press(); else dir.walkBy(1.6 * s); }
});
addEventListener('keyup', e => {
  if (e.key === ' ' || e.key === 'Enter') dir.release();
  if (isLeft(e.key) && keysWalk < 0) keysWalk = 0;
  if (isRight(e.key) && keysWalk > 0) keysWalk = 0;
});
function letGo() { keysWalk = 0; if (down) { down = null; clearTimeout(pressTimer); } dir.release(); }
addEventListener('blur', letGo);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) letGo();
  if (!audio.ctx) return;
  if (document.hidden) audio.ctx.suspend().catch(() => {}); else audio.ctx.resume().catch(() => {});
});
$again.addEventListener('click', e => { e.stopPropagation(); if (dir.endText < 0.9) return; unlock(); restart(); });
function restart() {
  nightSeed = (nightSeed * 7919 + 17) % 100000; begin(nightSeed, true);
  $end.style.transition = 'none'; $end.style.opacity = 0; $end.style.visibility = 'hidden';
  requestAnimationFrame(() => { $end.style.transition = ''; });
  canvas.focus({ preventScroll: true });
}

// ── the loop ────────────────────────────────────────────
let t0 = performance.now() / 1000, last = 0, frames = 0, fpsT = 0, fps = 0;
const $dbg = DEBUG ? Object.assign(document.body.appendChild(document.createElement('div')), { id: 'dbg' }) : null;
const listener = { x: 0, yaw: 0 };

function loop() {
  requestAnimationFrame(loop);
  now = performance.now() / 1000 - t0;
  let dt = now - last;
  if (dt > 0.25) { t0 += dt - 1 / 60; now = last + 1 / 60; dt = 1 / 60; } // after a hidden tab: carry on, don't catch up
  last = now;
  if (SPEED !== 1) { dt *= SPEED; now = (window.__simT = (window.__simT || 0) + dt); }
  if (keysWalk) dir.walkBy(keysWalk * 2.2 * dt);
  // the night
  dir.update(dt);
  while (crowd.S.t < now + LOOKAHEAD) crowd.step(crowd.DT);
  // one-off sounds the director asks for
  for (const c of dir.cues) {
    if (c.type === 'clunk') audio.fx('clunk', 0.55, 0);
    else if (c.type === 'cough') { const i = (Math.random() * crowd.N) | 0; crowd.S.events.push({ t: now + 0.2, type: 'cough', i, g: 1 }); }
    else if (c.type === 'step') { audio.fx('step', 0.2, 0, true); if (Math.random() < 0.18) audio.fx('creak', 0.05, 0, true); }
    else if (c.type === 'flower') audio.fx('flower', 0.28, clamp(-(c.x - dir.x) * 0.3, -1, 1), true);
    else if (c.type === 'rustle') audio.fx('rustle', 0.035, Math.random() * 2 - 1);
    else if (c.type === 'restart') restart();
    else if (c.type === 'boo') { let i = -1; for (let k = 0; k < 300 && i < 0; k++) { const j = (Math.random() * crowd.N) | 0; if (house.people[j].tier === 4) i = j; } if (i >= 0) crowd.S.events.push({ t: now + 0.4, type: 'boo', i, g: 1 }); }
    else if (c.type === 'heart') audio.fx('heart', 0.1, 0, true);
    else if (c.type === 'cheerOne') { const i = crowd.S.lastIdx; if (i >= 0) crowd.S.events.push({ t: now + 0.3, type: 'whistle', i, g: 1.4 }); }
  }
  dir.cues.length = 0;
  // the house's voice: short wordless shouts from random seats, more of them the louder the room feels
  { const cheer = Math.max(dir.cheer, dir.phase === 'ovation' ? 0.18 * smooth(0.85, 1.2, crowd.S.G) : 0);
    let n = cheer * 45 * dt;
    if (Math.random() < cheer * 3 * dt) { const i = (Math.random() * 90) | 0; if (house.people[i] && house.people[i].tier === 0 && !crowd.leave[i]) crowd.shout[i] = 1; }
    while (n > 0) { if (Math.random() < n) { const i = (Math.random() * crowd.N) | 0; if (!crowd.leave[i]) { crowd.S.events.push({ t: now + 0.05 + Math.random() * 0.05, type: 'shout', i, g: 0.6 + 0.6 * Math.random() }); crowd.shout[i] = 1; } } n -= 1; } }
  // the pit: a dozen string players tapping their bows on their stands while the house is warm
  if (dir.phase === 'ovation' && crowd.S.G > 0.5 && !dir.offstage) {
    for (let k = 0; k < 2; k++) if (Math.random() < dt * 14 * Math.min(1, crowd.S.G)) audio.fx('bowtap', 0.07 + 0.05 * Math.random(), (Math.random() * 2 - 1) * 0.6 + dir.x * 0.05);
  }
  // camera: you are the performer
  const wingT = smooth(WING_X - 0.6, WING_X + 1.6, Math.abs(dir.x));
  const moving = Math.abs(dir.vx) > 0.15;
  const bob = moving && !CALM ? Math.abs(Math.sin(dir.stepPhase * Math.PI)) * 0.035 : 0;
  const bowE = dir.bow * dir.bow * (3 - 2 * dir.bow);
  cam.eye[0] = dir.x; cam.eye[1] = STAGE_Y + EYE - bowE * 0.34 + bob + (CALM ? 0 : Math.sin(now * 1.6) * 0.004); cam.eye[2] = PERF_Z + bowE * 0.32 - wingT * 0.3;
  cam.yaw = dir.lookYaw + dir.walkYaw + L.seek * 0.8 - 0.3 * Math.sin(Math.PI * clamp((1.4 - (dir.glanceT || 0)) / 1.4, 0, 1)) * (dir.glanceT > 0 ? 1 : 0) - Math.sign(dir.x) * wingT * 1.36 + (CALM ? 0 : Math.sin(now * 0.43) * 0.004);
  L.lift = approach(L.lift, dir.phase === 'leaving' ? smooth(0, 6, dir.phaseT) * 0.1 : 0, 0.6, dt);
  // in the empty house your eyes find the one who stayed
  let seek = 0;
  if ((dir.phase === 'last' || dir.phase === 'closing') && crowd.S.lastIdx >= 0) { const i = crowd.S.lastIdx, p = house.people[i], w = crowd.walkOffset(i); seek = Math.atan2(p.x + w[0] - dir.x, p.z + w[1] - PERF_Z); }
  L.seek = approach(L.seek, seek, 0.7, dt);
  cam.zoom = approach(cam.zoom, seek ? 0.66 : 1, seek ? 0.2 : 1, dt);
  cam.pitch = -0.035 + dir.lookPitch - bowE * 1.02 - wingT * 0.06 + L.lift * cam.zoom - (1 - cam.zoom) * 0.22;
  cam.roll = moving && !CALM ? Math.sin(dir.stepPhase * Math.PI) * 0.004 : 0;
  // light
  L.stage = dir.stage; L.spot = dir.spot; L.house = dir.house; L.chand = Math.max(0.05 * dir.stage, dir.chand); L.time = now; L.bow = bowE;
  L.perfX = dir.x; L.spotX = dir.spotX; L.wing = wingT; L.fade = dir.fade; L.inBeam = clamp(1 - Math.abs(dir.x - dir.spotX) / 1.2, 0, 1);
  L.exposure = 1.0 * (1 - 0.3 * dir.house);
  // sound
  listener.x = dir.x; listener.yaw = cam.yaw; listener.surge = crowd.S.surge || 0;
  audio.schedule(crowd.S.events, now, listener);
  audio.update(dt, listener, crowd.S, dir);
  // picture
  if (R && !(dir.phase === 'end' && dir.fade > 0.998)) R.frame(cam, L, crowd, dir, now);
  else if (R) { R.gl.bindFramebuffer(R.gl.FRAMEBUFFER, null); R.gl.clearColor(0, 0, 0, 1); R.gl.clear(R.gl.COLOR_BUFFER_BIT); }
  // words
  if (!glFailed) $title.style.opacity = dir.title.toFixed(3);
  const needSound = !audio.running() && !audio.failed;
  $hint.style.opacity = (dir.phase === 'preshow' || (dir.phase === 'breath' && dir.phaseT > 1.5) ? 0.9 : (needSound && dir.phase !== 'end' ? (dir.t < 14 ? 0.8 : dir.t < 25 ? 0.45 : 0) * (1 - dir.fade) : 0)).toFixed(3);
  if (dir.phase !== 'preshow') $hint.lastChild.textContent = dir.phase === 'breath' ? (audio.running() || audio.failed ? 'they are waiting' : 'they are waiting \u00b7 sound on') : 'tap for sound';
  if (dir.phase === 'end' && !dir.tallied) {
    dir.tallied = true; const a = Math.round(dir.applauseT), parts = [`${Math.floor(a / 60)}′ ${String(a % 60).padStart(2, '0')}″ of applause`];
    if (dir.returns) parts.push(`${dir.returns} curtain call${dir.returns > 1 ? 's' : ''}`);
    if (dir.roses) parts.push(`${dir.roses} rose${dir.roses > 1 ? 's' : ''}`);
    const said = dir.spoiled ? 'You asked for one bow too many.' : dir.returns >= 2 ? `They called you back ${['', 'once', 'twice', 'three times', 'four times'][dir.returns] || dir.returns + ' times'}.` : dir.returns === 1 ? 'They called you back.' : dir.maxStand > 0.6 ? 'They stood for you.' : 'They were kind.';
    $said.textContent = said;
    $tally.innerHTML = parts.map(x => `<span>${x}</span>`).join('<i> \u00b7 </i>');
  }
  // the end card only exists when it is showing: nothing invisible can be tapped
  const endOn = dir.endText > 0.02;
  $end.style.opacity = dir.endText.toFixed(3); $end.style.visibility = endOn ? 'visible' : 'hidden'; $end.style.pointerEvents = dir.endText > 0.5 ? 'auto' : 'none';
  frames++; fpsT += dt; if (fpsT > 0.5) { fps = frames / fpsT; frames = 0; fpsT = 0; }
  if ($dbg) { const S = crowd.S; $dbg.textContent = `${dir.phase} ${dir.phaseT.toFixed(1)}s  fps ${fps.toFixed(0)}  N ${crowd.N}\nG ${S.G.toFixed(2)} D ${S.D.toFixed(2)} clap ${(S.frac * 100).toFixed(0)}% R ${S.R.toFixed(2)} mII ${S.meanM.toFixed(2)} stand ${(S.standFrac * 100).toFixed(0)}% left ${(S.leaving * 100).toFixed(0)}%\nfresh ${dir.fresh.toFixed(2)} budget ${dir.budget.toFixed(2)} x ${dir.x.toFixed(1)} bow ${dir.bow.toFixed(2)} audio ${audio.running()}${audio.engine ? ' ' + audio.engine.kind : ''}`; }
}
requestAnimationFrame(loop);

// hooks for the test harness
window.__ov = { get dir() { return dir; }, get crowd() { return crowd; }, audio, house, get fps() { return fps; },
  bow(ms) { dir.press(); setTimeout(() => dir.release(), ms || 400); }, walk(x) { dir.walkTo(x); }, restart };
