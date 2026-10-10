/* ============================================================================
   WHEELEND — вузол колеса: ступиця, підшипник, гальмівний диск, суппорт,
   скоба, колодки, поршень, напрямні, захисний кожух, датчик ABS, колесо.
   Спільний для передньої і задньої осі (відрізняються cfg).
   Вісь колеса — вздовж X; зсуви x відраховуються від центра колеса C.
   ========================================================================== */

/* Кут θ: від +Y (вгору) до +Z (вперед). φ у lathe: θ = π − φ */
const phiRange = (t0, t1) => [PI - t1, PI - t0];

/* Локальний репер на колесі */
function wheelFrame(C, th) {
  const X = V3(1, 0, 0), rd = V3(0, Math.cos(th), Math.sin(th)), td = new THREE.Vector3().crossVectors(X, rd);
  return { X, rd, td, at: (x, r, t) => C.clone().addScaledVector(X, x).addScaledVector(rd, r).addScaledVector(td, t) };
}
/* Паралелепіпед у репері колеса: розміри по [X, радіусу, дотичній] */
function wbox(F, x, r, t, sx, sr, st) { return G.box(F.at(x, r, t), [sx, sr, st], F.X, F.rd, F.td); }

/* ---------- Конфігурації осей --------------------------------------------- */
const WE = {
  f: {
    p: 'f', rotorR: 0.148, rotorIn: 0.100, vented: true,
    faceIn: -0.002, faceOut: 0.026, thick: 0.028,
    thC: 4.95,                       // кут суппорта (ззаду, трохи вище осі)
    pistonR: 0.027, pistonRad: 0.130,
    kRing: [-0.040, 0.012],          // кулак: кільце під підшипник
    sensorTh: 5.55,
  },
  r: {
    p: 'r', rotorR: 0.1405, rotorIn: 0.0885, vented: false,
    faceIn: 0.016, faceOut: 0.028, thick: 0.012,
    thC: 4.80,
    pistonR: 0.019, pistonRad: 0.118,
    kRing: [-0.040, -0.008],
    sensorTh: 5.55,
  },
};

/* ============================ СТУПИЦЯ ===================================== */
function hubStaticPB(C, cfg) {
  const pb = new PB();
  // зовнішнє кільце підшипника (нерухоме, запресоване в кулак)
  pb.add(G.latheX([[0.040, -0.048], [0.0475, -0.048], [0.0475, 0.012], [0.0405, 0.012], [0.040, -0.048]], C, { seg: 40 }), M.steel);
  // сальники
  pb.add(G.latheX([[0.0385, 0.010], [0.0498, 0.010], [0.0498, 0.0145], [0.0385, 0.0145], [0.0385, 0.010]], C, { seg: 40 }), M.rubber);
  pb.add(G.latheX([[0.0385, -0.050], [0.0498, -0.050], [0.0498, -0.0455], [0.0385, -0.0455], [0.0385, -0.050]], C, { seg: 40 }), M.rubber);
  return pb.build();
}

function hubRotPB(C, cfg) {
  const pb = new PB();
  // маточина: внутрішнє кільце, фланець, центрувальний буртик
  pb.add(G.latheX([[0.0165, -0.052], [0.036, -0.052], [0.036, 0.025], [0.0725, 0.025], [0.0725, 0.039], [0.0295, 0.039], [0.0295, 0.049], [0.0165, 0.049], [0.0165, -0.052]], C, { seg: 44 }), M.cast);
  // шпильки (5 × M12, PCD 114.3)
  for (let k = 0; k < 5; k++) {
    const th = TAU * k / 5 + 0.314;
    const a = polar(C, 0.025, 0.05715, th), b = polar(C, 0.090, 0.05715, th);
    pb.add(G.cyl(a, b, 0.0062, 0.0058, 10), M.steelDark);
    pb.add(G.cyl(a, polar(C, 0.031, 0.05715, th), 0.0078, 0.0078, 10), M.steelDark);
  }
  // зубчасте кільце датчика ABS (енкодер) на внутрішньому торці
  pb.add(G.latheX([[0.0360, -0.0600], [0.0450, -0.0600], [0.0450, -0.0520], [0.0360, -0.0520], [0.0360, -0.0600]], C, {
    seg: 96, crease: 0.1, mod: (r, h, ph) => (r > 0.044 && Math.sin(ph * 48) > 0) ? r + 0.002 : r
  }), M.steelDark);
  return pb.build();
}

