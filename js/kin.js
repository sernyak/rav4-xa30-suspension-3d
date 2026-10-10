/* ============================================================================
   KIN — кінематика підвіски (чистий JS, без залежностей).
   Кулак (rigid body) має 6 ступенів свободи. Кожен важіль/тяга накладає
   «умову постійної довжини», хід колеса задає висоту — і Ньютон знаходить
   положення кулака. Саме це дає реальну зміну розвалу/сходження на ходу.

   Поза кулака: p' = c + R(r)·(p − c) + t,   x = [tx,ty,tz, rx,ry,rz]
   (r — вектор повороту, c — центр колеса у «проєктному» положенні).
   ========================================================================== */

const KIN = (function () {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  // поворот вектора p на вектор повороту r (формула Родрігеса)
  function rotVec(r, p) {
    const th = Math.hypot(r[0], r[1], r[2]);
    if (th < 1e-14) return [p[0], p[1], p[2]];
    const k = [r[0] / th, r[1] / th, r[2] / th];
    const c = Math.cos(th), s = Math.sin(th), kd = dot(k, p) * (1 - c), kx = cross(k, p);
    return [p[0] * c + kx[0] * s + k[0] * kd, p[1] * c + kx[1] * s + k[1] * kd, p[2] * c + kx[2] * s + k[2] * kd];
  }

  function posePt(x, c, p) {
    const q = rotVec([x[3], x[4], x[5]], sub(p, c));
    return [c[0] + q[0] + x[0], c[1] + q[1] + x[1], c[2] + q[2] + x[2]];
  }

  function solveLin(J, b) {
    const n = b.length, M = J.map((row, i) => row.concat([b[i]]));
    for (let i = 0; i < n; i++) {
      let p = i;
      for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
      [M[i], M[p]] = [M[p], M[i]];
      const d = M[i][i] || 1e-18;
      for (let r = i + 1; r < n; r++) {
        const f = M[r][i] / d;
        for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
      }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n];
      for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c];
      x[i] = s / (M[i][i] || 1e-18);
    }
    return x;
  }

  const n2 = f => f.reduce((s, v) => s + v * v, 0);

  function newton(F, x0) {
    let x = x0.slice(), h = 1e-6, err = 0;
    for (let it = 0; it < 40; it++) {
      const f = F(x), e = n2(f);
      err = Math.sqrt(e);
      if (e < 1e-16) break;
      const J = f.map(() => new Array(x.length));
      for (let j = 0; j < x.length; j++) {
        const xp = x.slice(); xp[j] += h;
        const fp = F(xp);
        for (let i = 0; i < f.length; i++) J[i][j] = (fp[i] - f[i]) / h;
      }
      const dx = solveLin(J, f.map(v => -v));
      let t = 1, xn = x;
      for (let k = 0; k < 14; k++) {
        xn = x.map((v, i) => v + t * dx[i]);
        if (n2(F(xn)) < e) break;
        t *= 0.5;
      }
      x = xn;
    }
    return { x, err };
  }

  /* ---------- Передня підвіска: McPherson ------------------------------- */
  function makeFront(S) {
    const c = S.C;
    const d0 = norm(sub(S.U, S.A));
    const n1 = norm(cross(d0, Math.abs(d0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const n2v = cross(d0, n1);
    const L1 = len(sub(S.B, S.P1)), L2 = len(sub(S.B, S.P2)), Lt = len(sub(S.T, S.R));
    return function (travel, shift, x0) {
      const Rc = [S.R[0] + shift, S.R[1], S.R[2]];
      const F = x => {
        const r = [x[3], x[4], x[5]];
        const Bp = posePt(x, c, S.B), Tp = posePt(x, c, S.T), Ap = posePt(x, c, S.A);
        const v = sub(S.U, Ap);
        return [
          len(sub(Bp, S.P1)) - L1,
          len(sub(Bp, S.P2)) - L2,
          len(sub(Tp, Rc)) - Lt,
          dot(v, rotVec(r, n1)),
          dot(v, rotVec(r, n2v)),
          x[1] - travel,
        ];
      };
      return newton(F, x0);
    };
  }

  /* ---------- Задня підвіска: 4 тяги (верхній, нижні №1/№2, поздовжній) -- */
  function makeRear(S) {
    const c = S.C;
    const links = [['Pu', 'Qu'], ['P1', 'Q1'], ['P2', 'Q2'], ['Pt', 'Qt']].map(([p, q]) => ({ P: S[p], Q: S[q], L: len(sub(S[q], S[p])) }));
    return function (travel, _shift, x0) {
      const F = x => {
        const f = links.map(l => len(sub(posePt(x, c, l.Q), l.P)) - l.L);
        f.push(x[1] - travel);
        f.push(rotVec([x[3], x[4], x[5]], [0, 0, 1])[1]);   // кулак не «клює» носом
        return f;
      };
      return newton(F, x0);
    };
  }

  /* Рух до цілі невеликими кроками — для стійкої збіжності */
  function stepTo(solver, travel, shift, x0, prev) {
    const dt = travel - prev.travel, ds = shift - prev.shift;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dt) / 0.01, Math.abs(ds) / 0.01)));
    let x = x0, err = 0;
    for (let i = 1; i <= steps; i++) {
      const r = solver(prev.travel + dt * i / steps, prev.shift + ds * i / steps, x);
      x = r.x; err = r.err;
    }
    return { x, err };
  }

  /* Кут плеча стабілізатора (обертання навколо осі X) так, щоб стійка мала
     сталу довжину: |tip(φ) − top| = ℓ. Шукаємо корінь найближчий до prev. */
  function barAngle(axisYZ, tip0, top, link, prev) {
    const [ay, az] = axisYZ;
    const vy = tip0[1] - ay, vz = tip0[2] - az;
    const tip = phi => [tip0[0], ay + vy * Math.cos(phi) - vz * Math.sin(phi), az + vy * Math.sin(phi) + vz * Math.cos(phi)];
    const g = phi => len(sub(tip(phi), top)) - link;
    let best = null;
    const N = 240, lo = -0.9, hi = 0.9;
    let pa = lo, ga = g(lo);
    for (let i = 1; i <= N; i++) {
      const pb = lo + (hi - lo) * i / N, gb = g(pb);
      if (ga === 0 || ga * gb < 0) {
        let a = pa, b = pb, fa = ga;
        for (let k = 0; k < 50; k++) {
          const m = 0.5 * (a + b), fm = g(m);
          if (fa * fm <= 0) b = m; else { a = m; fa = fm; }
        }
        const root = 0.5 * (a + b);
        if (best === null || Math.abs(root - prev) < Math.abs(best - prev)) best = root;
      }
      pa = pb; ga = gb;
    }
    return best === null ? prev : best;
  }

  /* Кути кулака: розвал, сходження (град), зсув колії (мм) */
  function angles(x, side) {
    const r = [x[3], x[4], x[5]];
    const ax = rotVec(r, [1, 0, 0]), fw = rotVec(r, [0, 0, 1]);
    const d = 180 / Math.PI;
    return { camber: -Math.asin(ax[1]) * d, toe: -Math.asin(fw[0]) * d, track: x[0] * 1000 };
  }

  return { sub, add, mul, dot, cross, len, norm, rotVec, posePt, newton, makeFront, makeRear, stepTo, barAngle, angles };
})();
