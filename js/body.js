/* ============================================================================
   BODY — напівпрозорий «контекст»: підлога, лонжерони, стакани стійок, арки,
   двигун з КПП та контур кузова. Допомагає зрозуміти, де що кріпиться.
   ========================================================================== */

const _ghost = (color, op) => new THREE.MeshStandardMaterial({
  color, metalness: 0.1, roughness: 0.85, transparent: true, opacity: op, depthWrite: false, side: THREE.DoubleSide,
});
const MG = {
  body:   _ghost(0x7f93ad, 0.07),
  engine: _ghost(0x9aa7b6, 0.09),
  rail:   _ghost(0x7f93ad, 0.11),
};

function buildBody(car) {
  const S = SPEC, X = V3(1, 0, 0);

  /* --- Підлога, тунель, лонжерони --- */
  {
    const pb = new PB();
    pb.add(G.box(V3(0, 0.46, 0.20), [1.44, 0.012, 1.50]), MG.body);               // підлога салону
    pb.add(G.box(V3(0, 0.67, -1.36), [1.44, 0.012, 1.45]), MG.body);              // підлога багажника
    pb.add(G.box(V3(0, 0.56, -0.62), [1.44, 0.22, 0.012]), MG.body);              // уступ
    pb.add(G.box(V3(0, 0.49, 0.20), [0.26, 0.06, 1.5]), MG.body);                 // тунель кардана
    pb.add(G.box(V3(0, 0.80, 0.95), [1.44, 0.74, 0.012]), MG.body);               // щиток моторного відсіку
    for (const s of [-1, 1]) {
      pb.add(G.box(V3(s * 0.47, 0.50, 1.46), [0.08, 0.20, 0.92]), MG.rail);       // передні лонжерони
      pb.add(G.box(V3(s * 0.26, 0.50, -1.50), [0.08, 0.20, 1.05]), MG.rail);      // задні лонжерони
      pb.add(G.box(V3(s * 0.73, 0.38, 0.0), [0.09, 0.14, 3.2]), MG.body);         // пороги
    }
    car.add('ctx_body', 'W', pb.build(), { ghost: true });
  }

  /* --- Арки і стакани стійок --- */
  {
    const pb = new PB();
    for (const s of [-1, 1]) for (const zc of [S.front.C[2], S.rear.C[2]]) {
      const C = V3(s * 0.78, 0.362, zc);
      pb.add(G.latheX([[0.44, s > 0 ? 0.0 : -0.30], [0.44, s > 0 ? 0.30 : 0.0]], C, { seg: 30, sweep: phiRange(-1.65, 1.65), crease: 3 }), MG.body);
    }
    // стакани передніх стійок (McPherson)
    for (const s of [-1, 1]) {
      const U = AV(S.front.U); U.x *= s;
      const d = V3(s * (S.front.U[0] - S.front.A[0]), S.front.U[1] - S.front.A[1], S.front.U[2] - S.front.A[2]).normalize();
      pb.add(G.lathe([[0.07, -0.09], [0.115, -0.09], [0.115, 0.018], [0.07, 0.018]], { c: U, dir: d, seg: 36 }), MG.body);
      // розкіс до лонжерона
      pb.add(G.beam(U.clone().addScaledVector(d, -0.05), V3(s * 0.50, 0.58, U.z), 0.08, 0.012, V3(0, 0, 1)), MG.rail);
    }
    // стакани задніх амортизаторів
    for (const s of [-1, 1]) {
      const St = AV(S.rear.St); St.x *= s;
      const d = V3(s * (S.rear.St[0] - S.rear.Sb[0]), S.rear.St[1] - S.rear.Sb[1], S.rear.St[2] - S.rear.Sb[2]).normalize();
      pb.add(G.lathe([[0.05, -0.05], [0.09, -0.05], [0.09, 0.016], [0.05, 0.016]], { c: St, dir: d, seg: 32 }), MG.body);
    }
    car.add('ctx_arches', 'W', pb.build(), { ghost: true });
  }

  /* --- Двигун, КПП і роздавальна коробка --- */
  {
    const pb = new PB();
    pb.add(G.box(V3(-0.02, 0.60, 1.62), [0.64, 0.46, 0.50]), MG.engine);
    pb.add(G.box(V3(-0.02, 0.88, 1.62), [0.58, 0.07, 0.46]), MG.engine);
    pb.add(G.latheX([[0.0, -0.33], [0.13, -0.33], [0.15, -0.28], [0.15, 0.28], [0.13, 0.33], [0.0, 0.33], [0.0, -0.33]], V3(0, 0.335, 1.33), { seg: 40 }), MG.engine);
    pb.add(G.lathe([[0, 0], [0.075, 0], [0.075, 0.08], [0, 0.08]], { c: V3(0, 0.345, 0.985), dir: V3(0, 0, 1), seg: 28 }), MG.engine);
    car.add('ctx_engine', 'W', pb.build(), { ghost: true });
  }

  /* --- Контур кузова (проволочна «лінія») --- */
  {
    const prof = [[2.02, 0.34], [2.08, 0.50], [2.07, 0.66], [1.96, 0.80], [1.20, 0.98], [0.75, 1.02], [0.20, 1.66], [-0.70, 1.70], [-1.55, 1.68], [-2.00, 1.30], [-2.12, 1.10], [-2.13, 0.60], [-2.04, 0.36], [-1.67, 0.30], [1.66, 0.30]];
    const pos = [];
    const xs = 0.905;
    const seg = (a, b) => pos.push(...a, ...b);
    for (const s of [-1, 1]) for (let i = 0; i < prof.length; i++) {
      const p = prof[i], q = prof[(i + 1) % prof.length];
      seg([s * xs, p[1], p[0]], [s * xs, q[1], q[0]]);
    }
    for (const i of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const p = prof[i]; seg([-xs, p[1], p[0]], [xs, p[1], p[0]]);
    }
    for (const zc of [S.front.C[2], S.rear.C[2]]) for (const s of [-1, 1]) {
      let prev = null;
      for (let k = 0; k <= 36; k++) {
        const a = -0.10 + (PI + 0.20) * k / 36, cur = [s * xs, 0.362 + 0.44 * Math.sin(a), zc + 0.44 * Math.cos(a)];
        if (prev) seg(prev, cur);
        prev = cur;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x8aa4c8, transparent: true, opacity: 0.28 }));
    lines.raycast = () => { };
    const grp = new THREE.Group(); grp.add(lines);
    car.add('ctx_outline', 'W', grp, { ghost: true });
  }
}