/* ======================== ГАЛЬМІВНИЙ ДИСК ================================= */
function rotorPB(C, cfg) {
  const pb = new PB(), R = cfg.rotorR, Ri = cfg.rotorIn;
  if (cfg.vented) {
    // зовнішня пластина + «шапка»
    pb.add(G.latheX([
      [R, 0.0175], [R, 0.026], [0.0815, 0.026], [0.0815, 0.045], [0.030, 0.045], [0.030, 0.039], [0.0775, 0.039], [0.0775, 0.0175], [R, 0.0175]
    ], C, { seg: 120 }), M.rotor);
    // внутрішня пластина
    pb.add(G.latheX([[Ri, -0.002], [R, -0.002], [R, 0.0065], [Ri, 0.0065], [Ri, -0.002]], C, { seg: 120 }), M.rotor);
    // ребра вентиляції (36 шт., вигнуті лопатки)
    for (let k = 0; k < 36; k++) {
      const th = TAU * k / 36, F = wheelFrame(C, th);
      pb.add(G.box(F.at(0.012, (Ri + R) / 2, 0), [0.011, R - Ri, 0.0045], F.X, F.rd, F.td), M.rotor);
    }
  } else {
    // суцільний диск із «барабаном» стоянкового гальма в шапці
    pb.add(G.latheX([
      [0.0845, 0.0], [0.0885, 0.0], [0.0885, cfg.faceIn], [R, cfg.faceIn], [R, cfg.faceOut], [0.0885, cfg.faceOut],
      [0.0885, 0.045], [0.030, 0.045], [0.030, 0.039], [0.0845, 0.039], [0.0845, 0.0]
    ], C, { seg: 120 }), M.rotor);
  }
  // ковпачки під шпильки на «шапці» (5 отворів з фасками — темні кільця)
  for (let k = 0; k < 5; k++) {
    const th = TAU * k / 5 + 0.314;
    pb.add(G.cyl(polar(C, 0.0451, 0.05715, th), polar(C, 0.0455, 0.05715, th), 0.0085, 0.0085, 14), M.steelDark);
  }
  return pb.build();
}

/* ====================== ЗАХИСНИЙ КОЖУХ / ЩИТОК ============================ */
function shieldPB(C, cfg) {
  const pb = new PB();
  if (cfg.p === 'f') {
    const sw = phiRange(cfg.thC + 0.55, cfg.thC + TAU - 0.55);
    pb.add(G.latheX([[0.052, -0.0105], [0.126, -0.0105], [0.130, -0.0085], [0.126, -0.0065], [0.052, -0.0065], [0.052, -0.0105]], C, { seg: 90, sweep: sw }), M.steel);
    pb.add(G.latheX([[0.052, -0.0105], [0.054, -0.0105], [0.054, -0.0065], [0.052, -0.0065]], C, { seg: 40 }), M.steel);
  } else {
    // опорний щит стоянкового гальма — повне коло
    pb.add(G.latheX([[0.050, -0.0100], [0.0880, -0.0100], [0.0880, -0.0050], [0.050, -0.0050], [0.050, -0.0100]], C, { seg: 60 }), M.steelDark);
    pb.add(G.latheX([[0.0845, -0.0050], [0.0880, -0.0050], [0.0880, 0.0010], [0.0845, 0.0010], [0.0845, -0.0050]], C, { seg: 60 }), M.steelDark);
  }
  return pb.build();
}

