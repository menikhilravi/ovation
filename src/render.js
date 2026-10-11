// render.js — the house, the people in it, the light in the air.

const LIGHT_GLSL = `
uniform float uStage, uSpot, uHouse, uChand, uTime, uBow, uExposure;
uniform vec3 uCam, uPerf, uBooth, uChandPos;
// Light arriving at a point in the auditorium: the stage wash spilling out over the pit, the footlights raking up into
// the front rows, the house lights and chandelier (only at the end), a little ambient so the dark stays readable.
vec3 houseLight(vec3 p, vec3 n) {
  vec3 Ls = vec3(uPerf.x * .4, 7.5, -3.5); vec3 d = Ls - p; float r2 = dot(d, d); vec3 l = d * inversesqrt(r2);
  vec3 stage = vec3(1., .72, .48) * uStage * 70. / (r2 + 25.) * exp(-sqrt(r2) * .07) * max(0., dot(n, l) * .75 + .25);
  vec3 Lf = vec3(clamp(p.x, -6.5, 6.5), 1.25, .1); d = Lf - p; r2 = dot(d, d); l = d * inversesqrt(r2);
  vec3 foot = vec3(1., .58, .32) * uStage * 6. / (r2 + 4.) * max(0., dot(n, l) * .7 + .3);
  vec3 hl = vec3(1., .8, .58) * uHouse * (.5 + .5 * n.y) * 1.25;
  vec3 Lc = uChandPos - p; r2 = dot(Lc, Lc);
  vec3 ch = vec3(1., .78, .52) * uChand * 140. / (r2 + 40.) * max(0., dot(n, Lc * inversesqrt(r2)) * .6 + .4);
  vec3 amb = vec3(.016, .011, .009) * (.7 + .3 * n.y) * (1. + uStage);
  return stage + foot + hl + ch + amb;
}
float sq(float x) { return x * x; }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), f.x), f.y); }
`;

