/* ============================================================================
   GEO — процедурні геометрії (все в метрах, в «проєктних» координатах авто).
   Кожна функція повертає BufferGeometry, вже розміщену у світі.
   ========================================================================== */

const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const AV = a => (a && a.isVector3) ? a.clone() : new THREE.Vector3(a[0], a[1], a[2]);
const UPV = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const PI = Math.PI;
// точка на «колі» навколо осі X: x — зсув вздовж осі, r — радіус, th — кут від +Y до +Z
const polar = (c, x, r, th) => V3(c.x + x, c.y + r * Math.cos(th), c.z + r * Math.sin(th));

const G = {};

G.quatY = dir => new THREE.Quaternion().setFromUnitVectors(UPV, dir.clone().normalize());

/* Повернути геометрію так, щоб +Y дивився вздовж dir, і перенести в c */
G.place = (geo, c, dir) => {
  if (dir) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(G.quatY(dir)));
  if (c) geo.translate(c.x, c.y, c.z);
  return geo;
};

/* Матриця з базису */
G.basis = (geo, o, x, y, z) => {
  const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(o);
  geo.applyMatrix4(m);
  return geo;
};

/* Циліндр/конус між двома точками */
G.cyl = (a, b, rA, rB = rA, seg = 24, open = false) => {
  a = AV(a); b = AV(b);
  const d = b.clone().sub(a), L = d.length();
  const g = new THREE.CylinderGeometry(rB, rA, L, seg, 1, open);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(G.quatY(d)));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
};

G.sphere = (c, r, seg = 16) => { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)); c = AV(c); g.translate(c.x, c.y, c.z); return g; };

/* Паралелепіпед із довільним базисом (x,y,z — одиничні вектори; за замовчуванням осі світу) */
G.box = (c, size, bx, by, bz) => {
  const g = new THREE.BoxGeometry(size[0], size[1], size[2]);
  c = AV(c);
  if (bx) g.applyMatrix4(new THREE.Matrix4().makeBasis(bx, by, bz));
  g.translate(c.x, c.y, c.z);
  return g;
};

/* Балка між точками: довжина вздовж a→b, ширина w вздовж ref (проєкція), висота h */
G.beam = (a, b, w, h, ref = UPV) => {
  a = AV(a); b = AV(b);
  const y = b.clone().sub(a), L = y.length(); y.normalize();
  let x = AV(ref).sub(y.clone().multiplyScalar(AV(ref).dot(y)));
  if (x.lengthSq() < 1e-8) x = V3(1, 0, 0).sub(y.clone().multiplyScalar(y.x));
  x.normalize();
  const z = new THREE.Vector3().crossVectors(x, y).normalize();
  const g = new THREE.BoxGeometry(w, L, h);
  g.applyMatrix4(new THREE.Matrix4().makeBasis(x, y, z));
  const m = a.clone().add(b).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
};

/* Шестигранна головка/гайка (під ключ = across), вісь вздовж dir */
G.hex = (c, dir, across, height, rot = 0) => {
  const R = across / Math.sqrt(3);
  const g = new THREE.CylinderGeometry(R, R, height, 6, 1);
  g.rotateY(rot);
  return G.place(g, AV(c), dir);
};

/* Тор */
G.torus = (c, dir, R, r, seg = 40, tseg = 10) => G.place(new THREE.TorusGeometry(R, r, tseg, seg).rotateX(PI / 2), AV(c), dir);

/* ---------- Тіла обертання з контролем різких ребер ----------------------
   profile: [[r,h],...] — обхід ПРОТИ годинникової стрілки (матеріал зліва),
   тоді нормалі «назовні». crease — кут (рад), більший за який ребро різке. */
