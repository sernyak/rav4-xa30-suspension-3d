/* ============================================================================
   CV — привід колеса: ШРУС зовнішній (кульковий), піввісь, ШРУС внутрішній
   (триподний), пильовики. Спільні для передньої і задньої осі.
   ========================================================================== */

/* Матриця: локальна +Y → dir, початок → pos, масштаб по Y = sy */
function frameMat(pos, dir, sy = 1) {
  return new THREE.Matrix4().compose(pos, G.quatY(dir), V3(1, sy, 1));
}

/* Прив'язує пильовик до двох точок: повертає матрицю для geometry довжиною 1 вздовж +Y */
function spanMat(a, b) {
  const d = b.clone().sub(a), L = d.length();
  return frameMat(a, d.clone().normalize(), L);
}

function buildCV(car, fr, S, p) {
  const Oc = AV(S.Oc), Pin = AV(S.Pin), C = AV(S.C);
  const X = V3(1, 0, 0);

  /* ---- Зовнішній ШРУС: корпус-«тюльпан» зі шліцьовим хвостовиком + гайка ---- */
  {
    const pb = new PB();
    pb.add(G.latheX([[0.0, -0.0455], [0.0345, -0.0455], [0.0395, -0.030], [0.0385, -0.012], [0.030, 0.012], [0.020, 0.022], [0.0165, 0.028], [0.0165, 0.152], [0.0, 0.152], [0.0, -0.0455]], Oc, { seg: 44 }), M.steel);
    // «ребра» літого корпусу
    pb.add(G.latheX([[0.0385, -0.030], [0.0405, -0.030], [0.0405, -0.024], [0.0385, -0.024], [0.0385, -0.030]], Oc, { seg: 44 }), M.steelDark);
    // шліци на хвостовику
    pb.add(G.latheX([[0.0165, 0.040], [0.0172, 0.040], [0.0172, 0.095], [0.0165, 0.095], [0.0165, 0.040]], Oc, { seg: 24 }), M.steelDark);
    // гайка півосі з шплінтом
    const nutC = V3(C.x + 0.061, C.y, C.z);
    pb.add(G.hex(nutC, X, 0.027, 0.022), M.zinc);
    pb.add(G.cyl(nutC.clone().add(V3(0, -0.02, 0)), nutC.clone().add(V3(0, 0.02, 0)), 0.0016, 0.0016, 6), M.steel);
    const sub = car.add(p + '_cvOuter', fr, pb.build(), { fn: (ctx, cc) => cc.K, spin: { C }, partFrame: fr });
  }
  // пильовик зовнішнього ШРУСа
  {
    const g = G.bellows(0.0352, 0.0148, 5, 0.0042, 24);
    const mesh = new THREE.Mesh(g, M.rubberBoot);
    const grp = new THREE.Group(); grp.add(mesh);
    const band1 = new THREE.Mesh(G.cyl(V3(0, -0.004, 0), V3(0, 0.006, 0), 0.0365, 0.0365, 24), M.steel);
    grp.add(band1);
    car.add(p + '_cvOuter', fr, grp, {
      fn: (ctx, cc) => {
        const Xd = X.clone().transformDirection(cc.K);
        const M0 = cc.Oc.clone().addScaledVector(Xd, -0.0455);
        const sdir = cc.Pin.clone().sub(cc.Oc).normalize();
        const E = cc.Oc.clone().addScaledVector(sdir, 0.150);
        return spanMat(M0, E);
      }
    });
  }

  /* ---- Піввісь (вал) ---- */
  {
    const g = new THREE.Group();
    const rod = new THREE.Mesh(G.cyl(V3(0, 0, 0), V3(0, 1, 0), 0.0135, 0.0135, 20), M.steel);
    g.add(rod);
    // шліцьові ділянки на кінцях
    g.add(new THREE.Mesh(G.cyl(V3(0, 0.0, 0), V3(0, 0.04, 0), 0.0142, 0.0142, 20), M.steelDark));
    car.add(p + '_cvShaft', fr, g, {
      fn: (ctx, cc) => {
        const dir = cc.Oc.clone().sub(cc.Pin).normalize();
        const a = cc.Pin.clone().addScaledVector(dir, 0.020), b = cc.Oc.clone().addScaledVector(dir, -0.040);
        return spanMat(a, b);
      }
    });
  }

  /* ---- Внутрішній ШРУС: корпус (нерухомий у КПП) + пильовик ---- */
  {
    const pb = new PB();
    pb.add(G.latheX([[0.0, -0.055], [0.030, -0.055], [0.030, -0.040], [0.0375, -0.030], [0.0375, 0.070], [0.0, 0.070], [0.0, -0.055]], Pin, { seg: 44 }), M.steel);
    // фланець кріплення/ребра корпусу триподного шарніра
    pb.add(G.latheX([[0.0375, -0.010], [0.0395, -0.010], [0.0395, -0.004], [0.0375, -0.004], [0.0375, -0.010]], Pin, { seg: 44 }), M.steelDark);
    pb.add(G.latheX([[0.0375, 0.018], [0.0395, 0.018], [0.0395, 0.024], [0.0375, 0.024], [0.0375, 0.018]], Pin, { seg: 44 }), M.steelDark);
    car.add(p + '_cvInner', fr, pb.build(), {});
  }
  {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(G.bellows(0.0378, 0.0148, 5, 0.0042, 24), M.rubberBoot));
    g.add(new THREE.Mesh(G.cyl(V3(0, -0.004, 0), V3(0, 0.006, 0), 0.0392, 0.0392, 24), M.steel));
    car.add(p + '_cvInner', fr, g, {
      fn: (ctx, cc) => {
        const M0 = cc.Pin.clone().add(V3(0.070, 0, 0));
        const sdir = cc.Oc.clone().sub(cc.Pin).normalize();
        const E = cc.Pin.clone().addScaledVector(sdir, 0.185);
        return spanMat(M0, E);
      }
    });
  }
}
