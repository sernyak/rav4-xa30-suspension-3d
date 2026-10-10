/* ============================================================================
   REAR — задня підвіска: подвійні поперечні важелі (верхній + два нижні) +
   поздовжній важіль, окремі пружина й амортизатор (лівий кут; правий — дзеркало).
   ========================================================================== */

/* Обойма (зварена втулка) під сайлентблок: порожнистий циліндр уздовж axis */
function eyePB(pb, P, axis, ri, ro, len, mat) {
  pb.add(G.lathe([[ri, 0], [ro, 0], [ro, len], [ri, len], [ri, 0]], { c: P.clone().addScaledVector(axis, -len / 2), dir: axis, seg: 32 }), mat);
}

/* Сайлентблок з болтом: гума, внутрішня втулка, болт, гайка (+ ексцентрик) */
function bushPB(P, axis, o = {}) {
  const pb = new PB(), a = h => P.clone().addScaledVector(axis, h);
  const rIn = o.rIn || 0.0165, rOut = o.rOut || 0.029, len = o.len || 0.075, rs = o.rs || 0.0085;
  pb.add(G.lathe([[rIn, -len / 2], [rOut, -len / 2], [rOut, len / 2], [rIn, len / 2], [rIn, -len / 2]], { c: P, dir: axis, seg: 32 }), M.rubber);
  pb.add(G.lathe([[rs, -len / 2 - 0.012], [rIn, -len / 2 - 0.012], [rIn, len / 2 + 0.012], [rs, len / 2 + 0.012], [rs, -len / 2 - 0.012]], { c: P, dir: axis, seg: 28 }), M.steel);
  boltPB(pb, a(-len / 2 - 0.034), axis, len + 0.075, 0.0072, 0.021, 0.009);
  nutPB(pb, a(len / 2 + 0.031), axis, 0.021, 0.012);
  if (o.cam) {
    // ексцентрикові шайби для регулювання кутів встановлення
    for (const h of [-len / 2 - 0.017, len / 2 + 0.017]) {
      pb.add(G.cyl(a(h - 0.003), a(h + 0.003), 0.0235, 0.0235, 24), M.zinc);
      const t = new THREE.Vector3().crossVectors(axis, UPV).normalize();
      pb.add(G.box(a(h).addScaledVector(t, 0.026), [0.008, 0.008, 0.006], t, UPV, axis), M.zinc);
    }
  }
  return pb.build();
}

