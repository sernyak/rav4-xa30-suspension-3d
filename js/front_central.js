/* ============================================================================
   FRONT_CENTRAL — вузли, спільні для обох коліс передньої осі:
   підрамник, рульова рейка, рульовий вал і колонка, стабілізатор.
   ========================================================================== */

function buildFrontCentral(car) {
  const S = SPEC.front;
  const X = V3(1, 0, 0), Z = V3(0, 0, 1);
  const zf = 1.585;                          // передня грань переднього поперечини підрамника

  /* ---------------- Підрамник ---------------- */
  {
    const pb = new PB(), m = M.steelPaint;
    const yB = 0.262;
    // поперечини і лонжерони (коробчастий переріз)
    pb.add(G.box(V3(0, yB, 1.55), [1.10, 0.05, 0.07]), m);                          // передня
    pb.add(G.box(V3(0, 0.245, 1.03), [1.10, 0.06, 0.07]), m);                       // задня
    for (const s of [-1, 1]) {
      pb.add(G.box(V3(s * 0.50, 0.262, 1.29), [0.08, 0.06, 0.58]), m);               // бічні лонжерони
      // кутові косинки
      pb.add(G.box(V3(s * 0.43, 0.262, 1.50), [0.10, 0.044, 0.07]), m);
      pb.add(G.box(V3(s * 0.43, 0.248, 1.07), [0.10, 0.044, 0.07]), m);
      // вушка під стабілізатор: стійки на передній поперечині
      pb.add(G.box(V3(s * 0.30, 0.31, zf + 0.004), [0.070, 0.15, 0.008]), m);
    }
    // вушка (вилки) кріплення нижніх важелів
    for (const s of [-1, 1]) {
      const sx = (P) => s * P[0];
      const P1 = SPEC.front.P1, P2 = SPEC.front.P2;
      for (const q of [-1, 1]) {
        pb.add(G.box(V3(sx([0.445]), P1[1] + 0.0, P1[2] + q * 0.054), [0.115, 0.10, 0.008]), m);
        pb.add(G.box(V3(sx([0.460]), P2[1] + 0.0, P2[2] + q * 0.0645), [0.115, 0.10, 0.008]), m);
      }
    }
    // опора для крил рейки на задній поперечині
    for (const s of [-1, 1]) pb.add(G.box(V3(s * 0.17, 0.288, 1.07), [0.06, 0.03, 0.05]), m);
    car.add('f_subframe', 'W', pb.build(), {});
  }
  {
    // кріплення підрамника до кузова (гумові подушки + болти)
    const pb = new PB();
    for (const s of [-1, 1]) for (const z of [1.55, 1.03]) {
      const p = V3(s * 0.50, 0.292, z);
      pb.add(G.cyl(p, p.clone().add(V3(0, 0.035, 0)), 0.034, 0.034, 24), M.rubber);
      pb.add(G.cyl(p.clone().add(V3(0, 0.005, 0)), p.clone().add(V3(0, 0.020, 0)), 0.040, 0.040, 24), M.steel);
      pb.add(G.cyl(p.clone().add(V3(0, -0.03, 0)), p.clone().add(V3(0, 0.07, 0)), 0.0085, 0.0085, 12), M.zinc);
      pb.add(G.hex(p.clone().add(V3(0, -0.04, 0)), V3(0, 1, 0), 0.022, 0.012), M.zinc);
    }
    car.add('f_subMounts', 'W', pb.build(), {});
  }

  /* ---------------- Рульова рейка ---------------- */
  const ry = S.rackY, rz = S.rackZ;
  const pin0 = V3(0.13, ry, rz), pdir = V3(0, 0.92, -0.39).normalize();
  const pinTip = pin0.clone().addScaledVector(pdir, 0.12);
  {
    const pb = new PB();
    // корпус рейки
    pb.add(G.cyl(V3(-0.255, ry, rz), V3(0.255, ry, rz), 0.0325, 0.0325, 32), M.alu);
    pb.add(G.cyl(V3(-0.262, ry, rz), V3(-0.245, ry, rz), 0.0345, 0.0345, 32), M.steelDark);
    pb.add(G.cyl(V3(0.245, ry, rz), V3(0.262, ry, rz), 0.0345, 0.0345, 32), M.steelDark);
    // корпус шестірні
    pb.add(G.cyl(pin0, pinTip, 0.0285, 0.0225, 24), M.alu);
    pb.add(G.cyl(pinTip, pinTip.clone().addScaledVector(pdir, 0.030), 0.0145, 0.0145, 18), M.steelDark);
    pb.add(G.cyl(pinTip.clone().addScaledVector(pdir, 0.024), pinTip.clone().addScaledVector(pdir, 0.062), 0.0075, 0.0075, 14), M.steel);
    // хомути кріплення рейки (гумова втулка + скоба + ніжки до підрамника)
    for (const s of [-1, 1]) {
      const c0 = V3(s * 0.17, ry, rz);
      pb.add(G.lathe([[0.0325, -0.022], [0.0405, -0.022], [0.0405, 0.022], [0.0325, 0.022], [0.0325, -0.022]], { c: c0, dir: X, seg: 28 }), M.rubber);
      pb.add(G.lathe([[0.0405, -0.018], [0.0435, -0.018], [0.0435, 0.018], [0.0405, 0.018], [0.0405, -0.018]], { c: c0, dir: X, seg: 28, sweep: [0, PI] }), M.steelPaint);
      pb.add(G.box(V3(s * 0.17, ry - 0.0415 - 0.012, rz), [0.045, 0.024, 0.07]), M.steelPaint);
    }
    car.add('f_rack', 'W', pb.build(), {});
    // рейка (зубчастий шток), що рухається при повороті керма
    const g = new PB();
    g.add(G.cyl(V3(-0.300, ry, rz), V3(0.300, ry, rz), 0.0115, 0.0115, 22), M.steel);
    g.add(G.cyl(V3(0.050, ry, rz), V3(0.210, ry, rz), 0.0130, 0.0130, 22), M.steelDark);
    for (let k = 0; k < 15; k++) {                 // зуби (зона зачеплення з шестірнею)
      g.add(G.box(V3(0.057 + 0.0105 * k, ry + 0.012, rz - 0.004), [0.005, 0.006, 0.020]), M.steel);
    }
    car.add('f_rack', 'W', g.build(), { fn: ctx => new THREE.Matrix4().makeTranslation(ctx.rackShift, 0, 0) });
  }

  /* ---------------- Пильовики рейки (змінна довжина) ---------------- */
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(G.bellows(0.0345, 0.0185, 6, 0.0050, 28), M.rubberBoot));
    g.add(new THREE.Mesh(G.cyl(V3(0, -0.004, 0), V3(0, 0.006, 0), 0.0352, 0.0352, 24), M.steel));
    car.add('f_rackBoot', 'W', g, {
      fn: ctx => {
        const a = V3(s * 0.250, ry, rz), b = V3(s * (S.R[0]) + ctx.rackShift - s * 0.014, ry, rz);
        return spanMat(a, b);
      }
    });
  }

  /* ---------------- Рульовий вал (проміжний) ---------------- */
  const J1 = pinTip.clone().addScaledVector(pdir, 0.062 + 0.0), J2 = V3(0.325, 0.645, 0.86);
  const L0 = V3(0.340, 0.660, 0.840), W0 = V3(0.360, 0.830, 0.620);
  {
    const pb = new PB();
    const dir = J2.clone().sub(J1).normalize(), len = J1.distanceTo(J2);
    const e = (h) => J1.clone().addScaledVector(dir, h);
    pb.add(G.cyl(e(0.020), e(len * 0.55), 0.0125, 0.0125, 18), M.steel);
    pb.add(G.cyl(e(len * 0.45), e(len - 0.020), 0.0095, 0.0095, 18), M.steelDark);
    for (const [P, sg] of [[J1, 1], [J2, -1]]) {
      // хрестовина + вилки
      pb.add(G.sphere(P, 0.0155, 14), M.steelDark);
      const side = new THREE.Vector3().crossVectors(dir, X).normalize();
      for (const q of [-1, 1]) {
        pb.add(G.box(P.clone().addScaledVector(side, q * 0.018), [0.007, 0.030, 0.034], X, dir, side), M.steel);
        pb.add(G.box(P.clone().addScaledVector(X, q * 0.018), [0.007, 0.030, 0.034], side, dir, X), M.steel);
      }
      pb.add(G.cyl(P.clone().addScaledVector(side, -0.022), P.clone().addScaledVector(side, 0.022), 0.0045, 0.0045, 10), M.zinc);
      pb.add(G.cyl(P.clone().addScaledVector(X, -0.022), P.clone().addScaledVector(X, 0.022), 0.0045, 0.0045, 10), M.zinc);
    }
    pb.add(G.cyl(J2, J2.clone().addScaledVector(dir, 0.020), 0.0105, 0.0105, 14), M.steel);
    car.add('f_steerShaft', 'W', pb.build(), {});
  }

  /* ---------------- Рульова колонка з електропідсилювачем + кермо ---------------- */
  {
    const cdir = W0.clone().sub(L0).normalize();
    const pb = new PB();
    pb.add(G.cyl(L0, W0.clone().addScaledVector(cdir, -0.03), 0.0215, 0.0215, 24), M.steelDark);
    pb.add(G.cyl(L0.clone().addScaledVector(cdir, 0.09), W0.clone().addScaledVector(cdir, -0.03), 0.0345, 0.0310, 24), M.plastic);   // кожух
    // блок EPS: редуктор + електродвигун
    const ep = L0.clone().addScaledVector(cdir, 0.055);
    pb.add(G.cyl(ep.clone().addScaledVector(cdir, -0.040), ep.clone().addScaledVector(cdir, 0.040), 0.032, 0.032, 24), M.alu);
    const side = new THREE.Vector3().crossVectors(cdir, X).normalize();
    pb.add(G.cyl(ep, ep.clone().addScaledVector(side, 0.115), 0.027, 0.027, 22), M.steelDark);
    pb.add(G.cyl(ep.clone().addScaledVector(side, 0.115), ep.clone().addScaledVector(side, 0.128), 0.020, 0.020, 18), M.plastic);
    car.add('f_steerWheel', 'W', pb.build(), {});

    const wheelC = W0.clone().addScaledVector(cdir, 0.010);
    const wb = new PB();
    const a1 = new THREE.Vector3().crossVectors(cdir, UPV).normalize(), a2 = new THREE.Vector3().crossVectors(a1, cdir).normalize();
    wb.add(G.torus(wheelC, cdir, 0.185, 0.0165, 56, 12), M.plastic);
    wb.add(G.cyl(wheelC.clone().addScaledVector(cdir, -0.010), wheelC.clone().addScaledVector(cdir, 0.020), 0.050, 0.044, 28), M.plastic);
    for (const ang of [0, TAU / 3 + 0.3, 2 * TAU / 3 - 0.3]) {
      const dirS = a1.clone().multiplyScalar(Math.cos(ang + PI / 2)).addScaledVector(a2, Math.sin(ang + PI / 2));
      wb.add(G.beam(wheelC.clone().addScaledVector(dirS, 0.04), wheelC.clone().addScaledVector(dirS, 0.175), 0.032, 0.014, cdir), M.plastic);
    }
    wb.add(G.cyl(wheelC.clone().addScaledVector(cdir, 0.02), wheelC.clone().addScaledVector(cdir, 0.024), 0.030, 0.030, 24), M.alu);
    car.add('f_steerWheel', 'W', wb.build(), { fn: ctx => G.rotAbout(W0, cdir, -ctx.rackShift / 0.047 * TAU) });
  }

  /* ---------------- Стабілізатор поперечної стійкості ---------------- */
  const by = S.barY, bz = S.barZ, Rb = 0.0115;
  {
    // середня (пряма) частина — закручується між втулками
    const pb = new PB();
    pb.add(G.cyl(V3(-0.43, by, bz), V3(0.43, by, bz), Rb, Rb, 20), M.steelDark);
    car.add('f_swayBar', 'W', pb.build(), { key: 'f_swayBar' });
    // плечі лівого й правого боку — повертаються навколо осі стабілізатора
    for (const fr of ['FL', 'FR']) {
      const pa = new PB();
      const path = [V3(0.42, by, bz), V3(S.Lb[0], by, bz), V3(S.Lb[0], S.Lb[1], S.Lb[2] + 0.02)];
      pa.add(G.tube(path, Rb, { fillet: 0.050, radial: 14, caps: false }), M.steelDark);
      // сплющений кінець під палець стійки
      pa.add(G.box(V3(S.Lb[0], S.Lb[1], S.Lb[2]), [0.014, 0.034, 0.040]), M.steelDark);
      pa.add(G.cyl(V3(S.Lb[0], S.Lb[1], S.Lb[2] + 0.02), V3(S.Lb[0], S.Lb[1], S.Lb[2] + 0.014), Rb, Rb * 1.1, 14), M.steelDark);
      car.add('f_swayBar', fr, pa.build(), { key: 'f_swayBar', fn: (ctx, cc) => cc.barM });
    }
  }
  {
    // гумові втулки + омегоподібні скоби
    const pb = new PB();
    for (const s of [-1, 1]) {
      const cx = s * 0.30, c0 = V3(cx, by, bz);
      pb.add(G.lathe([[Rb, -0.026], [0.0205, -0.026], [0.0205, 0.026], [Rb, 0.026], [Rb, -0.026]], { c: c0, dir: X, seg: 28 }), M.rubber);
      pb.add(G.lathe([[0.0205, -0.022], [0.0235, -0.022], [0.0235, 0.022], [0.0205, 0.022], [0.0205, -0.022]], { c: c0, dir: X, seg: 28, sweep: phiRange(0, PI) }), M.steelPaint);
      // полки скоби вгору/вниз і до стійки на поперечині
      for (const q of [-1, 1]) {
        pb.add(G.box(V3(cx, by + q * 0.0235, (bz + zf + 0.004) / 2), [0.044, 0.003, bz - zf - 0.004]), M.steelPaint);
        const hy = by + q * 0.0235 + q * 0.0, hz = zf + 0.0085;
        pb.add(G.box(V3(cx, by + q * 0.037, zf + 0.0095), [0.044, 0.026, 0.0035]), M.steelPaint);
        pb.add(G.hex(V3(cx, by + q * 0.037, zf + 0.0160), Z, 0.014, 0.0080), M.zinc);
        pb.add(G.cyl(V3(cx, by + q * 0.037, zf + 0.0160), V3(cx, by + q * 0.037, zf - 0.020), 0.0045, 0.0045, 10), M.zinc);
      }
    }
    car.add('f_swayBush', 'W', pb.build(), {});
  }
  car.steerPts = { J1, J2, L0, W0, pinTip };
}