G.lathe = (profile, o = {}) => {
  const seg = o.seg || 36, crease = o.crease == null ? 0.75 : o.crease;
  const sw = o.sweep || [0, TAU];
  const mod = o.mod;
  const nS = profile.length - 1, sn = [];
  for (let i = 0; i < nS; i++) {
    const dr = profile[i + 1][0] - profile[i][0], dh = profile[i + 1][1] - profile[i][1], l = Math.hypot(dr, dh) || 1;
    sn.push([dh / l, -dr / l]);
  }
  const join = (p, q) => {
    const d = p[0] * q[0] + p[1] * q[1];
    if (Math.acos(Math.max(-1, Math.min(1, d))) < crease) { const s = [p[0] + q[0], p[1] + q[1]], l = Math.hypot(s[0], s[1]) || 1; return [s[0] / l, s[1] / l]; }
    return null;
  };
  const pos = [], nor = [];
  const push = (r, h, ph, n) => {
    let rr = r;
    if (mod) rr = mod(r, h, ph);
    pos.push(rr * Math.cos(ph), h, rr * Math.sin(ph));
    nor.push(n[0] * Math.cos(ph), n[1], n[0] * Math.sin(ph));
  };
  for (let i = 0; i < nS; i++) {
    const a = profile[i], b = profile[i + 1];
    let na = sn[i], nb = sn[i];
    if (i > 0) na = join(sn[i - 1], sn[i]) || na;
    if (i < nS - 1) nb = join(sn[i], sn[i + 1]) || nb;
    for (let j = 0; j < seg; j++) {
      const p0 = sw[0] + (sw[1] - sw[0]) * j / seg, p1 = sw[0] + (sw[1] - sw[0]) * (j + 1) / seg;
      push(a[0], a[1], p0, na); push(b[0], b[1], p0, nb); push(b[0], b[1], p1, nb);
      push(a[0], a[1], p0, na); push(b[0], b[1], p1, nb); push(a[0], a[1], p1, na);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return G.place(g, o.c ? AV(o.c) : null, o.dir ? AV(o.dir) : null);
};

/* Тіло обертання навколо осі X з центром у c; профіль: [радіус, зсув_по_X] */
G.latheX = (profile, c, o = {}) => G.lathe(profile, Object.assign({ c, dir: V3(1, 0, 0) }, o));

/* ---------- Труба по ламаній із скругленнями (стабілізатори, шланги) ------ */
G.filletPath = (pts, fr) => {
  pts = pts.map(AV);
  if (pts.length < 3 || !fr) return pts;
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const P = pts[i], d1 = pts[i - 1].clone().sub(P), d2 = pts[i + 1].clone().sub(P);
    const l1 = d1.length(), l2 = d2.length(); d1.normalize(); d2.normalize();
    const cosT = Math.max(-1, Math.min(1, d1.dot(d2))), th = Math.acos(cosT);
    if (th > PI - 1e-3 || th < 1e-3) { out.push(P); continue; }
    let r = fr;
    const tl = r / Math.tan(th / 2), maxT = Math.min(l1, l2) * 0.5;
    if (tl > maxT) r = maxT * Math.tan(th / 2);
    const t = r / Math.tan(th / 2);
    const s = P.clone().addScaledVector(d1, t), e = P.clone().addScaledVector(d2, t);
    const bis = d1.clone().add(d2).normalize();
    const cen = P.clone().addScaledVector(bis, r / Math.sin(th / 2));
    const v0 = s.clone().sub(cen), v1 = e.clone().sub(cen);
    const ang = v0.angleTo(v1), ax = new THREE.Vector3().crossVectors(v0, v1).normalize();
    const n = Math.max(4, Math.ceil(ang / 0.18));
    for (let k = 0; k <= n; k++) out.push(cen.clone().add(v0.clone().applyAxisAngle(ax, ang * k / n)));
  }
  out.push(pts[pts.length - 1]);
  return out;
};

G.tube = (pts, r, o = {}) => {
  const dense = G.filletPath(pts, o.fillet || 0);
  const curve = dense.length === 2 ? new THREE.LineCurve3(dense[0], dense[1]) : new THREE.CatmullRomCurve3(dense, false, 'centripetal');
  const segs = o.segs || Math.max(6, dense.length * (dense.length > 4 ? 2 : 4));
  const g = new THREE.TubeGeometry(curve, segs, r, o.radial || 10, false);
  if (!o.caps) return g;
  return G.merge([g, G.sphere(dense[0], r, 10), G.sphere(dense[dense.length - 1], r, 10)]);
};

/* ---------- Видавлювання плоского контуру ---------------------------------
   pts: [[u,v],...] проти годинникової; holes: [[[u,v]..],..]
   Площина задається початком O та осями u, v; видавлювання вздовж u×v. */
G.extrude = (pts, o) => {
  const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  (o.holes || []).forEach(h => shape.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1])))));
  const bev = o.bevel || 0;
  const g = new THREE.ExtrudeGeometry(shape, { depth: o.depth, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: o.curve || 8 });
  if (o.center) g.translate(0, 0, -o.depth / 2);
  const u = AV(o.u || V3(1, 0, 0)).normalize(), v = AV(o.v || V3(0, 1, 0)).normalize();
  const w = new THREE.Vector3().crossVectors(u, v).normalize();
  return G.basis(g, AV(o.O || V3()), u, v, w);
};

