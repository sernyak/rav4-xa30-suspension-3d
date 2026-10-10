/* ============================================================================
   FRONT — передня підвіска McPherson (лівий кут; правий — дзеркало).
   ========================================================================== */

/* Загальні деталі колеса, що ставляться на обидві осі */
const _memo = {};
/* Для дзеркального боку геометрія та сама — будуємо один раз і клонуємо (спільні буфери) */
function memoGroup(key, fn) {
  const e = _memo[key];
  if (!e) { const g = fn(); _memo[key] = g.clone(true); return g; }
  return e.clone(true);
}

function addWheelEnd(car, fr, cfg, S) {
  const C = AV(S.C), p = cfg.p;
  const K = (ctx, cc) => cc.K;
  const mk = (name, fn) => memoGroup(p + name, fn);
  car.add(p + '_hub', fr, mk('hubS', () => hubStaticPB(C, cfg)), { fn: K });
  car.add(p + '_hub', fr, mk('hubR', () => hubRotPB(C, cfg)), { fn: K, spin: { C } });
  car.add(p + '_rotor', fr, mk('rotor', () => rotorPB(C, cfg)), { fn: K, spin: { C } });
  car.add(p + '_shield', fr, mk('shield', () => shieldPB(C, cfg)), { fn: K });
  if (p === 'r') car.add('r_parkShoes', fr, mk('shoes', () => parkShoesPB(C)), { fn: K });
  car.add(p + '_bracket', fr, mk('bracket', () => bracketPB(C, cfg)), { fn: K });
  car.add(p + '_caliper', fr, mk('caliper', () => caliperPB(C, cfg)), { fn: K });
  car.add(p + '_piston', fr, mk('piston', () => pistonPB(C, cfg)), { fn: K });
  car.add(p + '_pads', fr, mk('pads', () => padsPB(C, cfg)), { fn: K });
  car.add(p + '_pins', fr, mk('pins', () => pinsPB(C, cfg)), { fn: K });
  car.add(p + '_sensor', fr, mk('sensor', () => sensorPB(C, cfg)), { fn: K });
  car.add(p + '_wheel', fr, mk('wheel', () => wheelPB(C)), { fn: K, spin: { C } });
  car.add(p + '_lugNuts', fr, mk('nuts', () => lugNutsPB(C)), { fn: K, spin: { C } });
  car.add(p + '_tire', fr, mk('tire', () => tirePB(C)), { fn: K, spin: { C } });
}

/* Болт із шестигранною головкою та шайбою: head — позиція головки, dir — у бік гайки */
function boltPB(pb, head, dir, len, r = 0.0065, across = 0.019, headH = 0.008, mat = M.zinc) {
  const d = dir.clone().normalize();
  pb.add(G.hex(head.clone().addScaledVector(d, headH / 2), d, across, headH), mat);
  pb.add(G.cyl(head.clone().addScaledVector(d, headH), head.clone().addScaledVector(d, len), r, r, 10), mat);
}
function nutPB(pb, pos, dir, across = 0.019, h = 0.011, mat = M.zinc) {
  pb.add(G.hex(pos, dir, across, h), mat);
}

/* Динамічний шланг/кабель: перебудовує трубку по ключових точках */
function makeCable(r, mat, radial = 8) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  const grp = new THREE.Group(); grp.add(mesh);
  grp.userData.rebuild = pts => {
    const key = pts.map(p => p.x.toFixed(4) + ',' + p.y.toFixed(4) + ',' + p.z.toFixed(4)).join('|');
    if (key === grp.userData.key) return;
    grp.userData.key = key;
    mesh.geometry.dispose();
    mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'centripetal'), 28, r, radial, false);
  };
  return grp;
}