function createRenderer(canvas, house) {
  const K = createGL(canvas);
  if (!K) return null;
  const { gl } = K;
  const R = { K, gl, w: 0, h: 0, dpr: 1, scale: 1 };

  // ─────────────────────────── geometry of the hall ───────────────────────────
  const V = [], I = []; // pos3 nrm3 uv2 mat1
  const vert = (p, n, u, v, m) => { V.push(p[0], p[1], p[2], n[0], n[1], n[2], u, v, m); return V.length / 9 - 1; };
  function quad(a, b, c, d, m, uv) { // a b c d counter-clockwise, normal from winding
    const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
    uv = uv || [0, 0, 1, 0, 1, 1, 0, 1];
    const i0 = vert(a, n, uv[0], uv[1], m), i1 = vert(b, n, uv[2], uv[3], m), i2 = vert(c, n, uv[4], uv[5], m), i3 = vert(d, n, uv[6], uv[7], m);
    I.push(i0, i1, i2, i0, i2, i3);
  }
  // an oriented box: centre, half-extents along (right, up, forward) with forward = (fx, 0, fz)
  function box(cx, cy, cz, hw, hh, hd, fx, fz, m, faces) {
    const rx = fz, rz = -fx; // right = up × forward (in plan)
    const P = (sx, sy, sz) => [cx + rx * hw * sx + fx * hd * sz, cy + hh * sy, cz + rz * hw * sx + fz * hd * sz];
    const F = faces || 'fbtlr';
    if (F.includes('f')) quad(P(1, -1, 1), P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1), m);
    if (F.includes('b')) quad(P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), m);
    if (F.includes('t')) quad(P(-1, 1, 1), P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), m);
    if (F.includes('l')) quad(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1), m);
    if (F.includes('r')) quad(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), m);
  }
  // stage and pit
  quad([-11, STAGE_Y, 0.3], [11, STAGE_Y, 0.3], [11, STAGE_Y, -13], [-11, STAGE_Y, -13], 0, [-11, 0.3, 11, 0.3, 11, -13, -11, -13]);
  quad([-11, -2.2, 0.3], [-11, STAGE_Y, 0.3], [11, STAGE_Y, 0.3], [11, -2.2, 0.3], 11);           // stage front
  quad([-11, -1.4, 0.3], [11, -1.4, 0.3], [11, -1.4, 3.0], [-11, -1.4, 3.0], 11);                 // pit floor (an orchestra lift)
  quad([11, -2.2, 3.0], [11, 0.95, 3.0], [-11, 0.95, 3.0], [-11, -2.2, 3.0], 13, [11, 0, 11, 1, -11, 1, -11, 0]); // pit rail wall
  quad([-11, 0.95, 3.0], [11, 0.95, 3.0], [11, 0.95, 3.18], [-11, 0.95, 3.18], 4);                // rail top
  // stalls floor, raked
  quad([-12.6, -0.05, 3.1], [12.6, -0.05, 3.1], [12.6, 2.3, 26], [-12.6, 2.3, 26], 1, [-12.6, 3.1, 12.6, 3.1, 12.6, 26, -12.6, 26]);
  // tiers: parapet, soffit, box walls, partitions, back walls
  HOUSE.tiers.forEach((top, ti) => {
    const c0 = horseshoeCurve(0), cB = horseshoeCurve(3.3), step = 0.5;
    const nextTop = ti < 3 ? HOUSE.tiers[ti + 1] : HOUSE.ceilingY + 1.05;
    for (let s = 0; s < c0.length - 1e-3; s += step) {
      const s2 = Math.min(c0.length, s + step), a = c0.at(s), b = c0.at(s2);
      if (a.z < HOUSE.sideZ0 + 0.1 && b.z < HOUSE.sideZ0 + 0.1) continue;
      const fa = s / c0.length * cB.length, fb = s2 / c0.length * cB.length, A2 = cB.at(fa), B2 = cB.at(fb);
      const y0 = top - 1.08, y1 = top;
      // parapet face (towards the stage), with a rounded rail on top
      quad([a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z], [a.x, y1, a.z], 3, [s, 0, s2, 0, s2, 1, s, 1]);
      quad([a.x, y1, a.z], [b.x, y1, b.z], [b.x - b.nx * .28, y1 + .02, b.z - b.nz * .28], [a.x - a.nx * .28, y1 + .02, a.z - a.nz * .28], 4, [s, 0, s2, 0, s2, 1, s, 1]);
      // soffit (the underside of the tier, which the stage light washes from below)
      quad([a.x, y0 - .18, a.z], [A2.x, y0 - .18, A2.z], [B2.x, y0 - .18, B2.z], [b.x, y0 - .18, b.z], 6, [s, 0, s, 1, s2, 1, s2, 0]);
      quad([b.x, y0 - .18, b.z], [b.x, y0, b.z], [a.x, y0, a.z], [a.x, y0 - .18, a.z], 3, [s2, -.2, s2, 0, s, 0, s, -.2]);
      // back wall of the tier, up to the next soffit
      quad([B2.x, y0, B2.z], [A2.x, y0, A2.z], [A2.x, nextTop - 1.26, A2.z], [B2.x, nextTop - 1.26, B2.z], 5, [fb, y0, fa, y0, fa, nextTop, fb, nextTop]);
      // tier floor
      quad([a.x, y0 - 0.02, a.z], [b.x, y0 - 0.02, b.z], [B2.x, y0 + 0.9, B2.z], [A2.x, y0 + 0.9, A2.z], 5, [s, 0, s2, 0, s2, 1, s, 1]);
    }
    // box partitions on the sides
    if (ti < 3) for (let s = 0; s < c0.length; s += 2.5) {
      const a = c0.at(s); if (a.z > HOUSE.backCz || a.z < HOUSE.sideZ0 + 0.3) continue; const A2 = cB.at(s / c0.length * cB.length);
      const y0 = top - 1.08, y1 = nextTop - 1.26;
      quad([a.x, y0, a.z], [A2.x, y0, A2.z], [A2.x, y1, A2.z], [a.x, y1, a.z], 12, [0, 0, 1, 0, 1, 1, 0, 1]);
      quad([A2.x, y0, A2.z], [a.x, y0, a.z], [a.x, y1, a.z], [A2.x, y1, A2.z], 12, [1, 0, 0, 0, 0, 1, 1, 1]);
    }
  });
  // stalls walls under the first tier and the proscenium walls
  {
    const cw = horseshoeCurve(0.2); const step = 0.6;
    for (let s = 0; s < cw.length - 1e-3; s += step) {
      const a = cw.at(s), b = cw.at(Math.min(cw.length, s + step));
      quad([b.x, -0.3, b.z], [a.x, -0.3, a.z], [a.x, HOUSE.tiers[0] - 1.26, a.z], [b.x, HOUSE.tiers[0] - 1.26, b.z], 5, [s + step, 0, s, 0, s, 3, s + step, 3]);
    }
    for (const sx of [-1, 1]) {
      const x = sx * (HOUSE.sideX + 0.2);
      quad([x, -0.3, -1.0], [x, -0.3, HOUSE.sideZ0], [x, HOUSE.ceilingY, HOUSE.sideZ0], [x, HOUSE.ceilingY, -1.0], 8);
      // proscenium pillar and arch
      box(sx * 8.1, (STAGE_Y + 15) / 2, -0.9, 0.9, (15 - STAGE_Y) / 2, 0.5, 0, 1, 9, 'f'); box(sx * 8.1, (STAGE_Y + 15) / 2, -0.9, 0.9, (15 - STAGE_Y) / 2, 0.5, 0, 1, 11, 'blr');
      quad([sx * 8.1 + sx * 0.9, STAGE_Y, -0.4], [sx * 12.6, STAGE_Y, -0.4], [sx * 12.6, 17, -0.4], [sx * 8.1 + sx * 0.9, 17, -0.4], 9);
    }
    box(0, 13.9, -0.9, 9, 1.1, 0.5, 0, 1, 9, 'fb');
    // house curtain: gathered drapes and a swagged valance, deep red velvet
    for (const sx of [-1, 1]) quad([sx * 7.2, STAGE_Y, -1.5], [sx * 5.9, STAGE_Y, -1.5], [sx * 6.6, 12.8, -1.5], [sx * 7.2, 12.8, -1.5], 10, [0, 0, 1, 0, 1, 1, 0, 1]);
    quad([-7.3, 11.4, -1.52], [7.3, 11.4, -1.52], [7.3, 12.9, -1.52], [-7.3, 12.9, -1.52], 10, [0, 0, 8, 0, 8, 1, 0, 1]);
    // ceiling
    quad([-13, HOUSE.ceilingY, -1], [-13, HOUSE.ceilingY, 30], [13, HOUSE.ceilingY, 30], [13, HOUSE.ceilingY, -1], 7, [-13, -1, -13, 30, 13, 30, 13, -1]);
    // wings: black masking and the upstage wall
    quad([-11, STAGE_Y, -13], [11, STAGE_Y, -13], [11, 16, -13], [-11, 16, -13], 11);
    for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) { const z = -6.4 - k * 3.0; quad([sx * 11, STAGE_Y, z - 1.4], [sx * 11, STAGE_Y, z + 0.4], [sx * 11, 14, z + 0.4], [sx * 11, 14, z - 1.4], 11); box(sx * 8.8, 7.5, z, 0.9, 6.4, 0.05, 0, 1, 11, 'fb'); }
  }
  const hallV = new Float32Array(V), hallI = new Uint32Array(I);
  const hallBuf = K.buffer(hallV);
  const hallVao = K.vao([
    { buf: hallBuf, loc: 0, size: 3, stride: 36, offset: 0 }, { buf: hallBuf, loc: 1, size: 3, stride: 36, offset: 12 },
    { buf: hallBuf, loc: 2, size: 2, stride: 36, offset: 24 }, { buf: hallBuf, loc: 3, size: 1, stride: 36, offset: 32 }], hallI);
  const hallCount = hallI.length;

  // ─────────────────────────── tip-up seats (instanced: the cushion folds up when nobody's on it) ───────────────────────────
  // one seat in local coordinates: x right, y up, z forward (toward the stage); flag 1 = the cushion, which hinges at its back
  const SV = [], SI = [];
  function sbox(cx, cy, cz, hw, hh, hd, m, faces, flag) {
    const P = (sx, sy, sz) => [cx + hw * sx, cy + hh * sy, cz + hd * sz];
    const q = (a, b, c, d) => { const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
      let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; const l = Math.hypot(...n) || 1; n = n.map(x => x / l);
      const base = SV.length / 10; for (const v of [a, b, c, d]) SV.push(v[0], v[1], v[2], n[0], n[1], n[2], m, flag, v[0], v[1]); SI.push(base, base + 1, base + 2, base, base + 2, base + 3); };
    if (faces.includes('f')) q(P(1, -1, 1), P(-1, -1, 1), P(-1, 1, 1), P(1, 1, 1));
    if (faces.includes('b')) q(P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1));
    if (faces.includes('t')) q(P(-1, 1, 1), P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1));
    if (faces.includes('u')) q(P(-1, -1, -1), P(-1, -1, 1), P(1, -1, 1), P(1, -1, -1));
    if (faces.includes('l')) q(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1));
    if (faces.includes('r')) q(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1));
  }
  sbox(0, 0.64, -0.28, 0.21, 0.27, 0.04, 2, 'ftlr', 0);          // backrest
  sbox(0, 0.925, -0.28, 0.215, 0.018, 0.05, 14, 'ftb', 0);        // wooden top rail
  sbox(0.255, 0.6, -0.05, 0.025, 0.03, 0.2, 14, 'tlrf', 0);       // armrest
  sbox(0, 0.43, -0.02, 0.2, 0.05, 0.2, 2, 'ftul', 1);             // cushion
  const seatList = house.seats, NS = seatList.length;
  const seatStatic = new Float32Array(NS * 4), seatTip = new Float32Array(NS);
  seatList.forEach((st, k) => { seatStatic.set([st.x, st.y, st.z, Math.atan2(st.fx, st.fz)], k * 4); seatTip[k] = st.occupied ? 0 : 1; });
  const svBuf = K.buffer(new Float32Array(SV)), ssBuf = K.buffer(seatStatic), stBuf = K.buffer(seatTip, gl.DYNAMIC_DRAW);
  const seatVao = K.vao([
    { buf: svBuf, loc: 0, size: 3, stride: 40, offset: 0 }, { buf: svBuf, loc: 1, size: 3, stride: 40, offset: 12 },
    { buf: svBuf, loc: 2, size: 2, stride: 40, offset: 24 }, { buf: svBuf, loc: 3, size: 2, stride: 40, offset: 32 },
    { buf: ssBuf, loc: 4, size: 4, stride: 16, offset: 0, divisor: 1 }, { buf: stBuf, loc: 5, size: 1, divisor: 1 }], new Uint16Array(SI));
  const seatIdx = SI.length;
  const SEAT_VS = `#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aMF; layout(location=3) in vec2 aUv;
layout(location=4) in vec4 aSeat; layout(location=5) in float aTip;
uniform mat4 uVP; out vec3 vPos; out vec3 vNrm; out vec2 vUv; flat out int vMat;
void main(){
  vec3 p = aPos, n = aNrm;
  if (aMF.y > .5) { // fold the cushion up about its back edge
    float a = aTip * 1.35; vec3 h = vec3(0., .43, -.2); vec3 q = p - h; float c = cos(a), s = sin(a);
    p = h + vec3(q.x, q.y * c + q.z * s, -q.y * s + q.z * c); n = vec3(n.x, n.y * c + n.z * s, -n.y * s + n.z * c);
  }
  float ca = cos(aSeat.w), sa = sin(aSeat.w);     // local z → the seat's facing (fx, fz) = (sin w, cos w)
  vec3 w = vec3(p.x * ca + p.z * sa, p.y, -p.x * sa + p.z * ca) + aSeat.xyz;
  vPos = w; vNrm = vec3(n.x * ca + n.z * sa, n.y, -n.x * sa + n.z * ca); vUv = aUv * 3.; vMat = int(aMF.x + .5);
  gl_Position = uVP * vec4(w, 1.);
}`;
  const HALL_FS = `#version 300 es
precision highp float;
in vec3 vPos; in vec3 vNrm; in vec2 vUv; flat in int vMat; out vec4 oCol;
${LIGHT_GLSL}
uniform float uWing, uSpotX, uTorch; uniform vec3 uTorchP;
// the performer's shadow, cast down-stage by a low backlight, as a pair of capsules that bend when you bow
float segDist(vec3 p0, vec3 p1, vec3 q0, vec3 q1) {
  vec3 d1 = p1 - p0, d2 = q1 - q0, r = p0 - q0; float a = dot(d1, d1), e = dot(d2, d2), f = dot(d2, r), c = dot(d1, r), b = dot(d1, d2);
  float den = a * e - b * b; float s = den > 1e-6 ? clamp((b * f - c * e) / den, 0., 1.) : 0.; float t = (b * s + f) / e;
  if (t < 0.) { t = 0.; s = clamp(-c / a, 0., 1.); } else if (t > 1.) { t = 1.; s = clamp((b - c) / a, 0., 1.); }
  return length((p0 + d1 * s) - (q0 + d2 * t));
}
float perfShadow(vec3 p) {
  vec3 L = vec3(uPerf.x, uPerf.y + 5.2, uPerf.z - 8.5);
  vec3 f = uPerf; float a = uBow * 1.05; vec3 fw = vec3(0., cos(a), sin(a)), side = vec3(1., 0., 0.);
  vec3 hip = f + vec3(0., .95, 0.), chest = hip + fw * .5, sh = hip + fw * .56, head = hip + fw * .82;
  float d = segDist(p, L, f + vec3(-.1, .05, 0.), hip - side * .08) - .075;
  d = min(d, segDist(p, L, f + vec3(.1, .05, 0.), hip + side * .08) - .075);
  d = min(d, segDist(p, L, hip, chest) - .15);
  d = min(d, segDist(p, L, sh - side * .19, sh + side * .19) - .07);
  d = min(d, segDist(p, L, sh - side * .21, hip - side * .24 + fw * .05 + vec3(0., -.15, .05)) - .045);
  d = min(d, segDist(p, L, sh + side * .21, hip + side * .24 + fw * .05 + vec3(0., -.15, .05)) - .045);
  d = min(d, segDist(p, L, head, head + fw * .01) - .105);
  return smoothstep(-.03, .07, d);
}
vec3 velvet(vec3 base, vec3 n, vec3 v) { float sheen = pow(1. - max(0., dot(n, v)), 3.); return base * (.65 + .35 * max(0., dot(n, v))) + base * 1.6 * sheen; }
void main(){
  vec3 n = normalize(vNrm), v = normalize(uCam - vPos);
  if (dot(n, v) < 0. && vMat != 0) n = -n;
  vec3 alb = vec3(.2); float spec = 0.; float emis = 0.; vec3 ecol = vec3(0.);
  vec3 L = houseLight(vPos, n);
  if (vMat == 0) { // stage boards: planks running up- and down-stage, worn wax, the spot's pool, your shadow from the backlight
    float plank = floor(vUv.x / .14); float g = vnoise(vec2(vUv.x * 30., vUv.y * 1.3 + plank * 7.1));
    alb = mix(vec3(.13, .075, .045), vec3(.23, .14, .08), g) * (.8 + .4 * hash12(vec2(plank, 3.)));
    float seam = smoothstep(.062, .069, abs(fract(vUv.x / .14) - .5) * .14); float butt = smoothstep(.985, 1., fract(vUv.y / 2.4 + hash12(vec2(plank, 9.))));
    alb *= 1. - .6 * max(seam, butt);
    vec2 dp = (vPos.xz - vec2(uSpotX, uPerf.z)) * vec2(1., .8); float pool = exp(-dot(dp, dp) / 1.1) * uSpot;
    vec2 db = (vPos.xz - uPerf.xz - vec2(0., 2.6)) * vec2(.45, .3); float back = exp(-dot(db, db)) * uStage;
    float wash = uStage * .25 * exp(-dot(vPos.xz - vec2(0., -3.), vPos.xz - vec2(0., -3.)) / 60.);
    L = vec3(1., .88, .74) * pool * 1.5 + vec3(.95, .8, .62) * back * 1.1 * perfShadow(vPos) + vec3(1., .8, .6) * wash * .6 + L * .1;
    vec2 tq = (vPos.xz - uTorchP.xy); tq = vec2(dot(tq, vec2(cos(uTorchP.z), sin(uTorchP.z))), dot(tq, vec2(-sin(uTorchP.z), cos(uTorchP.z)))) * vec2(1.4, 3.2);
    L += vec3(.42, .6, 1.) * uTorch * 5.5 * smoothstep(1., .5, dot(tq, tq) * 2.2);
    L += vec3(.3, .42, .95) * (.12 + .25 * uWing) * exp(-sq(abs(vPos.x) - 10.) * .35) * (exp(-sq(vPos.z + 2.4) * .25) + exp(-sq(vPos.z + 6.2) * .25));
    vec3 hv = normalize(normalize(vec3(uSpotX, 8., 29.) - vPos) + v); spec = 0.;
    ecol = vec3(1., .85, .65) * pow(max(0., hv.y), 60.) * (pool * .6 + back * .25);
    } else if (vMat == 1) { alb = vec3(.13, .03, .03) * (.8 + .2 * vnoise(vUv * 3.)); }
  else if (vMat == 2) { alb = velvet(vec3(.25, .022, .032), n, v) * (.85 + .15 * vnoise(vPos.xz * 9.)); }
  else if (vMat == 3 || vMat == 9 || vMat == 12) { // ivory plaster and gilt: framed panels, rosettes, hanging garlands, mouldings
    vec2 uv = vMat == 3 ? vUv : (vMat == 12 ? vUv * vec2(1.2, 2.4) : vec2(vPos.x + vPos.z, vPos.y) * 1.1);
    float pw = 1.25; vec2 q = vec2(fract(uv.x / pw) - .5, uv.y - .5);
    float frame = smoothstep(.012, 0., abs(abs(q.x) - .45)) * step(abs(q.y), .36) + smoothstep(.012, 0., abs(abs(q.y) - .36)) * step(abs(q.x), .45);
    float r = length(q * vec2(1., 1.3)), an = atan(q.y, q.x);
    float petals = 1. - smoothstep(.0, .012, r - .085 * (.72 + .28 * cos(an * 8.)));
    float ring = smoothstep(.012, 0., abs(r - .13));
    float sag = .27 - .16 * (1. - sq(q.x / .4));
    float swag = smoothstep(.02, 0., abs(q.y - sag)) * step(abs(q.x), .4) * step(.16, abs(q.x));
    float tassel = smoothstep(.02, 0., length(vec2(abs(q.x) - .42, q.y - .22)) - .018);
    float mould = (smoothstep(.03, 0., abs(uv.y - .93)) + smoothstep(.03, 0., abs(uv.y - .07))) * (.6 + .4 * step(0., sin(uv.x * 42.)));
    float gold = clamp(frame + petals + ring + swag + tassel + mould, 0., 1.);
    vec3 ivory = vec3(.78, .69, .55), gld = vec3(1., .7, .3);
    alb = mix(ivory, gld * .85, gold);
    spec = gold * 1.5;
    L += vec3(1., .74, .5) * uStage * .09 * max(0., -n.z * .8 + .2);   // the stage's glow, reflected back into the room
  }
  else if (vMat == 4) { alb = velvet(vec3(.4, .04, .05), n, v); }
  else if (vMat == 5) { // box interiors: red damask, lamp-warm
    float dam = vnoise(vUv * vec2(3., 4.)) * .5 + .5 * smoothstep(.4, .6, vnoise(vUv * vec2(6., 8.) + 3.));
    alb = vec3(.3, .05, .045) * (.75 + .35 * dam);
    // a small lamp every box: warm pools on the back wall
    float lamp = exp(-sq((fract(vUv.x / 2.5) - .5) * 2.5) * 3.) * exp(-sq(vUv.y - (floor(vUv.y) + .8)) * 1.5);
    L += vec3(1., .6, .3) * (.18 + .35 * uHouse) * lamp;
  }
  else if (vMat == 6) { // soffits: pale plaster with gilt coffers
    vec2 q = fract(vec2(vUv.x / 1.25, vUv.y * 1.6)) - .5; float cof = smoothstep(.36, .4, max(abs(q.x), abs(q.y)));
    float rose = 1. - smoothstep(.05, .07, length(q));
    alb = mix(vec3(.3, .22, .16), vec3(.8, .56, .26), max(cof, rose)); spec = max(cof, rose) * .9;
  }
  else if (vMat == 7) { // the ceiling: a painted sky in a ring round the chandelier
    vec2 c = vUv - vec2(0., 14.8); float r = length(c); vec2 u = c / max(r, 1e-3);
    float paint = vnoise(u * 3.2 + r * .45) * .6 + vnoise(u * 8. + r * 1.3 + 4.) * .4;
    vec3 col = mix(vec3(.2, .28, .45), vec3(.7, .38, .25), smoothstep(.3, .8, paint));
    col = mix(col, vec3(.55, .45, .2), smoothstep(.55, .9, vnoise(u * 2. + r * .25 + 9.)));
    alb = mix(vec3(.55, .48, .38), col * .8, smoothstep(9.5, 8.5, r) * smoothstep(2.5, 3.5, r));
    alb = mix(alb, vec3(.9, .65, .3), smoothstep(.15, 0., abs(r - 9.8)) + smoothstep(.12, 0., abs(r - 3.2)));
    L += vec3(1., .75, .5) * uStage * .12;
  }
  else if (vMat == 8) { alb = vec3(.26, .05, .045) * (.8 + .3 * vnoise(vPos.zy * 2.)); }
  else if (vMat == 10) { // curtain velvet with deep folds
    float fold = sin(vUv.x * 40.) * .5 + .5; alb = vec3(.42, .03, .05) * (.35 + .9 * fold);
    alb = velvet(alb, normalize(n + vec3(cos(vUv.x * 40.) * .5, 0., 0.)), v);
  }
  else if (vMat == 11) { alb = vec3(.02); L += vec3(.3, .4, .8) * .5 * smoothstep(7.5, 11., abs(vPos.x)) * exp(-sq(vPos.y - 2.5) * .05) * step(vPos.z, -1.); }
  else if (vMat == 14) { alb = vec3(.09, .05, .03); spec = .25; }
  else if (vMat == 13) { // the pit rail, lit from below by a row of music-stand lamps
    alb = vec3(.07, .035, .025) * (.7 + .3 * vnoise(vUv * vec2(4., 30.))); spec = .1;
    float stand = exp(-sq((fract(vUv.x / 1.15 + .3) - .5) * 3.2)) * (.6 + .4 * hash12(vec2(floor(vUv.x / 1.15 + .3), 5.)));
    L += vec3(1., .72, .42) * uStage * (stand * 1.4 + .25) * smoothstep(1.02, .62, vUv.y);
  }
  vec3 col = alb * L + ecol;
  // gilt glints: a sharp highlight toward the stage light, sparkling as the ornament's facets turn
  if (spec > 0.) {
    vec3 Ls = normalize(vec3(uPerf.x * .4, 7.5, -3.5) - vPos); vec3 h = normalize(Ls + v);
    float facet = hash12(floor(vPos.xz * 9.) + floor(vPos.y * 9.) * 7.);
    float s = pow(max(0., dot(n, h)), 30.) * (.4 + 1.6 * facet) + pow(max(0., dot(reflect(-v, n), normalize(uChandPos - vPos))), 20.) * uChand * 2.;
    col += vec3(1., .78, .45) * spec * s * (uStage * .9 + uHouse * .7 + .05);
  }
  oCol = vec4(col, 1.);
}`;
  const hallProg = K.program(`#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNrm; layout(location=2) in vec2 aUv; layout(location=3) in float aMat;
uniform mat4 uVP; out vec3 vPos; out vec3 vNrm; out vec2 vUv; flat out int vMat;
void main(){ vPos = aPos; vNrm = aNrm; vUv = aUv; vMat = int(aMat + .5); gl_Position = uVP * vec4(aPos, 1.); }`, HALL_FS);
  const seatProg = K.program(SEAT_VS, HALL_FS);

  // ─────────────────────────── the audience ───────────────────────────
  const P = house.people, N = house.N;
  const NI = N + 1;                       // + the conductor, on the podium in the pit, facing you
  const statics = new Float32Array(NI * 8);
  const srng = makeRng(4242);
  for (let i = 0; i < N; i++) {
    const p = P[i];
    // skin, hair colour, hair style, clothes, build, glasses — a house full of different people
    statics.set([p.x, p.y, p.z, srng(), srng(), srng(), srng(), srng()], i * 8);
  }
  statics.set([-1.35, -1.12, 2.55, -1.03, 0.22, 0.8, 0.2, 0.55], N * 8);
  const dyn = new Float32Array(NI * 8);
  const qBuf = K.buffer(new Float32Array([-1, 0, 1, 0, -1, 1, 1, 1]));
  const sBuf = K.buffer(statics), dBuf = K.buffer(dyn, gl.DYNAMIC_DRAW);
  const crowdVao = K.vao([
    { buf: qBuf, loc: 0, size: 2 },
    { buf: sBuf, loc: 1, size: 4, stride: 32, offset: 0, divisor: 1 }, { buf: sBuf, loc: 2, size: 4, stride: 32, offset: 16, divisor: 1 },
    { buf: dBuf, loc: 3, size: 4, stride: 32, offset: 0, divisor: 1 }, { buf: dBuf, loc: 4, size: 4, stride: 32, offset: 16, divisor: 1 }]);

  const crowdProg = K.program(`#version 300 es
layout(location=0) in vec2 aQ; layout(location=1) in vec4 aP; layout(location=2) in vec4 aR; layout(location=3) in vec4 aD; layout(location=4) in vec4 aE;
uniform mat4 uVP; uniform vec3 uRight; uniform float uNight;
${LIGHT_GLSL}
out vec2 vL; out vec4 vR; out vec4 vD; out vec4 vE; out vec3 vLight; out float vRim; out float vSeed; out float vPx; out float vCond;
void main(){
  // aD: handSep, flash, stand, arms   aE: gaze, leave, slide, clap
  float standH = aD.z, leave = aE.y;
  vec3 base = vec3(aP.x, aP.y + .43 + standH * .5, aP.z);
  base += vec3(aE.z, 0., aE.w);                       // on the way out
  float W = .38, H0 = -.42 - .55 * standH, H1 = 1.42;
  vL = vec2(aQ.x * W, mix(H0, H1, aQ.y));
  vec3 wp = base + uRight * vL.x + vec3(0., vL.y, 0.);
  gl_Position = uVP * vec4(wp, 1.);
  vCond = step(aP.w, -.5);
  vR = vCond > .5 ? aR : fract(aR + uNight * vec4(.6180, .7548, .5698, .4302)); vD = aD; vE = aE; vSeed = vCond > .5 ? -aP.w - 1. : fract(aP.w + uNight * .3183);
  vec3 facing = normalize(vec3(uPerf.x - aP.x, 0., uPerf.z - aP.z));
  vec3 lp = vec3(aP.x, aP.y + 1.1 + standH * .45, aP.z);
  vLight = houseLight(lp, normalize(facing + vec3(0., .25, 0.)));
  vRim = 0.;
  vec4 c = uVP * vec4(base + vec3(0., .8, 0.), 1.); vPx = 1. / max(.001, c.w);
}`,
  `#version 300 es
precision highp float;
in vec2 vL; in vec4 vR; in vec4 vD; in vec4 vE; in vec3 vLight; in float vRim; in float vSeed; in float vPx; in float vCond; out vec4 oCol;
uniform float uTime, uHouseL;
float sdE(vec2 p, vec2 r){ float k0 = length(p / r); float k1 = length(p / (r * r)); return k0 * (k0 - 1.) / max(k1, 1e-5); }
float sdCap(vec2 p, vec2 a, vec2 b, float r){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.); return length(pa - ba * h) - r; }
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
vec3 hsl(float h, float s, float l){ vec3 rgb = clamp(abs(mod(h * 6. + vec3(0, 4, 2), 6.) - 3.) - 1., 0., 1.); return l + s * (rgb - .5) * (1. - abs(2. * l - 1.)); }
void main(){
  vec2 p = vL;
  float build = vR.w, sw = .19 + .05 * build;             // shoulder half-width
  float leave = vE.y, back = step(.001, leave);            // leaving: we see their backs
  float gaze = (fract(vE.x) - .5) / .49 * (1. - back), shoutO = floor(vE.x) / 7.;
  // head and neck
  vec2 hc = vec2(gaze * .025, .83);
  float head = sdE(p - hc, vec2(.082, .104));
  float neck = sdCap(p, vec2(0., .62), vec2(0., .74), .045);
  // torso: shoulders rounding into a trunk, clothes
  float torso = sdCap(p, vec2(-sw + .08, .6), vec2(sw - .08, .6), .085);
  vec2 tp = p - vec2(0., .1); float taper = sw - .02 - (.5 - clamp(tp.y, -.7, .5)) * .06;
  float standing = vD.z, bottom = mix(-.72, -.14, smoothstep(.2, .8, standing));
  torso = smin(torso, max(abs(tp.x) - taper, max(tp.y - .5, bottom - tp.y)), .1);
  float legs = 1e3;
  if (standing > .2) { float lw = .07; legs = min(sdCap(p, vec2(-.08, -.05), vec2(-.09, -.9), lw), sdCap(p, vec2(.08, -.05), vec2(.09, -.9), lw)); }
  float body = min(smin(torso, neck, .03), legs);
  // arms: at rest along the sides; clapping, forearms up and hands meeting in front of the chest; cheering, above the head
  float clapping = step(1.5, vD.w), sep = vD.x, arms = vD.w - 2. * clapping;
  float far = smoothstep(.018, .034, 1.2 / (vPx * 700.)); arms *= 1. - far;
  float handY = mix(.57, 1.14, arms) + .02 * sin(vSeed * 50.);
  vec2 hl = vec2(-.02 - sep * .045, handY), hr = vec2(.02 + sep * .045, handY);
  vec2 el = vec2(-sw + .005, mix(.3, .84, arms)), er = vec2(sw - .005, mix(.3, .84, arms));
  float armL, armR, hands;
  if (clapping < .5 && arms > .05) { // both arms up, hands open
    vec2 al = vec2(-sw - .1 * arms, mix(.4, 1.2, arms)), ar = vec2(sw + .1 * arms, mix(.4, 1.2, arms));
    armL = sdCap(p, vec2(-sw + .05, .56), al, .045); armR = sdCap(p, vec2(sw - .05, .56), ar, .045);
    hands = min(sdE(p - al - vec2(0., .05), vec2(.03, .05)), sdE(p - ar - vec2(0., .05), vec2(.03, .05)));
  } else if (clapping > .5) {
    armL = min(sdCap(p, vec2(-sw + .05, .56), el, .052), sdCap(p, el, hl + vec2(0., -.03), .04));
    armR = min(sdCap(p, vec2(sw - .05, .56), er, .052), sdCap(p, er, hr + vec2(0., -.03), .04));
    vec2 ql = p - hl - vec2(0., .02), qr = p - hr - vec2(0., .02); ql = mat2(.94, -.34, .34, .94) * ql; qr = mat2(.94, .34, -.34, .94) * qr;
    hands = min(sdE(ql, vec2(.024, .05)), sdE(qr, vec2(.024, .05)));
  } else {
    armL = sdCap(p, vec2(-sw + .04, .56), vec2(-sw - .02, .1), .052); armR = sdCap(p, vec2(sw - .04, .56), vec2(sw + .02, .1), .052);
    hands = 1e3;
  }
  float phoneA = vD.y >= 2. ? vD.y - 2. : 0.; float flashV = vD.y >= 2. ? 0. : vD.y;
  float phoneS = 1e3;
  if (phoneA > .02) { vec2 pc = vec2(.02 + .05 * sin(vSeed * 9.), mix(.5, 1.2, phoneA)); phoneS = max(abs(p.x - pc.x) - .038, abs(p.y - pc.y) - .066) - .006;
    armR = min(armR, sdCap(p, vec2(sw - .05, .56), pc + vec2(0., -.04), .04)); }
  float baton = vCond > .5 ? sdCap(p, hr + vec2(.01, .03), hr + vec2(.13, .2), .006) : 1e3;
  float d = min(min(min(body, head), min(min(armL, armR), min(hands, phoneS))), baton);
  // hair: styles from cropped to long, a few buns, a few bald heads
  float style = vR.z, hcol = vR.y;
  float hair = 1e3;
  if (style < .35) hair = sdE(p - hc - vec2(0., .035), vec2(.088, .085));
  else if (style < .6) hair = smin(sdE(p - hc - vec2(0., .03), vec2(.094, .095)), sdCap(p, hc + vec2(-.07, 0.), hc + vec2(-.08, -.16), .04), .03), hair = smin(hair, sdCap(p, hc + vec2(.07, 0.), hc + vec2(.08, -.16), .04), .03);
  else if (style < .72) hair = min(sdE(p - hc - vec2(0., .03), vec2(.09, .088)), length(p - hc - vec2(0., .13)) - .05);
  else if (style < .95) hair = sdE(p - hc - vec2(0., .045), vec2(.086, .075));
  float faceMask = sdE(p - hc - vec2(gaze * .01, -.022), vec2(.064, .08));
  if (back < .5) hair = max(hair, -faceMask);
  d = min(d, hair);
  float px = 1.2 / (vPx * 700.) + .002;                      // ~ one pixel in local metres
  float a = 1. - smoothstep(-px, px, d);
  if (a < .02) discard;
  // colours
  vec3 skin = mix(vec3(.96, .76, .62), vec3(.36, .22, .14), pow(vR.x, 1.3));
  vec3 hairC = hcol < .35 ? vec3(.05, .035, .03) : hcol < .6 ? vec3(.22, .13, .07) : hcol < .75 ? vec3(.55, .42, .25) : hcol < .9 ? vec3(.6, .58, .56) : vec3(.45, .16, .06);
  float cl = fract(vSeed * 7.13);
  vec3 cloth = cl < .55 ? vec3(.035, .035, .045) : cl < .7 ? vec3(.06, .07, .13) : cl < .8 ? vec3(.12, .1, .09) : hsl(fract(vSeed * 3.7), .55, .28);
  float shirt = (cl < .55 && fract(vSeed * 13.) < .45) ? 1. - smoothstep(.0, .01, abs(p.x) - (.62 - p.y) * .22) : 0.;
  shirt *= step(.44, p.y) * step(p.y, .62) * (1. - back);
  vec3 col = cloth;
  col = mix(col, vec3(.62, .6, .56), shirt);
  float isArm = step(min(armL, armR), 0.) * step(0., hands) * clapping;
  col = mix(col, col * 1.45 + .012, isArm);
  float cuff = clapping * step(.55, fract(vSeed * 13.)) * step(cl, .55) * (1. - step(0., min(sdCap(p, hl + vec2(0., -.045), hl + vec2(0., -.02), .03), sdCap(p, hr + vec2(0., -.045), hr + vec2(0., -.02), .03)))) * step(0., hands);
  col = mix(col, vec3(.7, .68, .64), cuff);
  float isSkin = 1. - step(0., min(min(head, neck), hands) - px * .5);
  if (clapping < .5 && arms < .05) isSkin = 1. - step(0., min(head, neck) - px * .5);
  col = mix(col, skin, isSkin);
  float isHair = 1. - step(0., hair);
  col = mix(col, hairC, isHair * (back > .5 ? 1. : 1.));
  if (back > .5) col = mix(col, hairC, 1. - step(0., head));
  // form: a sphere-ish face, cylinder-ish body
  float shade = .62 + .38 * smoothstep(.0, .1, -d) ;
  if (head < 0. && back < .5) { vec2 q = (p - hc) / vec2(.082, .104); float nz = sqrt(max(0., 1. - dot(q, q))); shade = .45 + .55 * nz;
    // a hint of a face: brow shadow, eyes, glasses catching the light
    vec2 e = vec2(abs(q.x - gaze * .35) - .36, q.y - .08);
    float eyes = 1. - smoothstep(.0, .06, length(e * vec2(1., 1.7)) - .12);
    float brow = smoothstep(.05, 0., abs(q.y - .27 - .05 * abs(q.x))) * step(abs(q.x - gaze * .3), .62);
    float mouth = smoothstep(.05, 0., abs(q.y + .48)) * step(abs(q.x - gaze * .3), .25);
    float open = 1. - smoothstep(0., .08, length((q - vec2(gaze * .3, -.47)) / vec2(.2, .07 + .2 * shoutO)) - 1.); mouth = max(mouth * (1. - shoutO), open * step(.05, shoutO));
    float nose = smoothstep(.1, 0., abs(q.x - gaze * .45)) * step(-.3, q.y) * step(q.y, .05);
    col *= (1. - .45 * eyes - .25 * brow - .3 * mouth) * (1. + .12 * nose);
    if (fract(vSeed * 31.) < .1) col = mix(col, vec3(1., .95, .85), smoothstep(.03, 0., abs(length(e * vec2(1., 1.5)) - .16)) * .25);
  }
  if (baton < 0.) col = vec3(.9, .88, .82);
  vec3 lit = col * vLight * shade;
  // the clap: palms meet and catch the light
  lit += skin * vLight * flashV * .5 * clapping * (1. - step(0., hands));
  if (phoneS < 0.) lit = mix(vec3(.02), vec3(.75, .85, 1.) * 1.6, smoothstep(0., -.008, phoneS + .004));
  oCol = vec4(lit, a * (1. - smoothstep(.9, 1., leave)));
}`);

  // the palms meeting: a tiny warm glint per clapper, never smaller than a pixel, so a house clapping in unison
  // visibly pulses even at the back of the gods and even with the sound off
  const glintProg = K.program(`#version 300 es
layout(location=0) in vec2 aQ; layout(location=1) in vec4 aP; layout(location=2) in vec4 aR; layout(location=3) in vec4 aD; layout(location=4) in vec4 aE;
uniform mat4 uVP; uniform vec3 uRight, uUp; uniform vec2 uRes;
${LIGHT_GLSL}
out vec2 vQ; out float vI; out vec3 vC;
void main(){
  float clapping = step(1.5, aD.w), arms = aD.w - 2. * clapping, flash = aD.y >= 2. ? 0. : aD.y;
  float standH = aD.z;
  vec3 base = vec3(aP.x, aP.y + .43 + standH * .5, aP.z) + vec3(aE.z, 0., aE.w);
  vec3 hand = base + vec3(0., mix(.6, 1.18, arms), 0.);
  vec4 c = uVP * vec4(hand, 1.);
  float px = max(1.6, .045 * uRes.y / max(c.w, .1));          // at least ~1.5 px wide
  vec2 off = aQ * vec2(1., 2.) - vec2(0., 1.);
  c.xy += off * px / uRes * 2. * c.w;
  gl_Position = clapping > .5 && flash > .06 && arms < .3 && aE.y < .01 ? c : vec4(2., 2., 2., 1.);
  vQ = off; vI = flash * clapping;
  vec3 lp = vec3(aP.x, aP.y + 1.1, aP.z);
  vC = houseLight(lp, normalize(vec3(uPerf.x - aP.x, 2., uPerf.z - aP.z))) * vec3(1., .86, .66);
}`, `#version 300 es
precision highp float; in vec2 vQ; in float vI; in vec3 vC; out vec4 o;
void main(){ float r = length(vQ); if (r > 1.) discard; o = vec4((vC + .06) * vI * (1. - r * r) * 4., 0.); }`);

  // ─────────────────────────── small lights and flowers (sprites) ───────────────────────────
  // lamps: footlights, box lamps, aisle lights, pit stands, the chandelier's crystals, the booth's lens, exit signs
  const lamps = [];
  for (let x = -6.6; x <= 6.61; x += 0.55) lamps.push([x, STAGE_Y + 0.06, 0.18, 0.05, 1.0, 0.62, 0.32, 0]);
  HOUSE.tiers.forEach((top, ti) => { const c = horseshoeCurve(3.0); for (let s = 1.25; s < c.length; s += 2.5) { const a = c.at(s); if (a.z < HOUSE.sideZ0 + 0.3) continue; lamps.push([a.x, top - 1.08 + 1.55, a.z, 0.09, 1.0, 0.62, 0.3, 1]); } });
  for (let r = 0; r < 21; r += 2) for (const sx of [-1, 1]) lamps.push([sx * 4.0, r * 0.105 + 0.05, 3.4 + r * 0.96, 0.035, 1.0, 0.55, 0.25, 2]);
  const prng = makeRng(77); for (let k = 0; k < 34; k++) lamps.push([prng.range(-9, 9), -0.9, prng.range(0.7, 2.6), 0.05, 1.0, 0.8, 0.55, 3]);
  const cc = HOUSE.chandelier; for (let k = 0; k < 420; k++) { const t = prng(), ring = Math.floor(t * 5), rr = 0.6 + ring * 0.42, a = prng() * TAU, y = cc[1] + 1.3 - ring * 0.5 - prng() * 0.3; lamps.push([cc[0] + Math.cos(a) * rr, y, cc[2] + Math.sin(a) * rr, 0.035 + 0.03 * prng(), 1.0, 0.85, 0.6, 4]); }
  lamps.push([HOUSE.booth[0], HOUSE.booth[1], HOUSE.booth[2], 0.22, 1.0, 0.95, 0.85, 5]);
  for (const sx of [-1, 1]) lamps.push([sx * 11.8, 2.7, 24, 0.12, 0.2, 1.0, 0.45, 6]);
  const lampData = new Float32Array(lamps.flat());
  const lBuf = K.buffer(lampData);
  const lampVao = K.vao([{ buf: qBuf, loc: 0, size: 2 }, { buf: lBuf, loc: 1, size: 4, stride: 32, offset: 0, divisor: 1 }, { buf: lBuf, loc: 2, size: 4, stride: 32, offset: 16, divisor: 1 }]);
  const lampProg = K.program(`#version 300 es
layout(location=0) in vec2 aQ; layout(location=1) in vec4 aP; layout(location=2) in vec4 aC;
uniform mat4 uVP; uniform vec3 uRight, uUp; uniform float uStage, uHouse, uChand, uSpot, uTime; uniform float uBoothPx;
out vec2 vQ; out vec3 vCol;
void main(){
  int kind = int(aC.w + .5); float s = aP.w; float I = 1.;
  if (kind == 0) I = uStage * 2.5;                  // footlights
  else if (kind == 7) I = uStage * 2.;             // dust
  else if (kind == 1) I = .45 + 1.6 * uHouse;       // box lamps
  else if (kind == 2) I = .6 * (1. - uHouse * .5);  // aisle lights
  else if (kind == 3) I = .9 * uStage;              // pit stand lights
  else if (kind == 4) { I = (.06 + 3.5 * uChand) * (.6 + .4 * sin(uTime * (1. + fract(aP.x * 13.) * 3.) + aP.z * 40.)); }
  else if (kind == 5) { I = 7. * uSpot; s = s * (1. + uBoothPx * .25); }
  else if (kind == 6) I = .9;                       // exit signs
  vec3 up = kind == 5 ? uUp : vec3(0., 1., 0.);
  vec3 wp = aP.xyz + (uRight * aQ.x + up * (aQ.y * 2. - 1.)) * s;
  gl_Position = uVP * vec4(wp, 1.); vQ = vec2(aQ.x, aQ.y * 2. - 1.); vCol = aC.rgb * I;
}`, `#version 300 es
precision highp float; in vec2 vQ; in vec3 vCol; out vec4 o;
void main(){ float r = length(vQ); float a = exp(-r * r * 5.) + .25 * exp(-r * 2.5); if (r > 1.) discard; o = vec4(vCol * a, 0.); }`);

  const torchData = new Float32Array(8), torchBuf = K.buffer(torchData, gl.DYNAMIC_DRAW);
  const torchVao = K.vao([{ buf: qBuf, loc: 0, size: 2 }, { buf: torchBuf, loc: 1, size: 4, stride: 32, offset: 0, divisor: 1 }, { buf: torchBuf, loc: 2, size: 4, stride: 32, offset: 16, divisor: 1 }]);
  // flowers: a rose in cellophane, as a little sprite with a stem
  const FLW = 64, fd = new Float32Array(FLW * 8), flowerBuf = K.buffer(fd, gl.DYNAMIC_DRAW);
  const flowerVao = K.vao([{ buf: qBuf, loc: 0, size: 2 }, { buf: flowerBuf, loc: 1, size: 4, stride: 32, offset: 0, divisor: 1 }, { buf: flowerBuf, loc: 2, size: 4, stride: 32, offset: 16, divisor: 1 }]);
  const flowerProg = K.program(`#version 300 es
layout(location=0) in vec2 aQ; layout(location=1) in vec4 aP; layout(location=2) in vec4 aC;
uniform mat4 uVP; uniform vec3 uRight, uUp;
${LIGHT_GLSL}
out vec2 vQ; out float vHue; out vec3 vL; out float vFlat;
void main(){ float rot = aP.w; mat2 m = mat2(cos(rot), sin(rot), -sin(rot), cos(rot)); vec2 q = vec2(aQ.x, aQ.y * 2. - 1.); vec2 r = m * q * .2;
  float fl = aC.y; vec3 wp = aP.xyz + mix(uRight * r.x + uUp * r.y, vec3(r.x, .01, r.y), fl);
  gl_Position = uVP * vec4(wp, 1.); vQ = q; vHue = aC.x; vFlat = fl;
  vec2 dp = aP.xz - uPerf.xz; vL = houseLight(aP.xyz, vec3(0., 1., 0.)) * .6 + vec3(1., .86, .7) * uSpot * 2.5 * exp(-dot(dp, dp) / 2.6) + vec3(1., .8, .6) * uStage * .6; }`,
  `#version 300 es
precision highp float; in vec2 vQ; in float vHue; in vec3 vL; in float vFlat; out vec4 o;
void main(){ vec2 q = vQ;
  vec2 hq = (q - vec2(0., .5)) * vec2(1., 1.1); float hr = length(hq), ha = atan(hq.y, hq.x);
  float head = hr - .33 * (.92 + .08 * cos(ha * 5. + 1.));
  float sepal = max(abs(q.x) - .16 + (q.y - .2) * .5, abs(q.y - .2) - .06);
  float stem = max(abs(q.x + q.y * .04) - .045, abs(q.y + .35) - .55);
  float leaf1 = length((q - vec2(.15, -.18)) * vec2(1.2, 2.6)) - .11, leaf2 = length((q - vec2(-.14, -.46)) * vec2(1.2, 2.6)) - .1;
  float d = min(min(head, sepal), min(stem, min(leaf1, leaf2))); if (d > 0.) discard;
  vec3 c;
  if (head < 0.) {
    float petals = .5 + .5 * sin(hr * 30. - ha * 2.2), rim = smoothstep(-.05, 0., head);
    vec3 deep = vHue < .9 ? vec3(.22, .005, .02) : vec3(.34, .3, .24), lit = vHue < .9 ? vec3(.62, .03, .07) : vec3(.55, .52, .44);
    c = mix(deep, lit, petals * smoothstep(.34, .0, hr) * .9 + .1) * (1. - .5 * rim);
  } else if (sepal < 0.) c = vec3(.03, .07, .03);
  else c = vec3(.022, .05, .022) * ((leaf1 < 0. || leaf2 < 0.) ? 1.35 : 1.);
  o = vec4(c * vL, 1.); }`);

  // ─────────────────────────── the follow-spot's beam in the haze ───────────────────────────
  const beamProg = K.program(K.FS_VERT, `#version 300 es
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D uDepth; uniform mat4 uInvVP; uniform vec3 uCam, uBooth, uTarget; uniform float uSpot, uTime, uNear, uFar, uHaze;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float vn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  float n = i.x + i.y * 57. + i.z * 113.; vec4 a = fract(sin(vec4(n, n + 1., n + 57., n + 58.)) * 43758.5453), b = fract(sin(vec4(n + 113., n + 114., n + 170., n + 171.)) * 43758.5453);
  vec4 m = mix(a, b, f.z); vec2 m2 = mix(m.xy, m.zw, f.y); return mix(m2.x, m2.y, f.x); }
void main(){
  if (uSpot < .01) { o = vec4(0.); return; }
  vec4 ndc = vec4(vUv * 2. - 1., texture(uDepth, vUv).r * 2. - 1., 1.);
  vec4 wp = uInvVP * ndc; wp /= wp.w; vec3 ro = uCam, rd = wp.xyz - ro; float tmax = length(rd); rd /= tmax; tmax = min(tmax, 60.);
  vec3 axis = normalize(uTarget - uBooth); float lenAB = length(uTarget - uBooth); float tanA = 1.25 / lenAB;
  const int STEPS = 28; float dt = tmax / float(STEPS); float j = hash(vUv * 731. + uTime); float acc = 0.;
  for (int i = 0; i < STEPS; i++) {
    float t = (float(i) + j) * dt; vec3 p = ro + rd * t; vec3 q = p - uBooth; float along = dot(q, axis);
    if (along < .2) continue;
    float r = length(q - axis * along), R = along * tanA;
    float inside = smoothstep(R, R * .82, r);
    float haze = .6 + .8 * vn(p * .7 + vec3(0., uTime * .05, uTime * .03));
    acc += inside * haze / (1. + along * .02) * dt;
  }
  float g = .72, cosT = dot(-rd, -axis); float hg = (1. - g * g) / pow(1. + g * g - 2. * g * cosT, 1.5);
  o = vec4(vec3(1., .9, .76) * min(acc, 20.) * uSpot * uHaze * (.0015 + .0009 * min(hg, 12.)), 0.);
}`);
  // dust motes turning in the beam right in front of you
  const DUST = 600, dd = new Float32Array(DUST * 8), dustBuf = K.buffer(dd, gl.DYNAMIC_DRAW), dustSeed = makeRng(9);
  const dust = []; for (let k = 0; k < DUST; k++) dust.push({ o: [dustSeed.range(-1.6, 1.6), dustSeed.range(0, 3.2), dustSeed.range(0.3, 9)], ph: dustSeed() * TAU, sp: 0.1 + dustSeed() * 0.3 });
  const dustVao = K.vao([{ buf: qBuf, loc: 0, size: 2 }, { buf: dustBuf, loc: 1, size: 4, stride: 32, offset: 0, divisor: 1 }, { buf: dustBuf, loc: 2, size: 4, stride: 32, offset: 16, divisor: 1 }]);

  // ─────────────────────────── post: bloom, tone, grain ───────────────────────────
  const downProg = K.program(K.FS_VERT, `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel; uniform float uFirst, uLdr;
void main(){ vec2 t = uTexel; vec3 c = texture(uTex, vUv).rgb * .5 + (texture(uTex, vUv + vec2(-t.x, -t.y)).rgb + texture(uTex, vUv + vec2(t.x, -t.y)).rgb + texture(uTex, vUv + vec2(-t.x, t.y)).rgb + texture(uTex, vUv + vec2(t.x, t.y)).rgb) * .125;
  if (uFirst > .5) { float l = dot(c, vec3(.3, .5, .2)); c *= uLdr > .5 ? smoothstep(.55, 1., l) : smoothstep(.6, 2.5, l); }
  o = vec4(c, 1.); }`);
  const upProg = K.program(K.FS_VERT, `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel;
void main(){ vec2 t = uTexel; vec3 c = (texture(uTex, vUv + vec2(-t.x, 0)).rgb + texture(uTex, vUv + vec2(t.x, 0)).rgb + texture(uTex, vUv + vec2(0, -t.y)).rgb + texture(uTex, vUv + vec2(0, t.y)).rgb) * .25; o = vec4(c, 1.); }`);
  const finalProg = K.program(K.FS_VERT, `#version 300 es
precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uTex, uBloom; uniform float uExposure, uFade, uTime, uGrain; uniform vec2 uRes;
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + .03)) / (x * (2.43 * x + .59) + .14), 0., 1.); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec3 c = texture(uTex, vUv).rgb + texture(uBloom, vUv).rgb * .55;
  c *= uExposure;
  vec2 q = vUv - .5; q.x *= uRes.x / uRes.y; float vig = 1. - .38 * dot(q, q) * 1.4;
  c *= vig;
  c = aces(c);
  c = pow(c, vec3(1. / 2.2));
  c = mix(c, c * vec3(1.03, .99, .93), .6);
  c += (hash(vUv * uRes + fract(uTime * 17.) * 100.) - .5) * uGrain;
  o = vec4(c * (1. - uFade), 1.);
}`);

  let scene = null, msaa = null, blooms = [];
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const small = Math.min(innerWidth, innerHeight) < 700;
    R.dpr = small ? Math.min(dpr, 2) : Math.min(dpr, 1.5);
    const w = Math.max(2, Math.floor(innerWidth * R.dpr)), h = Math.max(2, Math.floor(innerHeight * R.dpr));
    if (w === R.w && h === R.h) return;
    R.w = canvas.width = w; R.h = canvas.height = h;
    if (scene) scene.free(); if (msaa) msaa.free(); msaa = null; blooms.forEach(b => b.free()); blooms = [];
    scene = K.target(w, h, true);
    const samples = Math.min(4, K.maxSamples);
    if (samples > 1 && !/nomsaa/.test(location.search)) { const hdr = K.floatRT; msaa = K.msaaTarget(w, h, samples, hdr); if (!msaa.ok) { msaa.free(); msaa = null; } }
    let bw = w >> 1, bh = h >> 1; for (let k = 0; k < 6 && bw > 4 && bh > 4; k++) { blooms.push(K.target(bw, bh, false)); bw >>= 1; bh >>= 1; }
  }

  // ─────────────────────────── per-frame ───────────────────────────
  const view = { eye: [0, 0, 0], yaw: 0, pitch: 0, fovy: 1, vp: null, inv: null, right: [1, 0, 0], up: [0, 1, 0] };
  function setUniformsLight(prog, L) {
    const u = prog.u;
    gl.uniform1f(u.uStage, L.stage); gl.uniform1f(u.uSpot, L.spot); gl.uniform1f(u.uHouse, L.house); gl.uniform1f(u.uChand, L.chand);
    gl.uniform1f(u.uTime, L.time); gl.uniform1f(u.uBow, L.bow);
    gl.uniform3fv(u.uCam, view.eye); gl.uniform3f(u.uPerf, L.perfX, STAGE_Y, PERF_Z); gl.uniform3fv(u.uBooth, HOUSE.booth); gl.uniform3fv(u.uChandPos, HOUSE.chandelier);
  }
  function invert(m) { // general 4×4 inverse
    const inv = new Float32Array(16), a = m;
    inv[0] = a[5] * a[10] * a[15] - a[5] * a[11] * a[14] - a[9] * a[6] * a[15] + a[9] * a[7] * a[14] + a[13] * a[6] * a[11] - a[13] * a[7] * a[10];
    inv[4] = -a[4] * a[10] * a[15] + a[4] * a[11] * a[14] + a[8] * a[6] * a[15] - a[8] * a[7] * a[14] - a[12] * a[6] * a[11] + a[12] * a[7] * a[10];
    inv[8] = a[4] * a[9] * a[15] - a[4] * a[11] * a[13] - a[8] * a[5] * a[15] + a[8] * a[7] * a[13] + a[12] * a[5] * a[11] - a[12] * a[7] * a[9];
    inv[12] = -a[4] * a[9] * a[14] + a[4] * a[10] * a[13] + a[8] * a[5] * a[14] - a[8] * a[6] * a[13] - a[12] * a[5] * a[10] + a[12] * a[6] * a[9];
    inv[1] = -a[1] * a[10] * a[15] + a[1] * a[11] * a[14] + a[9] * a[2] * a[15] - a[9] * a[3] * a[14] - a[13] * a[2] * a[11] + a[13] * a[3] * a[10];
    inv[5] = a[0] * a[10] * a[15] - a[0] * a[11] * a[14] - a[8] * a[2] * a[15] + a[8] * a[3] * a[14] + a[12] * a[2] * a[11] - a[12] * a[3] * a[10];
    inv[9] = -a[0] * a[9] * a[15] + a[0] * a[11] * a[13] + a[8] * a[1] * a[15] - a[8] * a[3] * a[13] - a[12] * a[1] * a[11] + a[12] * a[3] * a[9];
    inv[13] = a[0] * a[9] * a[14] - a[0] * a[10] * a[13] - a[8] * a[1] * a[14] + a[8] * a[2] * a[13] + a[12] * a[1] * a[10] - a[12] * a[2] * a[9];
    inv[2] = a[1] * a[6] * a[15] - a[1] * a[7] * a[14] - a[5] * a[2] * a[15] + a[5] * a[3] * a[14] + a[13] * a[2] * a[7] - a[13] * a[3] * a[6];
    inv[6] = -a[0] * a[6] * a[15] + a[0] * a[7] * a[14] + a[4] * a[2] * a[15] - a[4] * a[3] * a[14] - a[12] * a[2] * a[7] + a[12] * a[3] * a[6];
    inv[10] = a[0] * a[5] * a[15] - a[0] * a[7] * a[13] - a[4] * a[1] * a[15] + a[4] * a[3] * a[13] + a[12] * a[1] * a[7] - a[12] * a[3] * a[5];
    inv[14] = -a[0] * a[5] * a[14] + a[0] * a[6] * a[13] + a[4] * a[1] * a[14] - a[4] * a[2] * a[13] - a[12] * a[1] * a[6] + a[12] * a[2] * a[5];
    inv[3] = -a[1] * a[6] * a[11] + a[1] * a[7] * a[10] + a[5] * a[2] * a[11] - a[5] * a[3] * a[10] - a[9] * a[2] * a[7] + a[9] * a[3] * a[6];
    inv[7] = a[0] * a[6] * a[11] - a[0] * a[7] * a[10] - a[4] * a[2] * a[11] + a[4] * a[3] * a[10] + a[8] * a[2] * a[7] - a[8] * a[3] * a[6];
    inv[11] = -a[0] * a[5] * a[11] + a[0] * a[7] * a[9] + a[4] * a[1] * a[11] - a[4] * a[3] * a[9] - a[8] * a[1] * a[7] + a[8] * a[3] * a[5];
    inv[15] = a[0] * a[5] * a[10] - a[0] * a[6] * a[9] - a[4] * a[1] * a[10] + a[4] * a[2] * a[9] + a[8] * a[1] * a[6] - a[8] * a[2] * a[5];
    let det = a[0] * inv[0] + a[1] * inv[4] + a[2] * inv[8] + a[3] * inv[12]; det = 1 / det; for (let i = 0; i < 16; i++) inv[i] *= det; return inv;
  }

  function frame(cam, L, crowd, dir, tRender) {
    resize();
    if (!blooms.length || !scene || !scene.ok) return;
    const aspect = R.w / R.h;
    // camera
    const fovy = aspect >= 1 ? lerp(0.98, 1.08, clamp((1.6 - aspect) / 0.6, 0, 1)) : lerp(1.1, 1.38, clamp((1 - aspect) / 0.55, 0, 1));
    const fz = fovy * (cam.zoom || 1); view.fovy = fz; view.eye = cam.eye;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw);
    const fwd = [sy * cp, sp, cy * cp];
    const at = [cam.eye[0] + fwd[0], cam.eye[1] + fwd[1], cam.eye[2] + fwd[2]];
    const V = M4.lookAt(cam.eye, at, [cam.roll || 0, 1, 0]), Pm = M4.perspective(fz, aspect, 0.08, 120);
    view.vp = M4.mul(Pm, V); view.inv = invert(view.vp);
    view.right = [V[0], V[4], V[8]]; view.up = [V[1], V[5], V[9]];
    // audience instance data
    const nowT = tRender;
    for (let i = 0; i < N; i++) {
      const o = i * 8;
      const clapping = crowd.clap[i] || (nowT - crowd.lastClap[i] < 0.3) ? 1 : 0;
      // hand separation from the actual clap times: they close as a clap approaches, snap together, spring apart
      let last = crowd.lastClap[i] <= nowT ? crowd.lastClap[i] : crowd.prevClap[i];
      const f = 1 / Math.max(0.12, crowd.lastClap[i] - crowd.prevClap[i]);
      const since = nowT - last, per = 1 / f;
      const ph = clamp(since / per, 0, 1.5);
      dyn[o] = clapping ? Math.min(1, Math.sin(Math.PI * Math.min(1, ph)) * 1.25) : 0;
      dyn[o + 1] = (clapping ? Math.exp(-since * 40) : 0) + (crowd.phone[i] > 0.02 ? 2 + crowd.phone[i] : 0);
      dyn[o + 2] = crowd.standH[i];
      const p = P[i]; dyn[o + 3] = crowd.arms[i] + 2 * clapping; crowd.shout[i] *= 0.93;
      dyn[o + 4] = clamp((L.perfX - p.x) / (Math.abs(p.z - PERF_Z) + 4) * 1.5, -1, 1) * 0.49 + 0.5 + Math.floor(crowd.shout[i] * 7.99);   // gaze in the fraction, an open mouth in the integer part
      const lv = crowd.leave[i]; dyn[o + 5] = lv;
      // the way out: along the row to the aisle, then up it; from the boxes and galleries, back through the door
      if (lv > 0) {
        if (p.tier === 0) { const ax = Math.sign(p.x || 1) * 4.0, u = smooth(0, 0.35, lv), w = Math.max(0, lv - 0.35) / 0.65; dyn[o + 6] = (ax - p.x) * u; dyn[o + 7] = w * (24 - p.z); }
        else { const u = Math.min(1, lv * 1.6); dyn[o + 6] = -p.fx * 2.4 * u; dyn[o + 7] = -p.fz * 2.4 * u; }
      } else { dyn[o + 6] = 0; dyn[o + 7] = 0; }
    }
    { // the conductor: applauds you while the house does, throws both arms up when you come back for a call
      const o = N * 8, c = dir.conductor || { clap: 0, arms: 0 }, per = 0.42, ph = (nowT % per) / per;
      dyn[o] = c.clap ? Math.min(1, Math.sin(Math.PI * ph) * 1.25) : 0; dyn[o + 1] = c.clap ? Math.exp(-ph * per * 20) : 0; dyn[o + 2] = 1;
      dyn[o + 3] = c.arms + 2 * (c.clap ? 1 : 0); dyn[o + 4] = clamp((L.perfX + 1.35) / 7 * 1.5, -1, 1) * 0.49 + 0.5; dyn[o + 5] = c.gone || 0; dyn[o + 6] = -(c.gone || 0) * 3; dyn[o + 7] = 0;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, dBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dyn);

    // ── scene pass
    gl.bindFramebuffer(gl.FRAMEBUFFER, msaa ? msaa.fbo : scene.fbo); gl.viewport(0, 0, R.w, R.h);
    gl.clearColor(0.004, 0.003, 0.003, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.disable(gl.CULL_FACE);
    gl.useProgram(hallProg); gl.uniformMatrix4fv(hallProg.u.uVP, false, view.vp); setUniformsLight(hallProg, L); gl.uniform1f(hallProg.u.uWing, L.wing); gl.uniform1f(hallProg.u.uSpotX, L.spotX);
    { // the stage manager's torch sweeps the boards by the footlights, toward the wing on the right of your view
      const halfH = Math.atan(Math.tan(fz / 2) * aspect), edge = Math.min(7, 3.4 * Math.tan(halfH));
      const u = (L.time * 0.55) % 1, x = L.perfX - edge * (0.35 + 0.6 * u), zz = -0.12 + 0.05 * Math.sin(L.time * 3.1);
      gl.uniform1f(hallProg.u.uTorch, (dir.torch || 0) * Math.sin(Math.PI * u) * (0.85 + 0.15 * Math.sin(L.time * 23)));
      gl.uniform3f(hallProg.u.uTorchP, x, zz, 0.15);
      if (dir.torch > 0.01) { const q = M4.project(view.vp, x, STAGE_Y, zz); R.torchScreenX = (q[0] * .5 + .5) * innerWidth; } else R.torchScreenX = null; }
    gl.bindVertexArray(hallVao); gl.drawElements(gl.TRIANGLES, hallCount, gl.UNSIGNED_INT, 0);
    // seats spring up when nobody's in them: when you stand, when you've gone, and the empty ones all night
    for (let k = 0; k < NS; k++) { const st = seatList[k], i = st.person; const want = i === undefined ? 1 : (crowd.leave[i] > 0.02 || crowd.standH[i] > 0.6 ? 1 : 0);
      seatTip[k] += (want - seatTip[k]) * (want > seatTip[k] ? 0.35 : 0.2); }
    gl.bindBuffer(gl.ARRAY_BUFFER, stBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, seatTip);
    gl.useProgram(seatProg); gl.uniformMatrix4fv(seatProg.u.uVP, false, view.vp); setUniformsLight(seatProg, L); gl.uniform1f(seatProg.u.uWing, L.wing); gl.uniform1f(seatProg.u.uSpotX, L.spotX);
    gl.bindVertexArray(seatVao); gl.drawElementsInstanced(gl.TRIANGLES, seatIdx, gl.UNSIGNED_SHORT, 0, NS);
    // audience (alpha-tested with soft edges; depth-sorted by the seat order is not needed at this size)
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(crowdProg); gl.uniformMatrix4fv(crowdProg.u.uVP, false, view.vp); setUniformsLight(crowdProg, L); gl.uniform3fv(crowdProg.u.uRight, view.right); gl.uniform1f(crowdProg.u.uNight, L.night || 0);
    gl.bindVertexArray(crowdVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, NI);
    gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.useProgram(glintProg); gl.uniformMatrix4fv(glintProg.u.uVP, false, view.vp); setUniformsLight(glintProg, L); gl.uniform2f(glintProg.u.uRes, R.w, R.h);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, NI);
    gl.depthMask(true); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // flowers
    const fl = dir.flowers; let nf = 0;
    for (let k = Math.max(0, fl.length - FLW); k < fl.length; k++) { const f = fl[k]; if (dir.t < f.t0) continue; const u = clamp((dir.t - f.t0) / f.dur, 0, 1);
      const x = lerp(f.x0, f.x1, u), z = lerp(f.z0, f.z1, u), y = lerp(f.y0, STAGE_Y + 0.03, u) + Math.sin(Math.PI * u) * 3.2;
      const o = nf * 8; fd[o] = x; fd[o + 1] = y; fd[o + 2] = z; fd[o + 3] = f.rot0 + f.spin * Math.min(u, 1) * f.dur; fd[o + 4] = f.hue; fd[o + 5] = u >= 1 ? 1 : 0; nf++; }
    if (nf) { gl.disable(gl.BLEND); gl.useProgram(flowerProg); gl.uniformMatrix4fv(flowerProg.u.uVP, false, view.vp); setUniformsLight(flowerProg, L); gl.uniform3fv(flowerProg.u.uRight, view.right); gl.uniform3fv(flowerProg.u.uUp, view.up);
      gl.bindBuffer(gl.ARRAY_BUFFER, flowerBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, fd, 0, nf * 8); gl.bindVertexArray(flowerVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, nf); }
    // lamps (additive, depth-tested, no depth write)
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
    gl.useProgram(lampProg); gl.uniformMatrix4fv(lampProg.u.uVP, false, view.vp); gl.uniform3fv(lampProg.u.uRight, view.right); gl.uniform3fv(lampProg.u.uUp, view.up);
    gl.uniform1f(lampProg.u.uStage, L.stage); gl.uniform1f(lampProg.u.uHouse, L.house); gl.uniform1f(lampProg.u.uChand, L.chand); gl.uniform1f(lampProg.u.uSpot, L.spot); gl.uniform1f(lampProg.u.uTime, L.time);
    gl.uniform1f(lampProg.u.uBoothPx, L.inBeam * 3.0);
    gl.bindVertexArray(lampVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, lampData.length / 8);
    // dust in the beam near you
    if (L.spot > 0.01) {
      const t = L.time;
      for (let k = 0; k < DUST; k++) { const d = dust[k]; const x = L.spotX + d.o[0] + Math.sin(t * d.sp + d.ph) * 0.3, y = STAGE_Y + 0.2 + ((d.o[1] + t * d.sp * 0.08) % 3.2), z = PERF_Z + d.o[2] + Math.cos(t * d.sp * 0.7 + d.ph) * 0.3;
        const tw = 0.5 + 0.5 * Math.sin(t * (1 + d.sp * 4) + d.ph * 3); const o = k * 8; dd[o] = x; dd[o + 1] = y; dd[o + 2] = z; dd[o + 3] = 0.004 + 0.003 * tw; dd[o + 4] = 1; dd[o + 5] = 0.9; dd[o + 6] = 0.75; dd[o + 7] = 7; }
      gl.bindBuffer(gl.ARRAY_BUFFER, dustBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, dd);
      gl.uniform1f(lampProg.u.uStage, L.spot * 0.12); gl.bindVertexArray(dustVao); gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, DUST);
    }
    gl.depthMask(true);
    if (msaa) { // resolve the multisampled scene (colour and depth) into the texture target
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, msaa.fbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, scene.fbo);
      gl.blitFramebuffer(0, 0, R.w, R.h, 0, 0, R.w, R.h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.blitFramebuffer(0, 0, R.w, R.h, 0, 0, R.w, R.h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    // beam (additive, reads depth)
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(beamProg); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.depth); gl.uniform1i(beamProg.u.uDepth, 0);
    gl.uniformMatrix4fv(beamProg.u.uInvVP, false, view.inv); gl.uniform3fv(beamProg.u.uCam, view.eye); gl.uniform3fv(beamProg.u.uBooth, HOUSE.booth);
    gl.uniform3f(beamProg.u.uTarget, L.spotX, STAGE_Y + 0.9, PERF_Z); gl.uniform1f(beamProg.u.uSpot, L.spot); gl.uniform1f(beamProg.u.uTime, L.time); gl.uniform1f(beamProg.u.uHaze, 1);
    // (the depth texture is attached to the framebuffer we're drawing into, so draw the beam into the first bloom level's input instead)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    // ── post
    gl.disable(gl.BLEND);
    let src = scene;
    for (let k = 0; k < blooms.length; k++) {
      const b = blooms[k]; gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo); gl.viewport(0, 0, b.w, b.h);
      gl.useProgram(downProg); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(downProg.u.uTex, 0);
      gl.uniform2f(downProg.u.uTexel, 1 / src.w, 1 / src.h); gl.uniform1f(downProg.u.uFirst, k === 0 ? 1 : 0); gl.uniform1f(downProg.u.uLdr, K.floatRT ? 0 : 1); K.fullscreen(); src = b;
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let k = blooms.length - 2; k >= 0; k--) {
      const b = blooms[k], s = blooms[k + 1]; gl.bindFramebuffer(gl.FRAMEBUFFER, b.fbo); gl.viewport(0, 0, b.w, b.h);
      gl.useProgram(upProg); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.uniform1i(upProg.u.uTex, 0); gl.uniform2f(upProg.u.uTexel, 1 / s.w, 1 / s.h); K.fullscreen();
    }
    // beam goes into the bloom chain's top level at half resolution (cheap, and it wants to be soft anyway)
    gl.bindFramebuffer(gl.FRAMEBUFFER, blooms[0].fbo); gl.viewport(0, 0, blooms[0].w, blooms[0].h);
    gl.useProgram(beamProg); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.depth); K.fullscreen();
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, R.w, R.h);
    gl.useProgram(finalProg); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, scene.tex); gl.uniform1i(finalProg.u.uTex, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, blooms[0].tex); gl.uniform1i(finalProg.u.uBloom, 1);
    gl.uniform1f(finalProg.u.uExposure, L.exposure); gl.uniform1f(finalProg.u.uFade, L.fade); gl.uniform1f(finalProg.u.uTime, L.time); gl.uniform1f(finalProg.u.uGrain, 0.035);
    gl.uniform2f(finalProg.u.uRes, R.w, R.h);
    K.fullscreen();
    gl.activeTexture(gl.TEXTURE0);
  }

  // where on screen is a point in the house (for picking and for the gaze)
  function toScreen(x, y, z) { const q = M4.project(view.vp, x, y, z); return [(q[0] * .5 + .5) * innerWidth, (1 - (q[1] * .5 + .5)) * innerHeight, q[2]]; }
  return Object.assign(R, { frame, resize, view, toScreen });
}
