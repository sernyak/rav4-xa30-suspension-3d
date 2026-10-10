/* ============================================================================
   REAR_CENTRAL — задній підрамник, редуктор AWD, карданний вал, стабілізатор,
   кронштейни кузова.
   ========================================================================== */

function buildRearCentral(car) {
  const S = SPEC.rear, X = V3(1, 0, 0), Z = V3(0, 0, 1);

  /* ---------------- Задній підрамник ---------------- */
  {
    const pb = new PB(), m = M.steelPaint;
    pb.add(G.box(V3(0, 0.25, -0.99), [0.62, 0.06, 0.07]), m);
    pb.add(G.box(V3(0, 0.25, -1.61), [0.62, 0.06, 0.07]), m);
    for (const s of [-1, 1]) {
      pb.add(G.box(V3(s * 0.26, 0.25, -1.30), [0.07, 0.06, 0.66]), m);
      // вилки кріплення нижніх важелів №1 і №2
      for (const P of [S.P1, S.P2]) for (const q of [-1, 1])
        pb.add(G.box(V3(s * 0.3475, P[1], P[2] + q * 0.0585), [0.105, 0.10, 0.008]), m);
      // ніжки-кронштейни під діфлектор і кріплення до кузова
      pb.add(G.box(V3(s * 0.26, 0.285, -1.30), [0.10, 0.012, 0.18]), m);
    }
    car.add('r_subframe', 'W', pb.build(), {});
    const mt = new PB();
    for (const s of [-1, 1]) for (const z of [-0.99, -1.61]) {
      const p = V3(s * 0.26, 0.280, z);
      mt.add(G.cyl(p, p.clone().add(V3(0, 0.035, 0)), 0.032, 0.032, 22), M.rubber);
      mt.add(G.cyl(p.clone().add(V3(0, 0.004, 0)), p.clone().add(V3(0, 0.018, 0)), 0.038, 0.038, 22), M.steel);
      mt.add(G.cyl(p.clone().add(V3(0, -0.03, 0)), p.clone().add(V3(0, 0.07, 0)), 0.008, 0.008, 12), M.zinc);
      mt.add(G.hex(p.clone().add(V3(0, -0.04, 0)), UPV, 0.020, 0.012), M.zinc);
    }
    car.add('r_subMounts', 'W', mt.build(), {});
  }

  /* ---------------- Задній редуктор (муфта AWD) ---------------- */
  {
    const pb = new PB(), c = V3(0, 0.335, -1.33);
    pb.add(G.latheX([[0, -0.145], [0.100, -0.145], [0.122, -0.115], [0.122, 0.115], [0.100, 0.145], [0, 0.145], [0, -0.145]], c, { seg: 56 }), M.aluDark);   // корпус диференціала
    // кришка ззаду
    pb.add(G.lathe([[0, 0.0], [0.100, 0.0], [0.108, 0.020], [0.100, 0.045], [0.060, 0.062], [0, 0.066]], { c: c.clone().add(V3(0, 0, -0.050)), dir: V3(0, 0, -1), seg: 44 }), M.alu);
    // носик шестірні (вхід) спереду
    pb.add(G.lathe([[0, 0], [0.058, 0], [0.058, 0.060], [0.044, 0.075], [0, 0.075]], { c: c.clone().add(V3(0, 0, 0.060)), dir: Z, seg: 36 }), M.aluDark);
    pb.add(G.lathe([[0.012, 0.075], [0.056, 0.075], [0.056, 0.083], [0.012, 0.083]], { c: c.clone().add(V3(0, 0, 0.060)), dir: Z, seg: 36 }), M.steelDark);   // фланець
    // стаканчики півосей
    for (const s of [-1, 1]) {
      pb.add(G.cyl(V3(s * 0.130, 0.335, -1.33), V3(s * 0.205, 0.335, -1.33), 0.046, 0.040, 28), M.aluDark);
      for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; pb.add(G.hex(c.clone().add(V3(s * 0.138, 0.095 * Math.cos(a), 0.095 * Math.sin(a))), X, 0.014, 0.009), M.zinc); }
    }
    // ребра охолодження
    for (let k = -4; k <= 4; k++) pb.add(G.box(c.clone().add(V3(k * 0.026, 0.118, 0)), [0.006, 0.014, 0.16]), M.aluDark);
    // кріпильні лапи до підрамника
    for (const s of [-1, 1]) pb.add(G.box(V3(s * 0.085, 0.22, -1.455), [0.060, 0.050, 0.060]), M.aluDark);
    pb.add(G.box(V3(0, 0.22, -1.20), [0.12, 0.050, 0.050]), M.aluDark);
    car.add('r_diff', 'W', pb.build(), {});
  }

  /* ---------------- Карданний вал з проміжною опорою ---------------- */
  {
    const pb = new PB(), y0 = 0.345, y1 = 0.338, zf = 0.985, zc = -0.10, zr = -1.145;
    const P = (z) => V3(0, y0 + (y1 - y0) * (zf - z) / (zf - zr), z);
    pb.add(G.cyl(P(zf - 0.050), P(zc + 0.060), 0.0375, 0.0375, 28), M.steel);
    pb.add(G.cyl(P(zc - 0.060), P(zr + 0.060), 0.0375, 0.0375, 28), M.steel);
    // балансувальні вантажики
    pb.add(G.box(P(-0.55).add(V3(0.0, 0.038, 0)), [0.010, 0.004, 0.030]), M.zinc);
    // шарніри (хрестовини з вилками) на три позиції
    const uj = (z, rot) => {
      const c = P(z);
      pb.add(G.sphere(c, 0.017, 14), M.steelDark);
      for (const q of [-1, 1]) {
        pb.add(G.box(c.clone().add(V3(q * 0.026, 0, 0)), [0.008, 0.050, 0.050]), M.steelDark);
        pb.add(G.box(c.clone().add(V3(0, q * 0.026, 0)), [0.050, 0.008, 0.050]), M.steelDark);
      }
      pb.add(G.cyl(c.clone().add(V3(-0.032, 0, 0)), c.clone().add(V3(0.032, 0, 0)), 0.0065, 0.0065, 10), M.zinc);
      pb.add(G.cyl(c.clone().add(V3(0, -0.032, 0)), c.clone().add(V3(0, 0.032, 0)), 0.0065, 0.0065, 10), M.zinc);
    };
    uj(zf - 0.020); uj(zc); uj(zr + 0.020);
    // фланці на кінцях
    pb.add(G.cyl(P(zf + 0.005), P(zf - 0.015), 0.055, 0.055, 28), M.steelDark);
    pb.add(G.cyl(P(zr - 0.005), P(zr + 0.015), 0.055, 0.055, 28), M.steelDark);
    // проміжна опора: гумове кільце, підшипник і кронштейн до кузова
    const c = P(zc - 0.03);
    pb.add(G.lathe([[0.0375, -0.025], [0.058, -0.025], [0.058, 0.025], [0.0375, 0.025], [0.0375, -0.025]], { c, dir: Z, seg: 36 }), M.rubber);
    pb.add(G.lathe([[0.058, -0.020], [0.063, -0.020], [0.063, 0.020], [0.058, 0.020], [0.058, -0.020]], { c, dir: Z, seg: 36, sweep: phiRange(-PI / 2, PI / 2) }), M.steelPaint);
    for (const s of [-1, 1]) pb.add(G.box(c.clone().add(V3(s * 0.068, 0.045, 0)), [0.008, 0.10, 0.050]), M.steelPaint);
    pb.add(G.box(c.clone().add(V3(0, 0.098, 0)), [0.14, 0.010, 0.07]), M.steelPaint);
    car.add('r_prop', 'W', pb.build(), {});
  }

  /* ---------------- Задній стабілізатор ---------------- */
  const by = S.barY, bz = S.barZ, Rb = 0.0095;
  {
    const pb = new PB();
    pb.add(G.cyl(V3(-0.34, by, bz), V3(0.34, by, bz), Rb, Rb, 18), M.steelDark);
    car.add('r_swayBar', 'W', pb.build(), { key: 'r_swayBar' });
    for (const fr of ['RL', 'RR']) {
      const pa = new PB();
      const path = [V3(0.33, by, bz), V3(S.Lb[0], by, bz), V3(S.Lb[0], S.Lb[1], S.Lb[2] - 0.02)];
      pa.add(G.tube(path, Rb, { fillet: 0.045, radial: 12 }), M.steelDark);
      pa.add(G.box(V3(S.Lb[0], S.Lb[1], S.Lb[2]), [0.014, 0.034, 0.040]), M.steelDark);
      car.add('r_swayBar', fr, pa.build(), { key: 'r_swayBar', fn: (ctx, cc) => cc.barM });
    }
    const bu = new PB();
    for (const s of [-1, 1]) {
      const c0 = V3(s * 0.22, by, bz);
      bu.add(G.lathe([[Rb, -0.024], [0.0185, -0.024], [0.0185, 0.024], [Rb, 0.024], [Rb, -0.024]], { c: c0, dir: X, seg: 26 }), M.rubber);
      bu.add(G.lathe([[0.0185, -0.020], [0.0215, -0.020], [0.0215, 0.020], [0.0185, 0.020], [0.0185, -0.020]], { c: c0, dir: X, seg: 26, sweep: phiRange(-PI / 2, PI / 2) }), M.steelPaint);
      for (const q of [-1, 1]) {
        bu.add(G.box(V3(s * 0.22, by, bz + q * 0.0295), [0.040, 0.003, 0.025]), M.steelPaint);
        bu.add(G.cyl(V3(s * 0.22, by - 0.004, bz + q * 0.034), V3(s * 0.22, by + 0.12, bz + q * 0.034), 0.0045, 0.0045, 10), M.zinc);
      }
    }
    car.add('r_swayBush', 'W', bu.build(), {});
  }

  /* ---------------- Кронштейни кузова (для кожного боку) ---------------- */
  for (const fr of ['RL', 'RR']) {
    const pb = new PB(), m = M.steelPaint;
    // верхній важіль: підвісний кронштейн під днищем
    for (const q of [-1, 1]) pb.add(G.box(V3(0.34, 0.560, S.Pu[2] + q * 0.0585), [0.100, 0.170, 0.008]), m);
    pb.add(G.box(V3(0.34, 0.650, S.Pu[2]), [0.15, 0.010, 0.18]), m);
    // поздовжній важіль: передній кронштейн
    for (const q of [-1, 1]) pb.add(G.box(V3(S.Pt[0] + q * 0.0585, 0.370, S.Pt[2]), [0.008, 0.150, 0.090]), m);
    pb.add(G.box(V3(S.Pt[0], 0.447, S.Pt[2]), [0.140, 0.010, 0.120]), m);
    // стакан верхньої опори амортизатора
    const sd = AV(S.St).sub(AV(S.Sb)).normalize(), St = AV(S.St);
    pb.add(G.lathe([[0.012, 0.0], [0.070, 0.0], [0.074, 0.008], [0.074, 0.016], [0.012, 0.016]], { c: St.clone().addScaledVector(sd, 0.004), dir: sd, seg: 36 }), m);
    // стакан пружини в кузові
    const SpT = AV(S.SpT);
    pb.add(G.lathe([[0.0, 0.0], [0.092, 0.0], [0.096, 0.010], [0.096, 0.020], [0.0, 0.020]], { c: SpT.clone().add(V3(0, 0.008, 0)), dir: UPV, seg: 40 }), m);
    car.add('r_bodyBracket', fr, pb.build(), {});
  }
}