/* ========== Колодки стоянкового гальма (барабан у «шапці») — задня вісь ===== */
function parkShoesPB(C) {
  const pb = new PB();
  [[0.5, 2.7], [3.65, 5.85]].forEach(([a0, a1]) => {
    const sw = phiRange(a0, a1);
    pb.add(G.latheX([[0.0780, 0.002], [0.0800, 0.002], [0.0800, 0.016], [0.0780, 0.016], [0.0780, 0.002]], C, { seg: 28, sweep: sw }), M.steelDark);
    pb.add(G.latheX([[0.0700, 0.008], [0.0780, 0.008], [0.0780, 0.010], [0.0700, 0.010], [0.0700, 0.008]], C, { seg: 28, sweep: sw }), M.steelDark);
    pb.add(G.latheX([[0.0800, 0.003], [0.0843, 0.003], [0.0843, 0.015], [0.0800, 0.015], [0.0800, 0.003]], C, { seg: 28, sweep: phiRange(a0 + 0.1, a1 - 0.1) }), M.pad);
  });
  // розтискний механізм (важіль + розпірка) і стяжні пружини
  pb.add(G.cyl(polar(C, 0.006, 0.077, 0.45), polar(C, 0.012, 0.077, 0.55), 0.007, 0.007, 10), M.zinc);
  pb.add(G.cyl(polar(C, 0.009, 0.075, 3.12), polar(C, 0.009, 0.075, 3.55), 0.006, 0.006, 10), M.zinc);
  pb.add(G.cyl(polar(C, 0.009, 0.068, 1.2), polar(C, 0.009, 0.068, 2.0), 0.0025, 0.0025, 6), M.steel);
  pb.add(G.cyl(polar(C, 0.009, 0.068, 4.3), polar(C, 0.009, 0.068, 5.1), 0.0025, 0.0025, 6), M.steel);
  return pb.build();
}

/* ======================= СКОБА СУППОРТА (bracket) ========================= */
function bracketPB(C, cfg) {
  const pb = new PB(), F = wheelFrame(C, cfg.thC), R = cfg.rotorR;
  const xi = cfg.faceIn - 0.0145 - 0.026, xo = cfg.faceOut + 0.0145 + 0.002;   // від внутрішнього до зовнішнього торця
  const rTop = R + 0.006, rLow = cfg.p === 'f' ? 0.070 : 0.062;
  for (const s of [-1, 1]) {
    // стійки скоби (по одній з кожного боку від поршня)
    pb.add(wbox(F, (xi + xo) / 2, (rLow + rTop) / 2 + 0.01, s * 0.071, xo - xi, rTop - rLow - 0.02, 0.0235), M.steelDark);
    // направляючі пазів для колодок (виступи)
    pb.add(wbox(F, (cfg.faceIn - 0.0145 + cfg.faceOut + 0.0145) / 2, R - 0.022, s * 0.0545, cfg.faceOut - cfg.faceIn + 0.029, 0.040, 0.004), M.steel);
    // болти кріплення до кулака
    const bp = F.at(xi - 0.007, rLow + 0.012, s * 0.058);
    pb.add(G.hex(bp, V3(1, 0, 0), 0.017, 0.012), M.zinc);
    pb.add(G.cyl(bp.clone().add(V3(0.005, 0, 0)), bp.clone().add(V3(0.04, 0, 0)), 0.0055, 0.0055, 10), M.zinc);
    // вушко напрямного пальця
    pb.add(G.cyl(F.at(xi + 0.004, R - 0.008, s * 0.087), F.at(xi + 0.034, R - 0.008, s * 0.087), 0.0125, 0.0125, 14), M.steelDark);
  }
  // поперечна планка зсередини
  pb.add(wbox(F, xi + 0.006, (rLow + 0.095) / 2, 0, 0.012, 0.095 - rLow, 0.15), M.steelDark);
  return pb.build();
}