/* Коло як масив точок (для отворів) */
G.circle2 = (cu, cv, r, n = 20, cw = true) => {
  const a = [];
  for (let i = 0; i < n; i++) { const t = (cw ? -1 : 1) * TAU * i / n; a.push([cu + r * Math.cos(t), cv + r * Math.sin(t)]); }
  return a;
};

/* Скруглений опуклий багатокутник (обхід проти годинникової) */
G.roundPoly = (pts, rad, n = 6) => {
  const out = [], N = pts.length;
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i + N - 1) % N], p1 = pts[i], p2 = pts[(i + 1) % N];
    const a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]), a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    let d = a2 - a1; while (d < 0) d += TAU; while (d > TAU) d -= TAU;
    // нормалі зовнішні: (sin a, −cos a)
    const nA = a1 - PI / 2, nB = a2 - PI / 2;
    const rr = typeof rad === 'function' ? rad(i) : rad;
    for (let k = 0; k <= n; k++) {
      const t = nA + (d > PI ? 0 : d) * k / n;
      out.push([p1[0] + rr * Math.cos(t), p1[1] + rr * Math.sin(t)]);
    }
  }
  return out;
};

/* Відступ усередину/назовні опуклого багатокутника (miter) */
G.offsetPoly = (pts, d) => {
  const N = pts.length, out = [];
  for (let i = 0; i < N; i++) {
    const p0 = pts[(i + N - 1) % N], p1 = pts[i], p2 = pts[(i + 1) % N];
    const e1 = [p1[0] - p0[0], p1[1] - p0[1]], e2 = [p2[0] - p1[0], p2[1] - p1[1]];
    const l1 = Math.hypot(...e1), l2 = Math.hypot(...e2);
    const n1 = [e1[1] / l1, -e1[0] / l1], n2 = [e2[1] / l2, -e2[0] / l2];
    const bx = n1[0] + n2[0], by = n1[1] + n2[1], k = 1 + (n1[0] * n2[0] + n1[1] * n2[1]);
    out.push([p1[0] + d * bx / k, p1[1] + d * by / k]);
  }
  return out;
};