function buildFront(car, side) {
  const fr = 'F' + side;
  const S = SPEC.front, cfg = WE.f;
  const C = AV(S.C), B = AV(S.B), U = AV(S.U), A = AV(S.A), P1 = AV(S.P1), P2 = AV(S.P2);
  const T = AV(S.T), R = AV(S.R), Lb = AV(S.Lb), Ls = AV(S.Ls);
  const d0 = U.clone().sub(A).normalize();       // вісь стійки
  const kp = U.clone().sub(B).normalize();       // вісь шворня (кульова → верхня опора)
  const K = (ctx, cc) => cc.K;
  const X = V3(1, 0, 0);
  const sAt = s => A.clone().addScaledVector(d0, s);            // точка на осі стійки (проєктне положення)
  const Lstrut0 = U.distanceTo(A);

  addWheelEnd(car, fr, cfg, S);
  buildCV(car, fr, S, 'f');

  /* ---------------- Поворотний кулак ---------------- */
  {
    const pb = new PB(), m = M.cast;
    const F = wheelFrame(C, cfg.thC);
    pb.add(G.latheX([[0.0475, -0.040], [0.066, -0.040], [0.066, 0.012], [0.0475, 0.012], [0.0475, -0.040]], C, { seg: 48 }), m);
    pb.add(G.latheX([[0.066, -0.040], [0.080, -0.040], [0.080, -0.026], [0.066, -0.026], [0.066, -0.040]], C, { seg: 48 }), m);
    // нижня лапа до кульової опори
    const lo0 = V3(C.x - 0.022, C.y - 0.055, C.z + 0.004), lo1 = B.clone().addScaledVector(kp, 0.045);
    pb.add(G.cyl(lo0, lo1, 0.031, 0.027, 20), m);
    pb.add(G.sphere(lo0, 0.031, 14), m);
    pb.add(G.cyl(B.clone().addScaledVector(kp, 0.028), B.clone().addScaledVector(kp, 0.078), 0.029, 0.022, 22), m);
    // верхній міст до хомута амортизатора
    const n0 = V3(C.x - 0.010, C.y + 0.048, C.z), n1 = sAt(0.085).add(V3(0.040, 0, 0));
    pb.add(G.beam(n0, n1, 0.074, 0.052, V3(0, 0, 1)), m);
    pb.add(G.sphere(n0, 0.037, 14), m);
    // хомут-обойма на трубі амортизатора
    pb.add(G.lathe([[0.0275, 0.040], [0.0445, 0.040], [0.0445, 0.140], [0.0275, 0.140], [0.0275, 0.040]], { c: A, dir: d0, seg: 36 }), m);
    // стяжні вушка + болти
    const inb = V3(-1, 0, 0).sub(d0.clone().multiplyScalar(-d0.x)).normalize();
    const zb = new THREE.Vector3().crossVectors(inb, d0).normalize();
    for (const s of [0.065, 0.115]) {
      const P = sAt(s).addScaledVector(inb, 0.050);
      for (const q of [-1, 1]) pb.add(G.box(P.clone().addScaledVector(zb, q * 0.0165), [0.034, 0.036, 0.014], inb, d0, zb), m);
      pb.add(G.cyl(P.clone().addScaledVector(zb, -0.040), P.clone().addScaledVector(zb, 0.040), 0.0065, 0.0065, 10), M.zinc);
      pb.add(G.hex(P.clone().addScaledVector(zb, -0.044), zb, 0.019, 0.008), M.zinc);
      pb.add(G.hex(P.clone().addScaledVector(zb, 0.044), zb, 0.019, 0.011), M.zinc);
    }
    // рульова сошка
    const s0 = V3(C.x - 0.018, C.y - 0.030, C.z - 0.045), s1 = T.clone().add(V3(0.012, -0.004, 0.022));
    pb.add(G.beam(s0, s1, 0.032, 0.046, UPV), m);
    pb.add(G.sphere(s0, 0.025, 12), m);
    pb.add(G.cyl(T.clone().add(V3(0, -0.020, 0)), T.clone().add(V3(0, 0.028, 0)), 0.021, 0.018, 18), m);
    // лапи під скобу суппорта
    for (const s of [-1, 1]) pb.add(wbox(F, -0.0155, 0.078, s * 0.058, 0.030, 0.042, 0.034), m);
    // стійка датчика ABS
    pb.add(G.cyl(polar(C, -0.040, 0.062, cfg.sensorTh), polar(C, -0.084, 0.058, cfg.sensorTh), 0.011, 0.011, 14), m);
    car.add('f_knuckle', fr, pb.build(), { fn: K });
  }

  /* ---------------- Амортизатор (корпус на кулаку + шток) ---------------- */
  {
    const pb = new PB();
    // труба
    pb.add(G.cyl(sAt(-0.040), sAt(0.300), 0.0275, 0.0275, 30), M.steelPaint);
    pb.add(G.cyl(sAt(-0.043), sAt(-0.036), 0.0295, 0.0295, 30), M.steelDark);               // днище
    pb.add(G.lathe([[0.0275, 0.282], [0.0305, 0.282], [0.0305, 0.304], [0.0215, 0.304], [0.0215, 0.296], [0.0275, 0.296], [0.0275, 0.282]], { c: A, dir: d0, seg: 30 }), M.steelDark);  // сальникова гайка
    // нижня чашка пружини (приварена)
    pb.add(G.lathe([[0.0275, 0.190], [0.0585, 0.190], [0.0605, 0.197], [0.0605, 0.206], [0.0565, 0.206], [0.0545, 0.200], [0.0275, 0.200], [0.0275, 0.190]], { c: A, dir: d0, seg: 40 }), M.steelPaint);
    pb.add(G.lathe([[0.0275, 0.200], [0.052, 0.200], [0.052, 0.2045], [0.0275, 0.2045], [0.0275, 0.200]], { c: A, dir: d0, seg: 40 }), M.rubber);   // ізолятор
    // кронштейн стійки стабілізатора
    const tb = sAt(0.150);
    pb.add(G.beam(tb, Ls.clone().add(V3(-0.015, 0, 0)), 0.026, 0.008, V3(0, 1, 0)), M.steelPaint);
    pb.add(G.cyl(Ls.clone().add(V3(-0.030, 0, 0)), Ls.clone().add(V3(0.012, 0, 0)), 0.014, 0.014, 16), M.steelPaint);
    // обмежувальні вушка під хомут
    pb.add(G.lathe([[0.0275, 0.060], [0.0300, 0.060], [0.0300, 0.130], [0.0275, 0.130], [0.0275, 0.060]], { c: A, dir: d0, seg: 30 }), M.steelDark);
    car.add('f_damper', fr, pb.build(), { fn: K });

    // шток: циліндр уздовж локальної Y, нижній кінець у трубі, верхній — над опорою
    const g = new THREE.Group();
    g.add(new THREE.Mesh(G.cyl(V3(0, -0.33, 0), V3(0, 0.012, 0), 0.0125, 0.0125, 20), M.alu));
    g.add(new THREE.Mesh(G.cyl(V3(0, -0.33, 0), V3(0, -0.28, 0), 0.0215, 0.0215, 24), M.steelDark));    // поршень
    g.add(new THREE.Mesh(G.cyl(V3(0, 0.012, 0), V3(0, 0.040, 0), 0.0085, 0.0085, 14), M.steel));       // різьба
    car.add('f_damper', fr, g, {
      fn: (ctx, cc) => frameMat(U.clone().addScaledVector(cc.strutDir, 0.0), cc.strutDir)
    });
  }

  /* ---------------- Пружина ---------------- */
  {
    const geo = G.helix({ R: 0.0505, wire: 0.0115, active: 5.4, endTurns: 0.8, L: 0.2166, radial: 8 });
    const mesh = new THREE.Mesh(geo, M.springPaint);
    const grp = new THREE.Group(); grp.add(mesh);
    car.add('f_spring', fr, grp, {
      fn: (ctx, cc) => {
        const L = cc.strutLen - 0.052 - 0.2045;
        geo.userData.update(L);
        return frameMat(cc.An.clone().addScaledVector(cc.strutDir, 0.2045), cc.strutDir);
      }
    });
  }

  /* ---------------- Відбійник + пильовик ---------------- */
  {
    const g = new THREE.Group();
    const boot = new THREE.Mesh(G.bellows(0.0345, 0.0345, 7, 0.0045, 24), M.rubberBoot);
    boot.userData.role = 'boot';
    const bump = new THREE.Mesh(G.cyl(V3(0, 0, 0), V3(0, 1, 0), 0.0230, 0.0190, 24), M.rubberRed);
    g.add(boot); g.add(bump);
    car.add('f_bump', fr, g, {
      fn: (ctx, cc) => {
        // обидва малюються в одній локальній системі: від верху труби до нижнього краю верхньої опори
        const a = cc.An.clone().addScaledVector(cc.strutDir, 0.304);
        const gap = cc.strutLen - 0.052 - 0.304;
        boot.matrix.copy(new THREE.Matrix4().identity().makeScale(1, gap, 1));
        boot.matrixAutoUpdate = false;
        const bl = Math.max(0.020, Math.min(0.065, gap));
        bump.matrixAutoUpdate = false;
        // відбійник: від верхньої опори вниз
        bump.matrix.copy(new THREE.Matrix4().compose(V3(0, gap - bl, 0), new THREE.Quaternion(), V3(1, bl, 1)));
        return frameMat(a, cc.strutDir);
      }
    });
  }

  /* ---------------- Верхня опора стійки (нерухома, на кузові) ---------------- */
  {
    const pb = new PB(), Y = d0;
    const at = (s) => U.clone().addScaledVector(Y, s);
    // гумовий корпус і сталеві пластини
    pb.add(G.lathe([[0.0, -0.028], [0.043, -0.028], [0.045, -0.020], [0.045, 0.006], [0.0, 0.006]], { c: U, dir: Y, seg: 36 }), M.rubber);
    pb.add(G.lathe([[0.012, -0.002], [0.056, -0.002], [0.056, 0.006], [0.012, 0.006], [0.012, -0.002]], { c: U, dir: Y, seg: 36 }), M.steel);
    pb.add(G.lathe([[0.012, 0.006], [0.030, 0.006], [0.030, 0.012], [0.012, 0.012], [0.012, 0.006]], { c: U, dir: Y, seg: 28 }), M.steelDark);
    // три шпильки кріплення до стакана кузова
    const ux = new THREE.Vector3().crossVectors(Y, V3(0, 0, 1)).normalize(), uz = new THREE.Vector3().crossVectors(ux, Y).normalize();
    for (let k = 0; k < 3; k++) {
      const a = TAU * k / 3 + 0.5, pos = U.clone().addScaledVector(ux, Math.cos(a) * 0.048).addScaledVector(uz, Math.sin(a) * 0.048);
      pb.add(G.cyl(pos.clone().addScaledVector(Y, -0.002), pos.clone().addScaledVector(Y, 0.034), 0.0044, 0.0044, 10), M.zinc);
      pb.add(G.hex(pos.clone().addScaledVector(Y, 0.026), Y, 0.012, 0.007), M.zinc);
    }
    // гайка штока
    pb.add(G.hex(at(0.022), Y, 0.019, 0.011), M.zinc);
    car.add('f_mount', fr, pb.build(), {});
  }

  /* ---------------- Опорний підшипник + верхня чашка пружини ---------------- */
  {
    const pb = new PB(), Y = d0;
    pb.add(G.lathe([[0.0125, -0.040], [0.0345, -0.040], [0.0345, -0.028], [0.0125, -0.028], [0.0125, -0.040]], { c: U, dir: Y, seg: 36 }), M.steel);
    // тіла кочення (кульки)
    pb.add(G.torus(U.clone().addScaledVector(Y, -0.034), Y, 0.0235, 0.0052, 28, 8), M.alu);
    // чашка + ізолятор
    pb.add(G.lathe([[0.0125, -0.050], [0.058, -0.050], [0.060, -0.044], [0.060, -0.040], [0.0125, -0.040], [0.0125, -0.050]], { c: U, dir: Y, seg: 40 }), M.steelPaint);
    pb.add(G.lathe([[0.034, -0.0545], [0.058, -0.0545], [0.058, -0.050], [0.034, -0.050], [0.034, -0.0545]], { c: U, dir: Y, seg: 40 }), M.rubber);
    car.add('f_bearing', fr, pb.build(), {
      fn: (ctx, cc) => {
        const ax = new THREE.Vector3().crossVectors(d0, cc.strutDir);
        const ang = Math.asin(Math.min(1, ax.length()));
        return ang < 1e-8 ? _I : G.rotAbout(U, ax, ang);
      }
    });
  }

  /* ---------------- Болти кріплення стійки (в складі кулака — окрема деталь) --- */
  // (вже включені в кулак; окрема деталь не потрібна)

  /* ---------------- Нижній важіль ---------------- */
  const Bw = B.clone().add(V3(0, 0.016, 0));
  const au = P1.clone().sub(P2).normalize();
  const tmpv = Bw.clone().sub(P2);
  const av = tmpv.clone().addScaledVector(au, -tmpv.dot(au)).normalize();
  const an = new THREE.Vector3().crossVectors(au, av).normalize();
  const armLen = P1.distanceTo(P2);
  {
    const pb = new PB();
    const tri = [[0, 0], [armLen, 0], [tmpv.dot(au), tmpv.dot(av)]];
    const outline = G.roundPoly(tri, i => [0.046, 0.037, 0.036][i], 8);
    const hole = G.roundPoly(G.offsetPoly(tri, -0.026), 0.014, 5);
    const O = P2.clone().addScaledVector(an, -0.004);
    pb.add(G.extrude(outline, { depth: 0.007, bevel: 0.0012, O, u: au, v: av, holes: [hole] }), M.steelPaint);
    // борт жорсткості по периметру
    pb.add(G.extrude(outline, { depth: 0.024, O: O.clone().addScaledVector(an, 0.003), u: au, v: av, holes: [G.offsetPoly(outline, -0.006)] }), M.steelPaint);
    // втулки-обойми під сайлентблоки (зварені)
    const shell = (P, ri, ro, len) => G.lathe([[ri, 0], [ro, 0], [ro, len], [ri, len], [ri, 0]], { c: P.clone().addScaledVector(au, -len / 2), dir: au, seg: 36 });
    pb.add(shell(P1, 0.0305, 0.0355, 0.072), M.steelPaint);
    pb.add(shell(P2, 0.0405, 0.0465, 0.086), M.steelPaint);
    // кронштейн під стабілізатор — відсутній; штамповані отвори — візуально
    car.add('f_arm', fr, pb.build(), { fn: (ctx, cc) => cc.arm });
  }
  {
    // передній сайлентблок
    const pb = new PB(), P = P1;
    const ax = (h) => P.clone().addScaledVector(au, h);
    pb.add(G.lathe([[0.0165, -0.035], [0.0305, -0.035], [0.0305, 0.035], [0.0165, 0.035], [0.0165, -0.035]], { c: P, dir: au, seg: 36 }), M.rubber);
    pb.add(G.lathe([[0.0085, -0.046], [0.0165, -0.046], [0.0165, 0.046], [0.0085, 0.046], [0.0085, -0.046]], { c: P, dir: au, seg: 28 }), M.steel);
    boltPB(pb, ax(-0.067), au, 0.140, 0.0075, 0.022, 0.009);
    nutPB(pb, ax(0.0645), au, 0.022, 0.012);
    car.add('f_bushF', fr, pb.build(), { fn: (ctx, cc) => cc.arm });
  }
  {
    // задній (гідравлічний) сайлентблок
    const pb = new PB(), P = P2;
    const ax = (h) => P.clone().addScaledVector(au, h);
    pb.add(G.lathe([[0.0215, -0.041], [0.0405, -0.041], [0.0405, 0.041], [0.0215, 0.041], [0.0215, -0.041]], { c: P, dir: au, seg: 40 }), M.rubber);
    pb.add(G.lathe([[0.0095, -0.054], [0.0215, -0.054], [0.0215, 0.054], [0.0095, 0.054], [0.0095, -0.054]], { c: P, dir: au, seg: 28 }), M.steel);
    // дві камери з рідиною (вікна)
    for (const s of [-1, 1]) {
      const w = P.clone().addScaledVector(av, s * 0.0405);
      pb.add(G.box(w, [0.0035, 0.026, 0.020], av, an, au), M.rubberRed);
    }
    boltPB(pb, ax(-0.0775), au, 0.160, 0.0085, 0.024, 0.010);
    nutPB(pb, ax(0.0745), au, 0.024, 0.013);
    car.add('f_bushR', fr, pb.build(), { fn: (ctx, cc) => cc.arm });
  }

  /* ---------------- Кульова опора ---------------- */
  {
    const pb = new PB();
    const at = h => B.clone().addScaledVector(kp, h);
    pb.add(G.cyl(at(-0.044), at(0.012), 0.0255, 0.0255, 26), M.steelDark);
    pb.add(G.cyl(at(-0.046), at(-0.040), 0.0240, 0.0240, 26), M.steelDark);
    // фланець кріплення до важеля + 3 болти
    pb.add(G.cyl(at(-0.022), at(-0.015), 0.038, 0.038, 30), M.steelDark);
    for (let k = 0; k < 3; k++) {
      const a = TAU * k / 3 + 0.8;
      const e1 = new THREE.Vector3().crossVectors(kp, V3(0, 0, 1)).normalize(), e2 = new THREE.Vector3().crossVectors(e1, kp).normalize();
      const pos = at(-0.0225).addScaledVector(e1, Math.cos(a) * 0.0315).addScaledVector(e2, Math.sin(a) * 0.0315);
      pb.add(G.hex(pos, kp, 0.012, 0.007), M.zinc);
    }
    pb.add(G.cyl(at(-0.052), at(-0.046), 0.0045, 0.0045, 10), M.brass);        // прес-маслянка
    // пильовик
    const bo = G.bellows(0.0245, 0.0128, 3, 0.0030, 24); bo.scale(1, 0.040, 1);
    pb.add(G.place(bo, at(0.012), kp), M.rubberBoot);
    pb.add(G.cyl(at(0.010), at(0.016), 0.0262, 0.0262, 24), M.steel);
    // палець + гайка + шплінт
    pb.add(G.cyl(at(0.0), at(0.098), 0.0100, 0.0075, 18), M.steel);
    pb.add(G.hex(at(0.088), kp, 0.019, 0.015), M.zinc);
    const sp = new THREE.Vector3().crossVectors(kp, X).normalize();
    pb.add(G.cyl(at(0.088).addScaledVector(sp, -0.014), at(0.088).addScaledVector(sp, 0.014), 0.0016, 0.0016, 6), M.steel);
    car.add('f_ball', fr, pb.build(), { fn: (ctx, cc) => cc.arm });
  }

  /* ---------------- Рульова тяга і наконечник ---------------- */
  {
    const dt = T.clone().sub(R).normalize();
    const along = h => R.clone().addScaledVector(dt, h);
    const pb = new PB();
    pb.add(G.sphere(R, 0.0215, 18), M.steelDark);                                   // шарнір у рейці
    pb.add(G.cyl(along(0.0), along(0.040), 0.0215, 0.0185, 22), M.steelDark);        // корпус внутрішнього шарніра
    pb.add(G.cyl(along(0.040), T.clone().addScaledVector(dt, -0.100), 0.0095, 0.0095, 16), M.steel);   // тяга
    pb.add(G.hex(along(0.047), dt, 0.024, 0.010), M.steel);                          // ключ під тягу
    car.add('f_tieRod', fr, pb.build(), { fn: (ctx, cc) => cc.tie });

    const pe = new PB();
    pe.add(G.cyl(T.clone().addScaledVector(dt, -0.098), T.clone().addScaledVector(dt, -0.062), 0.0085, 0.0085, 14), M.steel);  // різьба
    pe.add(G.hex(T.clone().addScaledVector(dt, -0.080), dt, 0.019, 0.011), M.zinc);                                 // контргайка
    pe.add(G.cyl(T.clone().addScaledVector(dt, -0.065), T.clone().addScaledVector(dt, -0.012), 0.0165, 0.0165, 20), M.steelDark);   // корпус
    pe.add(G.sphere(T.clone().addScaledVector(dt, -0.012), 0.0165, 14), M.steelDark);
    const stud = V3(0.04, 1, 0).normalize();
    const bo = G.bellows(0.0165, 0.0095, 2, 0.0024, 20); bo.scale(1, 0.030, 1);
    pe.add(G.place(bo, T.clone().addScaledVector(stud, 0.004), stud), M.rubberBoot);
    pe.add(G.cyl(T.clone().addScaledVector(stud, -0.012), T.clone().addScaledVector(stud, 0.060), 0.0085, 0.0065, 16), M.steel);
    pe.add(G.hex(T.clone().addScaledVector(stud, 0.050), stud, 0.017, 0.012), M.zinc);
    car.add('f_tieEnd', fr, pe.build(), { fn: (ctx, cc) => cc.tie });
  }

  /* ---------------- Стійка стабілізатора ---------------- */
  {
    const pb = new PB();
    const dl = Ls.clone().sub(Lb).normalize();
    const e = h => Lb.clone().addScaledVector(dl, h), top = Ls.distanceTo(Lb);
    pb.add(G.cyl(e(0.018), e(top - 0.018), 0.0058, 0.0058, 14), M.steel);
    for (const [pos, sgn] of [[Lb, 1], [Ls, -1]]) {
      pb.add(G.sphere(pos, 0.0125, 14), M.steelDark);
      pb.add(G.cyl(pos.clone().addScaledVector(dl, sgn * 0.0), pos.clone().addScaledVector(dl, sgn * 0.040), 0.0120, 0.0100, 16), M.steelDark);
      const bo = G.bellows(0.0120, 0.0065, 2, 0.0018, 14); bo.scale(1, 0.016, 1);
      // шарніри з пальцями, спрямованими поперек (X) через вушка
      pb.add(G.cyl(pos.clone().add(V3(-0.026, 0, 0)), pos.clone().add(V3(0.030, 0, 0)), 0.0060, 0.0060, 12), M.steel);
      pb.add(G.hex(pos.clone().add(V3(0.028, 0, 0)), X, 0.013, 0.009), M.zinc);
    }
    car.add('f_link', fr, pb.build(), { fn: (ctx, cc) => cc.link });
  }

  /* ---------------- Гальмівний шланг ---------------- */
  {
    const F = wheelFrame(C, cfg.thC), xi = cfg.faceIn - 0.0145 - 0.037;
    const hp = F.at(xi + 0.004, cfg.pistonRad, -0.050).add(F.td.clone().multiplyScalar(-0.014));
    const hb = V3(0.600, 0.560, 1.150);
    const grp = makeCable(0.0052, M.hose, 8);
    // фітинги й кронштейн кузова
    const fit = new PB();
    fit.add(G.cyl(hb.clone().add(V3(0.0, -0.01, -0.015)), hb.clone().add(V3(0.0, 0.03, -0.015)), 0.0075, 0.0075, 10), M.brass);
    fit.add(G.box(hb.clone().add(V3(-0.018, 0.02, -0.015)), [0.012, 0.045, 0.030]), M.steelPaint);
    grp.add(fit.build());
    const endFit = new THREE.Group();
    // банджо-болт на суппорті (тримається на кулаку)
    const bj = new PB();
    bj.add(G.cyl(hp.clone().add(F.td.clone().multiplyScalar(-0.002)), hp.clone().add(F.td.clone().multiplyScalar(0.020)), 0.0072, 0.0072, 12), M.brass);
    bj.add(G.hex(hp.clone().add(F.td.clone().multiplyScalar(-0.006)), F.td, 0.017, 0.008), M.brass);
    const bjg = bj.build();
    car.add('f_hose', fr, grp, {
      fn: (ctx, cc) => {
        const end = hp.clone().applyMatrix4(cc.K);
        const mid1 = hp.clone().add(V3(-0.040, 0.012, -0.012)).applyMatrix4(cc.K);
        const mid1b = new THREE.Vector3().lerpVectors(mid1, hb, 0.55); mid1b.y -= 0.03; mid1b.x += 0.00;
        grp.userData.rebuild([end, mid1, mid1b, hb.clone().add(V3(0, -0.01, -0.015))]);
        return _I;
      }
    });
    car.add('f_hose', fr, bjg, { fn: K });
  }

  /* ---------------- Кабель датчика ABS ---------------- */
  {
    const th = cfg.sensorTh, a = polar(C, -0.104, 0.0395, th), clip = V3(0.575, 0.520, 1.215);
    const grp = makeCable(0.0034, M.plastic, 6);
    car.add('f_sensor', fr, grp, {
      fn: (ctx, cc) => {
        const s = a.clone().applyMatrix4(cc.K);
        const m1 = a.clone().add(V3(-0.035, 0.030, -0.010)).applyMatrix4(cc.K);
        grp.userData.rebuild([s, m1, new THREE.Vector3().lerpVectors(m1, clip, 0.6).add(V3(0, 0.02, 0)), clip]);
        return _I;
      }
    });
  }
}