/* =========================== СУППОРТ (floating) =========================== */
function caliperPB(C, cfg) {
  const pb = new PB(), F = wheelFrame(C, cfg.thC), R = cfg.rotorR;
  const xi = cfg.faceIn - 0.0145 - 0.037, xBody1 = cfg.faceIn - 0.0145 - 0.0005;
  const xo0 = cfg.faceOut + 0.0145, xo1 = xo0 + 0.020;
  const rp = cfg.pistonRad, rc = cfg.pistonR + 0.011;
  // корпус циліндра (внутрішня «кулак»)
  pb.add(G.cyl(F.at(xi, rp, 0), F.at(xBody1, rp, 0), rc, rc, 28), M.caliper);
  pb.add(G.cyl(F.at(xi, rp, 0), F.at(xi + 0.004, rp, 0), rc + 0.001, rc + 0.001, 28), M.caliper);
  // перемичка над диском
  const rb0 = R + 0.007, rb1 = R + 0.027;
  pb.add(wbox(F, (xi + xo1) / 2, (rb0 + rb1) / 2, 0, xo1 - xi, rb1 - rb0, 0.115), M.caliper);
  // «ніжки» від циліндра до перемички
  for (const s of [-1, 1]) pb.add(wbox(F, (xi + xBody1) / 2 - 0.002, (rp + rb0) / 2 + 0.01, s * 0.047, xBody1 - xi, rb0 - rp + 0.02, 0.020), M.caliper);
  // зовнішній палець (тримає зовнішню колодку)
  pb.add(wbox(F, (xo0 + xo1) / 2, (R - 0.045 + rb1) / 2, 0, xo1 - xo0, rb1 - (R - 0.045), 0.115), M.caliper);
  // вушка під напрямні пальці
  for (const s of [-1, 1]) {
    pb.add(wbox(F, xi + 0.016, R - 0.010, s * 0.084, 0.032, 0.036, 0.020), M.caliper);
    pb.add(G.cyl(F.at(xi, R - 0.008, s * 0.087), F.at(xi + 0.032, R - 0.008, s * 0.087), 0.0125, 0.0125, 14), M.caliper);
  }
  // штуцер прокачки (з ковпачком)
  const bp = F.at(xi + 0.01, rb1 - 0.002, 0.046);
  pb.add(G.cyl(bp, bp.clone().addScaledVector(F.rd, 0.026), 0.0055, 0.004, 10), M.brass);
  pb.add(G.cyl(bp.clone().addScaledVector(F.rd, 0.026), bp.clone().addScaledVector(F.rd, 0.034), 0.0042, 0.0042, 10), M.rubber);
  // бобишка під банджо шланга
  const hp = F.at(xi + 0.004, rp, -0.050);
  pb.add(G.cyl(hp, hp.clone().addScaledVector(F.td, -0.014), 0.012, 0.012, 14), M.caliper);
  return pb.build();
}

function pistonPB(C, cfg) {
  const pb = new PB(), F = wheelFrame(C, cfg.thC);
  const xBody1 = cfg.faceIn - 0.0145 - 0.0005, rp = cfg.pistonRad;
  pb.add(G.cyl(F.at(xBody1 - 0.030, rp, 0), F.at(xBody1 + 0.0003, rp, 0), cfg.pistonR, cfg.pistonR, 28), M.aluDark);
  // пильовик поршня (гума)
  pb.add(G.cyl(F.at(xBody1 - 0.004, rp, 0), F.at(xBody1 + 0.0004, rp, 0), cfg.pistonR + 0.0055, cfg.pistonR + 0.0045, 28), M.rubber);
  return pb.build();
}

function padsPB(C, cfg) {
  const pb = new PB(), R = cfg.rotorR, r0 = R - 0.045, r1 = R - 0.003, th = cfg.thC;
  const half = 0.40, sw = phiRange(th - half, th + half);
  const cap = (x0, x1, r0_, r1_, mat) => G.latheX([[r0_, x0], [r1_, x0], [r1_, x1], [r0_, x1], [r0_, x0]], C, { seg: 18, sweep: sw, crease: 0.1 });
  const fi = cfg.faceIn, fo = cfg.faceOut;
  // внутрішня колодка
  pb.add(cap(fi - 0.0100, fi, r0, r1), M.pad);
  pb.add(cap(fi - 0.0145, fi - 0.0100, r0 - 0.002, r1 + 0.003), M.steel);
  // зовнішня колодка
  pb.add(cap(fo, fo + 0.0100, r0, r1), M.pad);
  pb.add(cap(fo + 0.0100, fo + 0.0145, r0 - 0.002, r1 + 0.003), M.steel);
  // протискрипні пластини (шими)
  pb.add(cap(fi - 0.0165, fi - 0.0145, r0 - 0.002, r1 + 0.002), M.zinc);
  pb.add(cap(fo + 0.0145, fo + 0.0165, r0 - 0.002, r1 + 0.002), M.zinc);
  // індикатор зносу — ґрунтоване «вушко» на внутрішній колодці
  const F = wheelFrame(C, th - half);
  pb.add(wbox(F, fi - 0.0125, r1 - 0.014, 0.003, 0.0035, 0.034, 0.003), M.steel);
  return pb.build();
}