/* ---------- Пружина: геометрія вздовж локальної осі +Y, довжина змінна ---- */
G.helix = o => {
  const R = o.R, w = o.wire, act = o.active, e = o.endTurns == null ? 0.8 : o.endTurns;
  const M = o.radial || 8, per = o.perTurn || 22, nT = act + 2 * e, N = Math.ceil(nT * per);
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array((N + 1) * (M + 1) * 3), nor = new Float32Array((N + 1) * (M + 1) * 3);
  const idx = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = (i + 1) * (M + 1) + j, c = b + 1, d = a + 1;
    idx.push(a, b, d, b, c, d);
  }
  g.setIndex(idx);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.userData.update = L => {
    if (g.userData.lastL !== undefined && Math.abs(L - g.userData.lastL) < 1e-7) return;
    g.userData.lastL = L;
    const pe = w * 1.03, pa = Math.max(w * 1.02, (L - w - 2 * e * pe) / act);
    const yAt = t => w / 2 + (t < e ? pe * t : t < e + act ? pe * e + pa * (t - e) : pe * e + pa * act + pe * (t - e - act));
    const pitchAt = t => (t < e || t > e + act) ? pe : pa;
    for (let i = 0; i <= N; i++) {
      const t = nT * i / N, th = TAU * t, c = Math.cos(th), s = Math.sin(th);
      const er = V3(c, 0, s), T = V3(-R * s, pitchAt(t) / TAU, R * c).normalize();
      const bn = new THREE.Vector3().crossVectors(T, er).normalize();
      const cy = yAt(t);
      for (let j = 0; j <= M; j++) {
        const al = TAU * j / M, ca = Math.cos(al), sa = Math.sin(al);
        const nx = er.x * ca + bn.x * sa, ny = er.y * ca + bn.y * sa, nz = er.z * ca + bn.z * sa;
        const k = (i * (M + 1) + j) * 3;
        pos[k] = R * c + nx * w / 2; pos[k + 1] = cy + ny * w / 2; pos[k + 2] = R * s + nz * w / 2;
        nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
      }
    }
    g.attributes.position.needsUpdate = true; g.attributes.normal.needsUpdate = true;
    g.computeBoundingSphere(); g.computeBoundingBox();
  };
  g.userData.update(o.L);
  // перевірка орієнтації граней: нормаль трикутника проти атрибутної нормалі
  const p = g.attributes.position.array, n = g.attributes.normal.array, ia = g.index.array;
  const A = V3(p[ia[0] * 3], p[ia[0] * 3 + 1], p[ia[0] * 3 + 2]), B = V3(p[ia[1] * 3], p[ia[1] * 3 + 1], p[ia[1] * 3 + 2]), C = V3(p[ia[2] * 3], p[ia[2] * 3 + 1], p[ia[2] * 3 + 2]);
  const fn = new THREE.Vector3().crossVectors(B.clone().sub(A), C.clone().sub(A));
  if (fn.dot(V3(n[ia[0] * 3], n[ia[0] * 3 + 1], n[ia[0] * 3 + 2])) < 0) {
    for (let i = 0; i < ia.length; i += 3) { const t = ia[i + 1]; ia[i + 1] = ia[i + 2]; ia[i + 2] = t; }
  }
  return g;
};

/* Гофрований пильовик вздовж +Y довжиною 1: від радіуса rA (y=0) до rB (y=1) */
G.bellows = (rA, rB, folds, amp, seg = 28) => {
  const prof = [];
  const n = folds * 2;
  for (let i = 0; i <= n; i++) {
    const t = i / n, base = rA + (rB - rA) * t;
    prof.push([base + (i % 2 ? -amp : amp) * (i === 0 || i === n ? 0.3 : 1), t]);
  }
  return G.lathe(prof, { seg, crease: 3 });
};

/* ---------- Злиття геометрій в один буфер -------------------------------- */
G.merge = geos => {
  let total = 0;
  const gs = geos.map(g => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (!ng.attributes.normal) ng.computeVertexNormals();
    total += ng.attributes.position.count;
    return ng;
  });
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  gs.forEach(g => {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
};

/* ---------- Збирач деталі: складає геометрії за матеріалами -------------- */
class PB {
  constructor() { this.list = []; }
  add(geo, mat) { this.list.push({ geo, mat }); return this; }
  addAll(geos, mat) { geos.forEach(g => this.add(g, mat)); return this; }
  build() {
    const by = new Map();
    this.list.forEach(it => { if (!by.has(it.mat)) by.set(it.mat, []); by.get(it.mat).push(it.geo); });
    const grp = new THREE.Group();
    by.forEach((geos, mat) => grp.add(new THREE.Mesh(G.merge(geos), mat)));
    return grp;
  }
}

/* Матриця: поворот на угол ang навколо осі (через точку p) */
G.rotAbout = (p, axis, ang) => {
  const m = new THREE.Matrix4().makeRotationAxis(axis.clone().normalize(), ang);
  const t1 = new THREE.Matrix4().makeTranslation(p.x, p.y, p.z), t0 = new THREE.Matrix4().makeTranslation(-p.x, -p.y, -p.z);
  return t1.multiply(m).multiply(t0);
};

/* Матриця «жорсткий відрізок»: старі кінці (a0,b0) → нові (a1,b1), без обертання навколо власної осі */
G.rigidSeg = (a0, b0, a1, b1) => {
  const d0 = b0.clone().sub(a0).normalize(), d1 = b1.clone().sub(a1).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(d0, d1);
  const m = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const t = new THREE.Matrix4().makeTranslation(a1.x, a1.y, a1.z), t0 = new THREE.Matrix4().makeTranslation(-a0.x, -a0.y, -a0.z);
  return t.multiply(m).multiply(t0);
};