function buildRear(car, side) {
  const fr = 'R' + side;
  const S = SPEC.rear, cfg = WE.r;
  const C = AV(S.C), Qu = AV(S.Qu), Q1 = AV(S.Q1), Q2 = AV(S.Q2), Qt = AV(S.Qt);
  const Pu = AV(S.Pu), P1 = AV(S.P1), P2 = AV(S.P2), Pt = AV(S.Pt);
  const Sb = AV(S.Sb), St = AV(S.St), SpB = AV(S.SpB), SpT = AV(S.SpT);
  const Lb = AV(S.Lb), Ls = AV(S.Ls);
  const K = (ctx, cc) => cc.K;
  const Zv = V3(0, 0, 1), Xv = V3(1, 0, 0);
  const F = wheelFrame(C, cfg.thC);

  addWheelEnd(car, fr, cfg, S);
  buildCV(car, fr, S, 'r');

  /* ---------------- Поворотний кулак (цапфа) ---------------- */
  {
    const pb = new PB(), m = M.cast;
    pb.add(G.latheX([[0.0475, -0.040], [0.066, -0.040], [0.066, -0.008], [0.0475, -0.008], [0.0475, -0.040]], C, { seg: 48 }), m);
    pb.add(G.latheX([[0.066, -0.040], [0.080, -0.040], [0.080, -0.026], [0.066, -0.026], [0.066, -0.040]], C, { seg: 48 }), m);
    const arm = (from, to, w, h, ref) => { pb.add(G.beam(from, to, w, h, ref), m); pb.add(G.sphere(from, Math.max(w, h) * 0.55, 12), m); };
    // «спиці» цапфи до точок кріплення важелів
    arm(V3(C.x - 0.040, C.y + 0.050, C.z + 0.000), Qu, 0.052, 0.040, Zv);
    arm(V3(C.x - 0.040, C.y - 0.050, C.z + 0.030), Q1, 0.052, 0.040, Zv);
    arm(V3(C.x - 0.040, C.y - 0.050, C.z - 0.040), Q2, 0.052, 0.040, Zv);
    arm(V3(C.x - 0.040, C.y - 0.060, C.z - 0.010), Qt, 0.044, 0.040, Zv);
    arm(V3(C.x - 0.040, C.y - 0.020, C.z - 0.055), Sb, 0.046, 0.036, UPV);
    // вилки (ушка) під болти важелів: Z-вісь (пластини спереду/ззаду) або X-вісь
    const forkZ = Q => { for (const q of [-1, 1]) pb.add(G.box(Q.clone().add(V3(0.012, 0, q * 0.0585)), [0.060, 0.065, 0.008]), m); };
    forkZ(Qu); forkZ(Q1); forkZ(Q2);
    for (const q of [-1, 1]) pb.add(G.box(Qt.clone().add(V3(q * 0.0585, 0, 0)), [0.008, 0.060, 0.060]), m);
    for (const q of [-1, 1]) pb.add(G.box(Sb.clone().add(V3(0.014, 0, q * 0.0335)), [0.060, 0.060, 0.008]), m);
    // лапи під скобу суппорта
    for (const s of [-1, 1]) pb.add(wbox(F, -0.0255, 0.074, s * 0.052, 0.030, 0.040, 0.034), m);
    // стійка датчика ABS
    pb.add(G.cyl(polar(C, -0.040, 0.062, cfg.sensorTh), polar(C, -0.084, 0.058, cfg.sensorTh), 0.011, 0.011, 14), m);
    car.add('r_knuckle', fr, pb.build(), { fn: K });
  }

  /* ---------------- Важелі ---------------- */
  const armPB = (Pin, Qout, ax, w, h, mat, o = {}) => {
    const pb = new PB();
    const dirA = Qout.clone().sub(Pin).normalize();
    pb.add(G.beam(Pin, Qout, w, h, Zv), mat);
    // ребро жорсткості (верхній борт)
    pb.add(G.beam(Pin.clone().add(V3(0, h * 0.5, 0)), Qout.clone().add(V3(0, h * 0.5, 0)), w * 0.55, 0.008, Zv), mat);
    eyePB(pb, Pin, ax.i || ax, 0.0295, 0.0355, ax.il || 0.078, mat);
    eyePB(pb, Qout, ax.o || ax, 0.0295, 0.0355, ax.ol || 0.078, mat);
    if (o.extra) o.extra(pb);
    return pb.build();
  };
  const zi = { i: Zv, o: Zv, il: 0.078, ol: 0.078 };
  car.add('r_upper', fr, armPB(Pu, Qu, zi, 0.052, 0.026, M.steelPaint), { fn: (ctx, cc) => cc.up });
  car.add('r_lower1', fr, armPB(P1, Q1, zi, 0.060, 0.030, M.steelPaint), { fn: (ctx, cc) => cc.l1 });
  car.add('r_lower2', fr, armPB(P2, Q2, zi, 0.060, 0.030, M.steelPaint, {
    extra: pb => {
      // опора пружини (чашка) і кронштейн під стабілізатор
      pb.add(G.lathe([[0.0, -0.016], [0.074, -0.016], [0.078, -0.010], [0.078, 0.004], [0.070, 0.004], [0.0, 0.0]], { c: SpB, dir: UPV, seg: 40 }), M.steelPaint);
      pb.add(G.lathe([[0.0, 0.0], [0.062, 0.0], [0.062, 0.006], [0.0, 0.006]], { c: SpB, dir: UPV, seg: 36 }), M.rubber);
      pb.add(G.box(Ls.clone().add(V3(0, -0.020, 0)), [0.040, 0.036, 0.020]), M.steelPaint);
    }
  }), { fn: (ctx, cc) => cc.l2 });
  // поздовжній важіль
  {
    const pb = new PB(), mid = Pt.clone().lerp(Qt, 0.55).add(V3(0.035, 0.0, 0)), xi = { i: Xv, o: Xv };
    pb.add(G.beam(Pt, mid, 0.044, 0.036, UPV), M.steelPaint);
    pb.add(G.beam(mid, Qt, 0.044, 0.036, UPV), M.steelPaint);
    pb.add(G.sphere(mid, 0.028, 14), M.steelPaint);
    pb.add(G.beam(Pt.clone().add(V3(0, 0.018, 0)), Qt.clone().add(V3(0, 0.018, 0)), 0.020, 0.008, UPV), M.steelPaint);
    eyePB(pb, Pt, Xv, 0.0295, 0.0355, 0.078, M.steelPaint);
    eyePB(pb, Qt, Xv, 0.0295, 0.0355, 0.078, M.steelPaint);
    car.add('r_trail', fr, pb.build(), { fn: (ctx, cc) => cc.tr });
  }
  // сайлентблоки: у кожному з 8 кріплень
  car.add('r_bushUpIn', fr, bushPB(Pu, Zv, { cam: true }), { fn: (ctx, cc) => cc.up });
  car.add('r_bushUpOut', fr, bushPB(Qu, Zv, {}), { fn: (ctx, cc) => cc.up });
  car.add('r_bushL1In', fr, bushPB(P1, Zv, { cam: true }), { fn: (ctx, cc) => cc.l1 });
  car.add('r_bushL1Out', fr, bushPB(Q1, Zv, {}), { fn: (ctx, cc) => cc.l1 });
  car.add('r_bushL2In', fr, bushPB(P2, Zv, { cam: true }), { fn: (ctx, cc) => cc.l2 });
  car.add('r_bushL2Out', fr, bushPB(Q2, Zv, {}), { fn: (ctx, cc) => cc.l2 });
  car.add('r_bushTrIn', fr, bushPB(Pt, Xv, { rOut: 0.0295, len: 0.078 }), { fn: (ctx, cc) => cc.tr });
  car.add('r_bushTrOut', fr, bushPB(Qt, Xv, { rOut: 0.0295, len: 0.078 }), { fn: (ctx, cc) => cc.tr });

  /* ---------------- Амортизатор ---------------- */
  const sdir0 = St.clone().sub(Sb).normalize();
  {
    const pb = new PB(), a = h => Sb.clone().addScaledVector(sdir0, h);
    pb.add(G.cyl(a(0.020), a(0.315), 0.0225, 0.0225, 26), M.steelPaint);
    pb.add(G.cyl(a(0.311), a(0.322), 0.0185, 0.0185, 22), M.steelDark);
    pb.add(G.cyl(Sb.clone().add(V3(0, 0, -0.026)), Sb.clone().add(V3(0, 0, 0.026)), 0.0195, 0.0195, 22), M.steelDark);   // нижнє вушко
    pb.add(G.cyl(Sb.clone().add(V3(0, 0, -0.045)), Sb.clone().add(V3(0, 0, 0.045)), 0.0072, 0.0072, 12), M.zinc);
    boltPB(pb, Sb.clone().add(V3(0, 0, -0.0465)), Zv, 0.105, 0.0072, 0.021, 0.009);
    nutPB(pb, Sb.clone().add(V3(0, 0, 0.0445)), Zv, 0.021, 0.012);
    pb.add(G.cyl(Sb, a(0.030), 0.0195, 0.0225, 22), M.steelPaint);
    car.add('r_shock', fr, pb.build(), { fn: K });
    const g = new THREE.Group();
    g.add(new THREE.Mesh(G.cyl(V3(0, -0.34, 0), V3(0, 0.012, 0), 0.0115, 0.0115, 20), M.alu));
    g.add(new THREE.Mesh(G.cyl(V3(0, -0.34, 0), V3(0, -0.29, 0), 0.0185, 0.0185, 22), M.steelDark));
    g.add(new THREE.Mesh(G.cyl(V3(0, 0.012, 0), V3(0, 0.040, 0), 0.0075, 0.0075, 12), M.steel));
    car.add('r_shock', fr, g, { fn: (ctx, cc) => frameMat(St, St.clone().sub(cc.Sb).normalize()) });
  }
  {
    // захисний кожух + відбійник
    const g = new THREE.Group();
    g.add(new THREE.Mesh(G.lathe([[0.0245, -0.22], [0.0275, -0.22], [0.0275, 0.0], [0.0245, 0.0], [0.0245, -0.22]], { seg: 28 }), M.steelPaint));
    const bump = new THREE.Mesh(G.cyl(V3(0, -0.05, 0), V3(0, 0, 0), 0.0200, 0.0225, 22), M.rubberRed);
    g.add(bump);
    car.add('r_bump', fr, g, { fn: (ctx, cc) => frameMat(St.clone().add(sdir0.clone().multiplyScalar(-0.012)), St.clone().sub(cc.Sb).normalize()) });
  }
  {
    // верхня опора амортизатора (гумові подушки + шайби + гайка) на кузові
    const pb = new PB(), a = h => St.clone().addScaledVector(sdir0, h);
    pb.add(G.lathe([[0.0125, -0.030], [0.032, -0.030], [0.034, -0.024], [0.034, 0.0], [0.0125, 0.0]], { c: St, dir: sdir0, seg: 30 }), M.rubber);
    pb.add(G.lathe([[0.0125, 0.0], [0.040, 0.0], [0.040, 0.004], [0.0125, 0.004]], { c: St, dir: sdir0, seg: 30 }), M.steel);
    pb.add(G.lathe([[0.0125, 0.004], [0.030, 0.004], [0.030, 0.026], [0.0125, 0.026]], { c: St, dir: sdir0, seg: 30 }), M.rubber);
    pb.add(G.hex(a(0.032), sdir0, 0.0175, 0.012), M.zinc);
    car.add('r_shockMount', fr, pb.build(), {});
  }

  /* ---------------- Пружина ---------------- */
  {
    const L0 = SpB.distanceTo(SpT);
    const geo = G.helix({ R: 0.0615, wire: 0.0125, active: 5.6, endTurns: 0.8, L: L0, radial: 8 });
    const grp = new THREE.Group(); grp.add(new THREE.Mesh(geo, M.springPaint));
    car.add('r_spring', fr, grp, {
      fn: (ctx, cc) => {
        const dir = SpT.clone().sub(cc.SpB), L = dir.length() - 0.012 - 0.006;
        geo.userData.update(Math.max(0.12, L));
        dir.normalize();
        return frameMat(cc.SpB.clone().addScaledVector(dir, 0.006), dir);
      }
    });
    // верхня гумова подушка (у кузові)
    const pb = new PB();
    pb.add(G.lathe([[0.020, -0.012], [0.072, -0.012], [0.072, 0.0], [0.020, 0.0], [0.020, -0.012]], { c: SpT, dir: UPV, seg: 40 }), M.rubber);
    pb.add(G.lathe([[0.020, 0.0], [0.080, 0.0], [0.080, 0.008], [0.020, 0.008], [0.020, 0.0]], { c: SpT, dir: UPV, seg: 40 }), M.steelPaint);
    car.add('r_springSeat', fr, pb.build(), {});
  }

  /* ---------------- Стійка стабілізатора ---------------- */
  {
    const pb = new PB(), dl = Ls.clone().sub(Lb).normalize(), top = Ls.distanceTo(Lb);
    pb.add(G.cyl(Lb.clone().addScaledVector(dl, 0.018), Lb.clone().addScaledVector(dl, top - 0.018), 0.0055, 0.0055, 14), M.steel);
    for (const [pos, sg] of [[Lb, 1], [Ls, -1]]) {
      pb.add(G.sphere(pos, 0.0125, 14), M.steelDark);
      pb.add(G.cyl(pos, pos.clone().addScaledVector(dl, sg * 0.040), 0.0120, 0.0100, 16), M.steelDark);
      pb.add(G.cyl(pos.clone().add(V3(-0.024, 0, 0)), pos.clone().add(V3(0.026, 0, 0)), 0.0058, 0.0058, 12), M.steel);
      pb.add(G.hex(pos.clone().add(V3(0.024, 0, 0)), Xv, 0.013, 0.009), M.zinc);
    }
    car.add('r_link', fr, pb.build(), { fn: (ctx, cc) => cc.link });
  }

  /* ---------------- Гальмівний шланг ---------------- */
  {
    const xi = cfg.faceIn - 0.0145 - 0.037;
    const hp = F.at(xi + 0.004, cfg.pistonRad, -0.064);
    const hb = V3(0.600, 0.500, -1.250);
    const grp = makeCable(0.0050, M.hose, 8);
    const fit = new PB();
    fit.add(G.cyl(hb.clone().add(V3(0, -0.012, 0)), hb.clone().add(V3(0, 0.030, 0)), 0.0072, 0.0072, 10), M.brass);
    fit.add(G.box(hb.clone().add(V3(-0.02, 0.02, 0.0)), [0.012, 0.045, 0.028]), M.steelPaint);
    grp.add(fit.build());
    car.add('r_hose', fr, grp, {
      fn: (ctx, cc) => {
        const e = hp.clone().applyMatrix4(cc.K);
        const m1 = hp.clone().add(V3(-0.050, 0.050, 0.028)).applyMatrix4(cc.K);
        const m2 = new THREE.Vector3().lerpVectors(m1, hb, 0.55); m2.y += 0.03;
        grp.userData.rebuild([e, m1, m2, hb.clone().add(V3(0, -0.012, 0))]);
        return _I;
      }
    });
    const bj = new PB();
    bj.add(G.cyl(hp.clone().add(F.td.clone().multiplyScalar(-0.002)), hp.clone().add(F.td.clone().multiplyScalar(0.020)), 0.0068, 0.0068, 12), M.brass);
    bj.add(G.hex(hp.clone().add(F.td.clone().multiplyScalar(-0.006)), F.td, 0.016, 0.008), M.brass);
    car.add('r_hose', fr, bj.build(), { fn: K });
  }

  /* ---------------- Трос стоянкового гальма і кабель ABS ---------------- */
  {
    const a = polar(C, -0.012, 0.075, 0.2), clip = V3(0.560, 0.360, -0.800);
    const grp = makeCable(0.0034, M.steelDark, 6);
    const lever = new PB();
    lever.add(G.box(polar(C, -0.012, 0.081, 0.2), [0.012, 0.030, 0.008]), M.zinc);
    grp.add(lever.build());
    car.add('r_parkCable', fr, grp, {
      fn: (ctx, cc) => {
        const e = a.clone().applyMatrix4(cc.K);
        const m1 = e.clone().add(V3(-0.060, 0.02, 0.050));
        grp.userData.rebuild([e, m1, new THREE.Vector3().lerpVectors(m1, clip, 0.45).add(V3(0, 0.03, 0)), clip]);
        return _I;
      }
    });
    const th = cfg.sensorTh, sa = polar(C, -0.104, 0.0395, th), sclip = V3(0.570, 0.480, -1.200);
    const cab = makeCable(0.0034, M.plastic, 6);
    car.add('r_sensor', fr, cab, {
      fn: (ctx, cc) => {
        const s = sa.clone().applyMatrix4(cc.K);
        const m1 = sa.clone().add(V3(-0.035, 0.030, 0.010)).applyMatrix4(cc.K);
        cab.userData.rebuild([s, m1, new THREE.Vector3().lerpVectors(m1, sclip, 0.6).add(V3(0, 0.02, 0)), sclip]);
        return _I;
      }
    });
  }
}