function pinsPB(C, cfg) {
  const pb = new PB(), F = wheelFrame(C, cfg.thC), R = cfg.rotorR;
  const xi = cfg.faceIn - 0.0145 - 0.037;
  for (const s of [-1, 1]) {
    const a = F.at(xi - 0.006, R - 0.008, s * 0.087), b = F.at(xi + 0.075, R - 0.008, s * 0.087);
    pb.add(G.cyl(a, b, 0.0075, 0.0075, 12), M.steel);
    pb.add(G.hex(F.at(xi - 0.010, R - 0.008, s * 0.087), V3(1, 0, 0), 0.015, 0.010), M.zinc);
    // пильовик напрямної
    const bo = G.bellows(0.0135, 0.0095, 3, 0.0016, 16); bo.scale(1, 0.032, 1);
    pb.add(G.place(bo, F.at(xi + 0.030, R - 0.008, s * 0.087), V3(1, 0, 0)), M.rubberBoot);
  }
  return pb.build();
}

/* ========================= ДАТЧИК ABS ===================================== */
function sensorPB(C, cfg) {
  const pb = new PB(), th = cfg.sensorTh;
  const tip = polar(C, -0.0625, 0.0395, th);
  pb.add(G.cyl(tip, polar(C, -0.0785, 0.0395, th), 0.0065, 0.0065, 12), M.plastic);
  pb.add(G.cyl(polar(C, -0.0785, 0.0395, th), polar(C, -0.092, 0.0395, th), 0.0105, 0.0105, 14), M.plastic);
  pb.add(G.cyl(polar(C, -0.092, 0.0395, th), polar(C, -0.104, 0.0395, th), 0.0075, 0.0075, 12), M.plastic);
  // фіксатор
  pb.add(G.box(polar(C, -0.080, 0.056, th), [0.012, 0.014, 0.012]), M.steel);
  return pb.build();
}

/* ============================ КОЛЕСО ====================================== */
function wheelPB(C) {
  const pb = new PB();
  // обід (бочка)
  pb.add(G.latheX([
    [0.2035, -0.0890], [0.2290, -0.0890], [0.2290, -0.0840], [0.2190, -0.0780], [0.2159, -0.0700], [0.2085, -0.0450],
    [0.2085, 0.0450], [0.2159, 0.0700], [0.2190, 0.0780], [0.2290, 0.0840], [0.2290, 0.0890], [0.2035, 0.0890],
    [0.2000, 0.0600], [0.2000, -0.0600], [0.2035, -0.0890]
  ], C, { seg: 120, crease: 0.5 }), M.wheel);
  // торцева «полиця» у вигляді полірованого кільця
  pb.add(G.latheX([[0.2000, 0.0885], [0.2290, 0.0885], [0.2290, 0.0905], [0.2000, 0.0905], [0.2000, 0.0885]], C, { seg: 120 }), M.alu);
  // центральна плита і 5 широких спиць зі щілинами
  pb.add(G.latheX([[0.030, 0.043], [0.078, 0.043], [0.078, 0.062], [0.030, 0.062], [0.030, 0.043]], C, { seg: 60 }), M.wheel);
  for (let k = 0; k < 5; k++) {
    const th = TAU * k / 5 + 0.0, F = wheelFrame(C, th);
    const outline = G.roundPoly([[0.060, -0.040], [0.205, -0.031], [0.205, 0.031], [0.060, 0.040]], 0.008, 5);
    pb.add(G.extrude(outline, { depth: 0.020, bevel: 0.004, O: F.at(0.053, 0, 0), u: F.rd, v: F.td }), M.wheel);
    // поглиблення (темний «кишеньковий» накладений елемент)
    pb.add(G.extrude(G.roundPoly([[0.108, -0.010], [0.170, -0.008], [0.170, 0.008], [0.108, 0.010]], 0.004, 4), { depth: 0.003, O: F.at(0.0735, 0, 0), u: F.rd, v: F.td }), M.wheelDark);
  }
  // центральний ковпачок
  pb.add(G.latheX([[0.0, 0.058], [0.043, 0.058], [0.043, 0.067], [0.034, 0.073], [0.0, 0.075], [0.0, 0.058]], C, { seg: 40 }), M.wheelDark);
  pb.add(G.latheX([[0.040, 0.0665], [0.044, 0.0665], [0.044, 0.0705], [0.040, 0.0705], [0.040, 0.0665]], C, { seg: 40 }), M.alu);
  // ніпель
  pb.add(G.cyl(polar(C, -0.045, 0.2000, 1.0), polar(C, -0.045, 0.2230, 1.0), 0.0055, 0.0045, 8), M.brass);
  return pb.build();
}

