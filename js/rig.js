/* ============================================================================
   RIG — каркас моделі: реєстр деталей (Part), їх візуальні частини (Sub),
   кадри вузлів (FL/FR/RL/RR/W) і розрахунок руху.

   Part  — логічна деталь (те, що можна вибрати кліком і прочитати про неї).
   Sub   — фізичний об'єкт у сцені, що належить деталі й рухається з певним
           тілом (кулак, важіль, рейка…). Деталь може мати кілька Sub
           (напр. стабілізатор: середина + два плеча).
   ========================================================================== */

const SIDE_UA = { FL: 'ліва передня', FR: 'права передня', RL: 'ліва задня', RR: 'права задня', W: '' };

class Part {
  constructor(key, type, frame) {
    this.key = key; this.type = type; this.frame = frame;
    this.subs = []; this.meshes = [];
    this.visible = true; this.state = 'normal';   // normal | selected | hover | dim
    this.info = (typeof INFO !== 'undefined' && INFO[type]) || { ua: type, en: '', sys: 'body' };
  }
  get title() {
    const side = SIDE_UA[this.frame];
    return this.info.ua + (side ? ' — ' + side : '');
  }
}

class Sub {
  constructor(part, obj, frame, o) {
    this.part = part; this.obj = obj; this.frame = frame;
    this.fn = o.fn || null;                       // (ctx, cc) → Matrix4 (рух тіла)
    this.ex = o.ex ? V3(o.ex[0], o.ex[1], o.ex[2]) : V3();   // вектор розбирання
    this.spin = o.spin || null;                   // {C: Vector3} — обертання навколо X через C
    this.spinDir = o.spinDir || 1;
    obj.matrixAutoUpdate = false;
  }
}

const _I = new THREE.Matrix4();

class Car {
  constructor() {
    this.root = new THREE.Group();
    this.frames = { W: this.root };
    ['FL', 'FR', 'RL', 'RR'].forEach(k => {
      const g = new THREE.Group(); g.name = k;
      if (k[1] === 'R') g.scale.x = -1;           // права сторона — дзеркало лівої
      this.root.add(g); this.frames[k] = g;
    });
    this.parts = new Map(); this.subs = [];
    this.kin = {};
    this.solvers = { F: KIN.makeFront(SPEC.front), R: KIN.makeRear(SPEC.rear) };
    ['FL', 'FR', 'RL', 'RR'].forEach(k => { this.kin[k] = { x: [0, 0, 0, 0, 0, 0], travel: 0, shift: 0, phi: 0 }; });
    this.ctx = null;
    this.explode = 0;
  }

  /* Додати візуальний об'єкт до деталі (створюючи її за потреби) */
  add(type, frame, obj, o = {}) {
    const key = o.key || (frame === 'W' ? type : frame + '.' + type);
    let part = this.parts.get(key);
    if (!part) {
      part = new Part(key, type, o.partFrame || frame);
      if (o.instance) part.instance = o.instance;
      this.parts.set(key, part);
    }
    if (o.ghost) part.ghost = true;
    if (!o.ex && typeof EXPLODE !== 'undefined' && EXPLODE[type]) o = Object.assign({}, o, { ex: EXPLODE[type] });
    const sub = new Sub(part, obj, frame, o);
    part.subs.push(sub); this.subs.push(sub);
    this.frames[frame].add(obj);
    // власні матеріали для деталі (щоб підсвічувати окремо) + прив'язка до деталі
    const cache = new Map();
    obj.traverse(m => {
      if (!m.isMesh) return;
      let mat = cache.get(m.material);
      if (!mat) { mat = m.material.clone(); mat.userData = { base: m.material }; cache.set(m.material, mat); }
      m.material = mat;
      m.userData.part = part;
      part.meshes.push(m);
    });
    return sub;
  }

  /* ---------------- Розрахунок руху ------------------------------------- */
  solve(state) {
    const ctx = { c: {}, state, spin: state.spin || 0 };
    const sShift = state.steer * SPEC.front.rackStroke;
    ctx.rackShift = sShift;

    for (const k of ['FL', 'FR']) {
      const S = SPEC.front, st = this.kin[k];
      const shift = k === 'FL' ? sShift : -sShift;
      const travel = state.travel[k];
      const r = KIN.stepTo(this.solvers.F, travel, shift, st.x, st);
      st.x = r.x; st.travel = travel; st.shift = shift;
      ctx.c[k] = this._front(k, st, S);
    }
    for (const k of ['RL', 'RR']) {
      const S = SPEC.rear, st = this.kin[k];
      const travel = state.travel[k];
      const r = KIN.stepTo(this.solvers.R, travel, 0, st.x, st);
      st.x = r.x; st.travel = travel; st.shift = 0;
      ctx.c[k] = this._rear(k, st, S);
    }
    return ctx;
  }

