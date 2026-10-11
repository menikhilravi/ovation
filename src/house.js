// house.js — the venue: an Italianate horseshoe opera house seen from its stage.
// Units are metres. x → performer's right, y ↑, z → away from the stage into the house.
// The stalls floor at the front row is y = 0; the stage floor is y = STAGE_Y; the stage edge is z = 0.

const STAGE_Y = 1.15;
const EYE = 1.66;                 // performer's eye height above the stage
const PERF_Z = -3.4;              // where the performer stands (upstage of the edge)
const PIT_Z = 2.9;                // orchestra pit between the stage edge and the front row
const WING_X = 7.4;               // |x| beyond which the performer is in the wings
const HOUSE = {
  tiers: [4.5, 7.5, 10.5, 13.5],  // parapet top heights (above the stalls floor)
  sideX: 12.4, sideZ0: 3.4, backCz: 12.5, backA: 12.4, backB: 15.2,
  ceilingY: 17.2, chandelier: [0, 14.2, 14.8], booth: [0, 15.6, 29.2],
};

// The horseshoe plan curve, sampled as a polyline from the left proscenium end, round the back, to the right.
function horseshoeCurve(offset) {
  const pts = [];
  const { sideX, sideZ0, backCz, backA, backB } = HOUSE;
  const a = backA + offset, b = backB + offset, sx = sideX + offset;
  for (let z = sideZ0; z < backCz; z += 0.25) pts.push([-sx, z]);
  for (let i = 0; i <= 160; i++) { const th = -Math.PI / 2 + Math.PI * i / 160; pts.push([Math.sin(th) * a, backCz + Math.cos(th) * b]); }
  for (let z = backCz - 0.25; z >= sideZ0; z -= 0.25) pts.push([sx, z]);
  // cumulative arc length and inward normals (pointing into the house)
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = (s) => { // s in metres along the curve
    s = clamp(s, 0, len[len.length - 1]);
    let lo = 0, hi = len.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (len[m] < s) lo = m; else hi = m; }
    const t = (s - len[lo]) / Math.max(1e-6, len[hi] - len[lo]);
    const x = lerp(pts[lo][0], pts[hi][0], t), z = lerp(pts[lo][1], pts[hi][1], t);
    let tx = pts[hi][0] - pts[lo][0], tz = pts[hi][1] - pts[lo][1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    return { x, z, nx: tz, nz: -tx, tx, tz }; // (nx,nz) points inward, into the house, for this winding
  };
  return { pts, length: len[len.length - 1], at };
}

function buildHouse(seed) {
  const rng = makeRng(seed);
  const seats = [];   // every seat, occupied or not: {x,y,z, face:[fx,fz], tier, row, box, occupied, person}
  // ── stalls: shallow-raked rows on arcs centred behind the stage, split by two aisles
  for (let r = 0; r < 21; r++) {
    const z0 = 3.9 + r * 0.96, y = r * 0.105, R = z0 + 56;
    const halfW = Math.min(11.3, 6.6 + r * 0.3);
    const n = Math.floor(halfW * 2 / 0.56);
    for (let k = 0; k < n; k++) {
      const x0 = -halfW + (k + .5) * (halfW * 2 / n);
      if (Math.abs(Math.abs(x0) - 4.0) < 0.5) continue;              // aisles
      const a = Math.asin(clamp(x0 / R, -1, 1)), x = Math.sin(a) * R, z = -56 + Math.cos(a) * R;
      seats.push({ x, y, z, fx: -Math.sin(a), fz: -Math.cos(a), tier: 0, row: r, box: 0 });
    }
  }
  // ── horseshoe tiers: parapet, then rows stepping up and back; the sides are divided into boxes
  HOUSE.tiers.forEach((top, ti) => {
    const rows = ti === 3 ? 4 : 3, rise = ti === 3 ? 0.55 : 0.38;
    for (let r = 0; r < rows; r++) {
      const c = horseshoeCurve(0.55 + r * 0.86);
      const pitch = 0.6, n = Math.floor(c.length / pitch);
      for (let k = 0; k < n; k++) {
        const s = (k + .5) * c.length / n, p = c.at(s);
        if (p.z < HOUSE.sideZ0 + 0.8) continue;
        const boxIdx = Math.floor(s / 2.5);
        if (ti < 3 && p.z < HOUSE.backCz && (s % 2.5) < 0.35) continue; // box partitions on the sides
        seats.push({ x: p.x, y: top - 1.0 + r * rise, z: p.z, fx: p.nx, fz: p.nz, tier: ti + 1, row: r, box: ti < 3 && p.z < HOUSE.backCz ? boxIdx + 1 : 0 });
      }
    }
  });
  // ── who came tonight: ~94% occupancy, fuller in the good seats
  const people = [];
  for (const s of seats) {
    const good = s.tier === 0 ? 1 - s.row / 60 : 0.93 - s.tier * 0.02;
    s.occupied = rng() < good * 0.97;
    if (!s.occupied) continue;
    s.person = people.length;
    people.push(s);
  }
  // distance and bearing from the performer's home mark (for audio zones and sight-lines)
  for (const p of people) {
    const dx = p.x, dz = p.z - PERF_Z, dy = p.y + 1.1 - (STAGE_Y + EYE);
    p.dist = Math.hypot(dx, dy, dz);
    p.az = Math.atan2(dx, dz);
    p.el = Math.atan2(dy, Math.hypot(dx, dz));
  }
  // neighbours (for contagion) and "the people in front of me" (for the standing cascade: you see the rows ahead)
  const N = people.length, cell = 2.2, grid = new Map(), key = (i, j, k) => i + ',' + j + ',' + k;
  people.forEach((p, i) => { const kk = key(Math.floor(p.x / cell), Math.floor(p.y / cell), Math.floor(p.z / cell)); (grid.get(kk) || grid.set(kk, []).get(kk)).push(i); });
  for (let i = 0; i < N; i++) {
    const p = people[i], gi = Math.floor(p.x / cell), gj = Math.floor(p.y / cell), gk = Math.floor(p.z / cell);
    const near = [], front = [];
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const list = grid.get(key(gi + a, gj + b, gk + c)); if (!list) continue;
      for (const j of list) { if (j === i) continue; const q = people[j];
        const d = Math.hypot(q.x - p.x, (q.y - p.y) * 1.5, q.z - p.z);
        if (d < 2.3) near.push([d, j]);
        // in front: closer to the stage along my facing, roughly within my view cone, same level
        const ahead = (q.x - p.x) * p.fx + (q.z - p.z) * p.fz, side = Math.abs((q.x - p.x) * p.fz - (q.z - p.z) * p.fx);
        if (ahead > 0.3 && ahead < 3.2 && side < ahead * 1.1 + 0.6 && Math.abs(q.y - p.y) < 1.0 && q.tier === p.tier) front.push([ahead + side, j]);
      }
    }
    near.sort((u, v) => u[0] - v[0]); front.sort((u, v) => u[0] - v[0]);
    p.near = near.slice(0, 10).map(e => e[1]);
    p.front = front.slice(0, 7).map(e => e[1]);
  }
  return { seats, people, N, rng };
}