function lugNutsPB(C) {
  const pb = new PB();
  for (let k = 0; k < 5; k++) {
    const th = TAU * k / 5 + 0.314;
    const a = polar(C, 0.062, 0.05715, th), b = polar(C, 0.090, 0.05715, th);
    pb.add(G.hex(polar(C, 0.078, 0.05715, th), V3(1, 0, 0), 0.021, 0.028, th), M.steel);
    pb.add(G.cyl(polar(C, 0.060, 0.05715, th), polar(C, 0.066, 0.05715, th), 0.0108, 0.0085, 14), M.steel);
    pb.add(G.cyl(b, polar(C, 0.0905, 0.05715, th), 0.0075, 0.0075, 12), M.steel);
  }
  return pb.build();
}

function tirePB(C) {
  const T = SPEC.tire, pb = new PB();
  // профіль «знизу вгору» по одному боці (x<0), далі дзеркалимо
  const side = [
    [0.2159, -0.0890], [0.2230, -0.0990], [0.2330, -0.1065], [0.2470, -0.1110], [0.2650, -0.1122], [0.2850, -0.1125],
    [0.3050, -0.1120], [0.3230, -0.1090], [0.3370, -0.1035], [0.3470, -0.0960], [0.3545, -0.0870], [0.3598, -0.0760]
  ];
  const tread = [];
  tread.push([T.R, -0.0745]);
  [-0.047, -0.016, 0.016, 0.047].forEach(x => {
    tread.push([T.R, x - 0.0045]); tread.push([T.R - 0.0065, x - 0.0030]); tread.push([T.R - 0.0065, x + 0.0030]); tread.push([T.R, x + 0.0045]);
  });
  tread.push([T.R, 0.0745]);
  const sideR = side.slice().reverse().map(p => [p[0], -p[1]]);
  const prof = side.concat(tread, sideR, [[0.2159, 0.0890], [0.2159, -0.0890]]);
  // рисунок протектора: поперечні канавки на плечових зонах
  const N = 64;
  pb.add(G.latheX(prof, C, {
    seg: 320, crease: 0.9,
    mod: (r, h, ph) => {
      if (r > T.R - 0.001 && Math.abs(h) > 0.026) { const u = (ph * N / TAU) % 1; const uu = u < 0 ? u + 1 : u; if (uu < 0.15) return r - 0.0050; }
      return r;
    }
  }), M.tire);
  // пояс написів/ребро на боковині
  pb.add(G.latheX([[0.292, -0.1125], [0.2975, -0.1135], [0.3030, -0.1125], [0.292, -0.1125]], C, { seg: 160, crease: 3 }), M.rubberSoft);
  pb.add(G.latheX([[0.292, 0.1125], [0.3030, 0.1125], [0.2975, 0.1135], [0.292, 0.1125]], C, { seg: 160, crease: 3 }), M.rubberSoft);
  return pb.build();
}