  _pose(x, c) {
    const rv = V3(x[3], x[4], x[5]), ang = rv.length();
    const R = ang < 1e-12 ? new THREE.Matrix4() : new THREE.Matrix4().makeRotationAxis(rv.clone().normalize(), ang);
    const t1 = new THREE.Matrix4().makeTranslation(c.x + x[0], c.y + x[1], c.z + x[2]);
    const t0 = new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z);
    return t1.multiply(R).multiply(t0);
  }

  _front(k, st, S) {
    const C = AV(S.C), cc = { frame: k };
    cc.K = this._pose(st.x, C);
    cc.ang = KIN.angles(st.x);
    const P = n => AV(S[n]);
    const B0 = P('B'), P1 = P('P1'), P2 = P('P2'), U = P('U'), A0 = P('A'), T0 = P('T'), R0 = P('R');
    // нижній важіль: обертання навколо осі P1–P2
    const axis = P2.clone().sub(P1).normalize();
    const B1 = B0.clone().applyMatrix4(cc.K);
    const u0 = B0.clone().sub(P1), u1 = B1.clone().sub(P1);
    u0.addScaledVector(axis, -u0.dot(axis)); u1.addScaledVector(axis, -u1.dot(axis));
    const psi = Math.atan2(axis.dot(new THREE.Vector3().crossVectors(u0, u1)), u0.dot(u1));
    cc.arm = G.rotAbout(P1, axis, psi);
    cc.armAng = psi;
    // рульова тяга
    const Rn = R0.clone(); Rn.x += st.shift;
    cc.Rn = Rn;
    cc.Tn = T0.clone().applyMatrix4(cc.K);
    cc.tie = G.rigidSeg(R0, T0, Rn, cc.Tn);
    // стійка
    cc.An = A0.clone().applyMatrix4(cc.K);
    cc.U = U;
    cc.strutDir = U.clone().sub(cc.An).normalize();
    cc.strutLen = U.distanceTo(cc.An);
    cc.strutLen0 = U.distanceTo(A0);
    // стабілізатор
    const Lb0 = P('Lb'), Ls0 = P('Ls');
    cc.Ls = Ls0.clone().applyMatrix4(cc.K);
    const link = Ls0.distanceTo(Lb0);
    st.phi = KIN.barAngle([S.barY, S.barZ], [Lb0.x, Lb0.y, Lb0.z], [cc.Ls.x, cc.Ls.y, cc.Ls.z], link, st.phi);
    cc.phi = st.phi;
    cc.barM = G.rotAbout(V3(0, S.barY, S.barZ), V3(1, 0, 0), st.phi);
    cc.Lb = Lb0.clone().applyMatrix4(cc.barM);
    cc.link = G.rigidSeg(Lb0, Ls0, cc.Lb, cc.Ls);
    // привід
    cc.Oc = AV(S.Oc).applyMatrix4(cc.K);
    cc.Pin = AV(S.Pin);
    cc.C = C.clone().applyMatrix4(cc.K);
    return cc;
  }

  _rear(k, st, S) {
    const C = AV(S.C), cc = { frame: k };
    cc.K = this._pose(st.x, C);
    cc.ang = KIN.angles(st.x);
    const P = n => AV(S[n]);
    const mk = (pn, qn) => {
      const p = P(pn), q0 = P(qn), q1 = q0.clone().applyMatrix4(cc.K);
      return G.rigidSeg(p, q0, p, q1);
    };
    cc.up = mk('Pu', 'Qu'); cc.l1 = mk('P1', 'Q1'); cc.l2 = mk('P2', 'Q2'); cc.tr = mk('Pt', 'Qt');
    // амортизатор (тяга між верхом на кузові та низом на кулаку)
    cc.Sb = P('Sb').applyMatrix4(cc.K); cc.St = P('St');
    // пружина: низ — на нижньому важелі №2
    cc.SpB = P('SpB').applyMatrix4(cc.l2); cc.SpT = P('SpT');
    // стабілізатор: низ стійки — на важелі №2
    const Lb0 = P('Lb'), Ls0 = P('Ls');
    cc.Ls = Ls0.clone().applyMatrix4(cc.l2);
    const link = Ls0.distanceTo(Lb0);
    st.phi = KIN.barAngle([S.barY, S.barZ], [Lb0.x, Lb0.y, Lb0.z], [cc.Ls.x, cc.Ls.y, cc.Ls.z], link, st.phi);
    cc.phi = st.phi;
    cc.barM = G.rotAbout(V3(0, S.barY, S.barZ), V3(1, 0, 0), st.phi);
    cc.Lb = Lb0.clone().applyMatrix4(cc.barM);
    cc.link = G.rigidSeg(Lb0, Ls0, cc.Lb, cc.Ls);
    cc.Oc = AV(S.Oc).applyMatrix4(cc.K);
    cc.Pin = AV(S.Pin);
    cc.C = C.clone().applyMatrix4(cc.K);
    return cc;
  }

  /* ---------------- Застосування матриць -------------------------------- */
  update(state) {
    const key = ['FL', 'FR', 'RL', 'RR'].map(k => state.travel[k]).join(',') + '|' + state.steer;
    const ex = state.explode || 0;
    const spinOnly = !!this.ctx && key === this._key && ex === this._ex;
    this._key = key; this._ex = ex;
    let ctx;
    if (spinOnly) { ctx = this.ctx; ctx.spin = state.spin || 0; } else { ctx = this.ctx = this.solve(state); }
    const tmp = new THREE.Matrix4(), off = new THREE.Matrix4();
    for (const s of this.subs) {
      if (spinOnly && !s.spin) continue;
      const cc = ctx.c[s.frame];
      let M = s.fn ? s.fn(ctx, cc, s) : _I;
      s._M = M;
      let m = tmp.copy(M);
      if (s.spin) m.multiply(G.rotAbout(s.spin.C, V3(1, 0, 0), ctx.spin * s.spinDir));
      if (ex > 0) { off.makeTranslation(s.ex.x * ex, s.ex.y * ex, s.ex.z * ex); m.premultiply(off); }
      s.obj.matrix.copy(m);
      s.obj.matrixWorldNeedsUpdate = true;
    }
    return ctx;
  }
}
