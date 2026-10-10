/* ============================================================================
   APP — інтерфейс: дерево деталей, вибір, опис, рух підвіски, розбирання,
   фільтри, камери. Параметри в #hash — для посилань і тестів.
   ========================================================================== */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const canvas = $('#c');
  const HASH = new URLSearchParams(location.hash.slice(1));

  let S, car;
  const state = { travel: { FL: 0, FR: 0, RL: 0, RR: 0 }, steer: 0, spin: 0, explode: 0 };
  const ui = { hiddenTypes: new Set(), sysFilter: null, axFilter: null, isolate: null, wheels: true, body: true, outline: true, focus: true, colorMode: 'accent', spinOn: false, autoOn: false };
  let dirty = true, selected = new Set(), primary = null, hover = null, pickables = [], byType = {};
  let tween = null, camAnim = null, autoT = 0, lastRead = 0, symptomShown = null;

  const SIDE_ORDER = { FL: 0, FR: 1, RL: 2, RR: 3, W: 4 };
  const EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.9 10.9 0 0112 19c-7 0-11-7-11-7a19.8 19.8 0 015.1-5.9M9.9 4.2A10.7 10.7 0 0112 4c7 0 11 8 11 8a19.7 19.7 0 01-3.2 4.2M1 1l22 22"/></svg>';
  const SYS_ORDER = ['susp', 'brake', 'steer', 'drive', 'wheel', 'body'];
  const AX_NAME = { f: 'Передня вісь', r: 'Задня вісь', c: 'Контекст' };
  const firstSentence = t => { const s = String(t || '').split('. ')[0].trim(); return s && !/[.!?]$/.test(s) ? s + '.' : s; };
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ============================== Видимість ================================ */
  function partVisible(p) {
    const t = p.type;
    if (ui.hiddenTypes.has(t)) return false;
    if (p.ghost) return t === 'ctx_outline' ? ui.outline : ui.body;
    if (ui.isolate && !ui.isolate.has(t)) return false;
    if (!ui.wheels && p.info.sys === 'wheel') return false;
    if (ui.sysFilter && p.info.sys !== ui.sysFilter) return false;
    if (ui.axFilter && p.info.axle !== ui.axFilter) return false;
    return true;
  }
  function applyVisibility() {
    pickables = [];
    car.parts.forEach(p => {
      const v = partVisible(p);
      p.visible = v;
      p.subs.forEach(s => { s.obj.visible = v; });
      if (v && !p.ghost) p.meshes.forEach(m => pickables.push(m));
      if (!v && selected.has(p)) selected.delete(p);
    });
    if (primary && !primary.visible) primary = null;
    syncTreeEyes();
    styleAll();
    refreshInfo();
  }

  /* ============================== Стилі деталей ============================ */
  const _c = new THREE.Color();
  function tintFor(part, base) {
    const lum = 0.2126 * base.color.r + 0.7152 * base.color.g + 0.0722 * base.color.b;
    _c.setHex(SYS_COLORS[part.info.sys] || 0x888888);
    const k = 0.10 + 1.25 * Math.pow(lum, 0.8);
    return _c.multiplyScalar(Math.min(1.25, k));
  }
  function stylePart(part) {
    if (part.ghost) return;
    const isSel = selected.has(part), isHov = hover === part;
    const dim = ui.focus && selected.size > 0 && !isSel;
    for (const m of part.meshes) {
      const mm = m.material, base = mm.userData.base;
      let accent = false;
      if (ui.colorMode === 'system') mm.color.copy(tintFor(part, base));
      else if (ui.colorMode === 'accent') {
        const acc = ACCENT[part.type], hit = acc && acc.find(x => x.mat === base);
        if (hit) { mm.color.copy(hit.color).multiplyScalar(0.62); accent = true; } else mm.color.copy(base.color);
      } else mm.color.copy(base.color);
      // кольорові акценти — менш «дзеркальні», щоб колір не вигорав у відблисках
      mm.metalness = accent ? Math.min(base.metalness, 0.12) : base.metalness;
      mm.roughness = accent ? Math.max(base.roughness, 0.5) : base.roughness;
      mm.envMapIntensity = accent ? 0.3 : 0.62;
      mm.emissive.setHex(isSel ? 0x2a6bf5 : (isHov ? 0x1c4fa8 : 0x000000));
      mm.emissiveIntensity = isSel ? 0.42 : (isHov ? 0.40 : 0);
      mm.transparent = dim; mm.opacity = dim ? 0.09 : 1; mm.depthWrite = !dim;
    }
  }
  function styleAll() { car.parts.forEach(stylePart); syncTreeSel(); }

  /* ============================== Вибір ==================================== */
  function select(part, opts = {}) {
    selected = new Set(part ? [part] : []);
    primary = part || null; symptomShown = null;
    styleAll(); refreshInfo();
    if (part && opts.fly) flyToParts([part]);
  }
  function selectTypes(types, sym) {
    const set = new Set();
    types.forEach(t => (byType[t] || []).forEach(p => { if (!p.ghost && p.visible) set.add(p); }));
    selected = set; primary = null; symptomShown = sym || null;
    styleAll(); refreshInfo();
    if (set.size) flyToParts([...set]);
  }
  function partFor(type, ref) {
    const list = byType[type] || [];
    if (!list.length) return null;
    return (ref && list.find(p => p.frame === ref.frame)) || list.find(p => p.visible) || list[0];
  }
  function openType(type, ref) {
    const p = partFor(type, ref);
    if (!p) return;
    if (p.ghost) { flyToParts([p]); return; }
    if (!p.visible) { ui.hiddenTypes.delete(type); applyVisibility(); }
    select(p, { fly: true });
  }

  /* ============================== Камера =================================== */
  function camTo(pos, target, dur = 750) {
    camAnim = { t: 0, dur, p0: S.camera.position.clone(), t0: S.controls.target.clone(), p1: pos.clone(), t1: target.clone() };
  }
  function flyToParts(parts) {
    car.root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    parts.forEach(p => p.subs.forEach(s => { if (s.obj.visible) box.expandByObject(s.obj); }));
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const size = Math.max(sz.x, sz.y, sz.z, 0.12);
    const dir = S.camera.position.clone().sub(S.controls.target).normalize();
    if (dir.y < 0.05) dir.y = 0.05;
    const dist = Math.min(9, Math.max(0.55, size * 2.1));
    camTo(c.clone().addScaledVector(dir.normalize(), dist), c);
  }
  const VIEWS = [
    ['Загальний', [3.5, 1.9, 4.2], [0, 0.4, 0]],
    ['Спереду', [0.0, 1.0, 5.4], [0, 0.45, 1.0]],
    ['Ззаду', [0.0, 1.0, -5.4], [0, 0.45, -1.0]],
    ['Збоку', [6.0, 0.9, 0.0], [0, 0.42, 0]],
    ['Зверху', [0.0, 6.2, 0.01], [0, 0, 0]],
    ['Знизу', [0.0, -4.2, 1.2], [0, 0.3, 0]],
    ['Перед. ліве', [2.15, 0.75, 2.75], [0.65, 0.42, 1.3]],
    ['Задн. ліве', [2.15, 0.75, -2.75], [0.62, 0.42, -1.32]],
  ];
  function buildViews() {
    const box = $('#views');
    VIEWS.forEach(([n, p, t]) => {
      const b = document.createElement('button'); b.className = 'pill'; b.textContent = n;
      b.onclick = () => camTo(new THREE.Vector3(...p), new THREE.Vector3(...t), 900);
      box.appendChild(b);
    });
  }

  /* ============================== Дерево деталей =========================== */
  const treeRows = [];
  function buildTree() {
    const tree = $('#tree'); tree.innerHTML = '';
    const types = Object.keys(INFO).filter(t => byType[t]);
    SYS_ORDER.forEach(sys => {
      const ts = types.filter(t => INFO[t].sys === sys);
      if (!ts.length) return;
      const sh = document.createElement('div'); sh.className = 'sys'; sh.dataset.sys = sys;
      sh.innerHTML = `<i style="background:${hex(SYSTEMS[sys].color)}"></i><span>${SYSTEMS[sys].ua}</span>`;
      const eb = document.createElement('button'); eb.className = 'eye'; eb.title = 'Показати/сховати систему'; eb.innerHTML = EYE;
      eb.onclick = () => {
        const anyVisible = ts.some(t => !ui.hiddenTypes.has(t));
        ts.forEach(t => anyVisible ? ui.hiddenTypes.add(t) : ui.hiddenTypes.delete(t));
        applyVisibility();
      };
      sh.appendChild(eb);
      tree.appendChild(sh);
      ['f', 'r', 'c'].forEach(ax => {
        const as = ts.filter(t => INFO[t].axle === ax);
        if (!as.length) return;
        const gh = document.createElement('div'); gh.className = 'grp'; gh.textContent = AX_NAME[ax]; gh.dataset.sys = sys;
        tree.appendChild(gh);
        as.forEach(t => {
          const row = document.createElement('div'); row.className = 'row'; row.dataset.type = t; row.dataset.sys = sys;
          const n = byType[t].length;
          row.innerHTML = `<span class="nm">${esc(INFO[t].ua)}</span>${n > 1 ? `<span class="cnt">×${n}</span>` : ''}`;
          const eb2 = document.createElement('button'); eb2.className = 'eye'; eb2.innerHTML = EYE; eb2.title = 'Показати/сховати';
          eb2.onclick = e => { e.stopPropagation(); if (ui.hiddenTypes.has(t)) ui.hiddenTypes.delete(t); else ui.hiddenTypes.add(t); applyVisibility(); };
          const dot = document.createElement('i'); dot.className = 'dot'; row.insertBefore(dot, row.querySelector('.nm'));
          row.prepend(eb2);
          row.onclick = () => openType(t);
          row.onmouseenter = () => { hoverType(t); };
          row.onmouseleave = () => { hoverType(null); };
          tree.appendChild(row);
          treeRows.push({ row, eb: eb2, dot, type: t, text: (INFO[t].ua + ' ' + (INFO[t].en || '')).toLowerCase() });
        });
      });
    });
  }
  function syncTreeEyes() {
    treeRows.forEach(r => {
      const off = ui.hiddenTypes.has(r.type);
      r.row.classList.toggle('off', off);
      r.eb.innerHTML = off ? EYE_OFF : EYE;
      r.eb.classList.toggle('off', off);
    });
  }
  function syncTreeSel() {
    const types = new Set(); selected.forEach(p => types.add(p.type));
    treeRows.forEach(r => r.row.classList.toggle('sel', types.has(r.type)));
  }
  let hoverTypeCur = null;
  function hoverType(t) {
    if (hoverTypeCur) (byType[hoverTypeCur] || []).forEach(p => { p._hov = false; });
    hoverTypeCur = t;
    car.parts.forEach(p => { if (p.ghost) return; const was = p._tHov; p._tHov = (p.type === t); });
    car.parts.forEach(p => {
      if (p.ghost) return;
      const h = p._tHov;
      p.meshes.forEach(m => {
        const mm = m.material, isSel = selected.has(p);
        if (isSel) return;
        mm.emissive.setHex(h ? 0x1c4fa8 : (hover === p ? 0x1c4fa8 : 0));
        mm.emissiveIntensity = h ? 0.55 : (hover === p ? 0.55 : 0);
      });
    });
  }
  $('#search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    const vis = new Set();
    treeRows.forEach(r => { const ok = !q || r.text.includes(q); r.row.style.display = ok ? '' : 'none'; if (ok) vis.add(INFO[r.type].sys + (INFO[r.type].axle)); });
    $$('#tree .grp').forEach(g => { /* сховаємо порожні групи */
      let n = g.nextElementSibling, any = false;
      while (n && n.classList.contains('row')) { if (n.style.display !== 'none') any = true; n = n.nextElementSibling; }
      g.style.display = any ? '' : 'none';
    });
    $$('#tree .sys').forEach(h => {
      let n = h.nextElementSibling, any = false;
      while (n && !n.classList.contains('sys')) { if (n.classList.contains('row') && n.style.display !== 'none') any = true; n = n.nextElementSibling; }
      h.style.display = any ? '' : 'none';
    });
  });

  /* ============================== Інфо-панель ============================== */
  const info = $('#info');
  function chip(type, ref, label) {
    const t = INFO[type]; if (!t) return '';
    return `<button class="chip" data-type="${type}" data-ref="${ref ? ref.key : ''}">${esc(label || t.ua)}</button>`;
  }
  function refreshInfo() {
    if (symptomShown) return showSymptom(symptomShown);
    if (primary) return showPart(primary);
    if (selected.size > 1) { return showMulti(); }
    showEmpty();
  }
  function showEmpty() {
    info.innerHTML = `<div class="empty"><h2 style="margin:4px 0 8px;font-size:18px;color:#fff">Оберіть деталь</h2>
      <p>Клікніть по будь-якій деталі в 3D-вікні або виберіть її у списку ліворуч — тут з’явиться, <b>що це</b>, <b>що робить</b>, <b>з чим взаємодіє</b> і <b>які ознаки зносу</b>.</p>
      <h4 style="margin-top:16px">З чого почати</h4>
      <ul>
        <li><span class="note">Вкладка <b>«Рух»</b> — ганяйте колесо вгору-вниз і крутіть кермо: бачите, як працюють важелі, стійка, стабілізатор, ШРУС.</span></li>
        <li><span class="note">Вкладка <b>«Вигляд»</b> — повзунок <b>«розбирання»</b> розсуває деталі за порядком складання.</span></li>
        <li><span class="note">Вкладка <b>«Довідка»</b> — «симптом → які деталі підозрювати» та словник (розвал, сходження, кастер…).</span></li>
      </ul></div>`;
  }
  function showPart(part) {
    const i = part.info, sys = SYSTEMS[i.sys];
    const same = (byType[part.type] || []).filter(p => p !== part && !p.ghost);
    let h = `<span class="badge"><i style="background:${hex(sys.color)}"></i>${esc(sys.ua)}</span>
      <h2>${esc(part.title)}</h2><div class="en">${esc(i.en || '')}</div>`;
    if (same.length) {
      h += `<div class="inst">` + same.sort((a, b) => SIDE_ORDER[a.frame] - SIDE_ORDER[b.frame]).map(p => `<button class="btn" data-sel="${p.key}">${esc(SIDE_LABEL[p.frame] || p.frame)}</button>`).join('') + `</div>`;
    }
    h += `<h4>Що це</h4><p>${esc(i.what || '')}</p><h4>Що робить</h4><p>${esc(i.does || '')}</p>`;
    if (i.links && i.links.length) {
      h += `<h4>З чим взаємодіє</h4><ul>` + i.links.map(([t, note]) => `<li>${chip(t, part)}<span class="note">${esc(note)}</span></li>`).join('') + `</ul>`;
    }
    if (i.wear) h += `<h4>Ознаки зносу / обслуговування</h4><div class="wear">${esc(i.wear)}</div>`;
    h += `<div class="btnrow" style="margin-top:14px"><button class="btn" data-act="fly">Наблизити</button><button class="btn" data-act="iso">${ui.isolate ? 'Показати все' : 'Показати лише цю деталь'}</button><button class="btn" data-act="clear">Зняти вибір</button></div>`;
    info.innerHTML = h;
  }
  const SIDE_LABEL = { FL: 'ліва передня', FR: 'права передня', RL: 'ліва задня', RR: 'права задня', W: 'по центру' };
  function showMulti() {
    const types = new Map(); selected.forEach(p => { if (!types.has(p.type)) types.set(p.type, p); });
    info.innerHTML = `<h2>Вибрано ${selected.size} деталей</h2><ul>${[...types.values()].map(p => `<li>${chip(p.type, p)}<span class="note">${esc(firstSentence(p.info.does))}</span></li>`).join('')}</ul>
      <div class="btnrow"><button class="btn" data-act="clear">Зняти вибір</button></div>`;
  }
  function showSymptom(sym) {
    const types = new Map(); selected.forEach(p => { if (!types.has(p.type)) types.set(p.type, p); });
    info.innerHTML = `<span class="badge"><i style="background:#ffb454"></i>Діагностика</span>
      <h2>${esc(sym.t)}</h2><p>${esc(sym.d)}</p>
      <h4>Підозрювані деталі (підсвічені в 3D)</h4>
      <ul>${[...types.values()].map(p => `<li>${chip(p.type, p)}<span class="note">${esc(firstSentence(p.info.wear))}</span></li>`).join('')}</ul>
      <div class="btnrow"><button class="btn" data-act="isoSym">Показати лише ці</button><button class="btn" data-act="clear">Зняти вибір</button></div>
      <p class="hint" style="margin-top:10px">Це лише найімовірніші причини — остаточний діагноз ставить огляд на підйомнику й перевірка люфтів.</p>`;
  }
  info.addEventListener('click', e => {
    const c = e.target.closest('.chip');
    if (c) { const ref = car.parts.get(c.dataset.ref); openType(c.dataset.type, ref); return; }
    const sb = e.target.closest('[data-sel]');
    if (sb) { select(car.parts.get(sb.dataset.sel), { fly: true }); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'clear') { select(null); }
    else if (act === 'fly') { flyToParts([...selected]); }
    else if (act === 'iso') {
      if (ui.isolate) ui.isolate = null; else if (primary) ui.isolate = new Set([primary.type]);
      applyVisibility();
    } else if (act === 'isoSym') {
      ui.isolate = ui.isolate ? null : new Set([...selected].map(p => p.type));
      applyVisibility();
    }
  });

  /* ============================== Помічник: Довідка ======================== */
  function buildHelp() {
    const sBox = $('#symptoms');
    SYMPTOMS.forEach(sym => {
      const b = document.createElement('button'); b.className = 'sym';
      b.innerHTML = `<b>${esc(sym.t)}</b><span>${esc(sym.d)}</span>`;
      b.onclick = () => { selectTypes(sym.types, sym); };
      sBox.appendChild(b);
    });
    const g = $('#glossary');
    GLOSSARY.forEach(([t, d]) => { const el = document.createElement('details'); el.innerHTML = `<summary>${esc(t)}</summary><p>${esc(d)}</p>`; g.appendChild(el); });
  }

  /* ============================== Рух ====================================== */
  const PRESETS = [
    ['Нейтраль', { FL: 0, FR: 0, RL: 0, RR: 0, steer: 0 }],
    ['Крен у лівому повороті', { FL: -0.055, FR: 0.055, RL: -0.045, RR: 0.045, steer: -0.5 }],
    ['Крен у правому повороті', { FL: 0.055, FR: -0.055, RL: 0.045, RR: -0.045, steer: 0.5 }],
    ['Гальмування (занурення)', { FL: 0.055, FR: 0.055, RL: -0.045, RR: -0.045, steer: 0 }],
    ['Розгін (присідання)', { FL: -0.04, FR: -0.04, RL: 0.05, RR: 0.05, steer: 0 }],
    ['Діагональне вивішування', { FL: 0.09, FR: -0.09, RL: -0.09, RR: 0.09, steer: 0 }],
    ['Яма під лівим переднім', { FL: -0.10, FR: 0, RL: 0, RR: 0, steer: 0 }],
    ['Бордюр правим переднім', { FL: 0, FR: 0.10, RL: 0, RR: 0, steer: 0 }],
  ];
  function setState(t, steer) {
    ['FL', 'FR', 'RL', 'RR'].forEach(k => { state.travel[k] = t[k]; });
    state.steer = steer; dirty = true; syncSliders();
  }
  function tweenTo(p) {
    tween = { t: 0, dur: 0.7, from: { FL: state.travel.FL, FR: state.travel.FR, RL: state.travel.RL, RR: state.travel.RR, steer: state.steer }, to: p };
    ui.autoOn = false; $('#c-auto').checked = false;
  }
  function syncSliders() {
    ['fl', 'fr', 'rl', 'rr'].forEach(k => {
      const v = Math.round(state.travel[k.toUpperCase()] * 1000);
      $('#s-' + k).value = v; $('#v-' + k).textContent = (v > 0 ? '+' : '') + v + ' мм';
    });
    $('#s-st').value = Math.round(state.steer * 100);
    $('#s-ex').value = Math.round(state.explode * 100); $('#v-ex').textContent = Math.round(state.explode * 100) + '%';
  }
  function bindMotion() {
    const pb = $('#presets');
    PRESETS.forEach(([n, p]) => { const b = document.createElement('button'); b.className = 'btn'; b.textContent = n; b.onclick = () => tweenTo(p); pb.appendChild(b); });
    ['fl', 'fr', 'rl', 'rr'].forEach(k => {
      $('#s-' + k).addEventListener('input', e => { ui.autoOn = false; $('#c-auto').checked = false; tween = null; state.travel[k.toUpperCase()] = e.target.value / 1000; dirty = true; syncSliders(); });
    });
    $('#s-st').addEventListener('input', e => { ui.autoOn = false; $('#c-auto').checked = false; tween = null; state.steer = e.target.value / 100; dirty = true; syncSliders(); });
    $('#s-ex').addEventListener('input', e => { state.explode = e.target.value / 100; dirty = true; syncSliders(); });
    $('#c-spin').onchange = e => { ui.spinOn = e.target.checked; };
    $('#c-auto').onchange = e => { ui.autoOn = e.target.checked; autoT = 0; if (!ui.autoOn) { /* залишаємо як є */ } };
  }
  function updateReadout() {
    if (!car.ctx) return;
    const rows = [['Переднє ліве', 'FL'], ['Переднє праве', 'FR'], ['Заднє ліве', 'RL'], ['Заднє праве', 'RR']];
    let h = '<tr><th></th><th>розвал Δ°</th><th>схід./пов. °</th><th>колія Δмм</th></tr>';
    rows.forEach(([n, k]) => {
      const a = car.ctx.c[k] && car.ctx.c[k].ang; if (!a) return;
      const f = x => (Math.abs(x) < 0.005 ? '0.00' : (x > 0 ? '+' : '') + x.toFixed(2));
      h += `<tr><td>${n}</td><td>${f(a.camber)}</td><td>${f(a.toe)}</td><td>${(a.track > 0 ? '+' : '') + a.track.toFixed(1)}</td></tr>`;
    });
    $('#angtab').innerHTML = h;
    const fl = car.ctx.c.FL.ang.toe;
    $('#v-st').textContent = (Math.abs(fl) < 0.05 ? '0' : (fl > 0 ? '+' : '') + fl.toFixed(1)) + '° (ліве)';
  }

  const CM_HINT = {
    real: 'Деталі в природних матеріалах: сталь, гума, алюміній.',
    accent: 'Ключові групи мають постійний колір (решта — реалістична). Клікніть на пункт легенди — підсвітяться всі деталі групи.',
    system: 'Кожна система має свій колір: підвіска, гальма, кермо, привід, колесо.',
  };
  let lastColored = 'accent';
  function setColorMode(m) {
    if (!CM_HINT[m]) m = 'accent';
    ui.colorMode = m;
    if (m !== 'real') lastColored = m;
    $$('[data-cm]').forEach(x => x.classList.toggle('on', x.dataset.cm === m));
    $('#c-color').checked = m !== 'real';
    $('#cmq').classList.toggle('on', m !== 'real');
    try { localStorage.setItem('rav4.colorMode', m); } catch (e) { /* без збереження */ }
    renderLegend(); styleAll(); syncDots();
  }
  function renderLegend() {
    const lg = $('#legend'); $('#cm-hint').textContent = CM_HINT[ui.colorMode];
    if (ui.colorMode === 'accent') {
      lg.innerHTML = ACCENT_GROUPS.map(g => `<button class="lg" data-g="${g.id}"><i style="background:${hex(g.color)}"></i>${esc(g.ua)}</button>`).join('');
      $$('.lg', lg).forEach(b => b.onclick = () => { const g = ACCENT_GROUPS.find(x => x.id === b.dataset.g); selectTypes(g.types); });
    } else if (ui.colorMode === 'system') {
      lg.innerHTML = SYS_ORDER.map(s => `<span><i style="background:${hex(SYSTEMS[s].color)}"></i>${SYSTEMS[s].ua.split(' (')[0]}</span>`).join('');
    } else lg.innerHTML = '';
  }
  function syncDots() {
    treeRows.forEach(r => {
      const acc = ui.colorMode === 'accent' && ACCENT[r.type];
      r.dot.style.display = acc ? 'inline-block' : 'none';
      if (acc) r.dot.style.background = hex(acc[0].color.getHex());
    });
  }

  /* ============================== Вигляд =================================== */
  function bindView() {
    // фільтр систем
    const sf = $('#sysfilter');
    const mkBtn = (box, label, on, fn) => { const b = document.createElement('button'); b.className = 'btn' + (on ? ' on' : ''); b.textContent = label; b.onclick = () => { fn(); $$('.btn', box).forEach(x => x.classList.remove('on')); b.classList.add('on'); }; box.appendChild(b); return b; };
    mkBtn(sf, 'Усі системи', true, () => { ui.sysFilter = null; applyVisibility(); });
    SYS_ORDER.slice(0, 5).forEach(s => mkBtn(sf, SYSTEMS[s].ua.split(' (')[0], false, () => { ui.sysFilter = s; applyVisibility(); }));
    const af = $('#axfilter');
    mkBtn(af, 'Обидві осі', true, () => { ui.axFilter = null; applyVisibility(); });
    mkBtn(af, 'Тільки передня', false, () => { ui.axFilter = 'f'; applyVisibility(); });
    mkBtn(af, 'Тільки задня', false, () => { ui.axFilter = 'r'; applyVisibility(); });
    $('#c-wheels').onchange = e => { ui.wheels = e.target.checked; applyVisibility(); };
    $('#c-body').onchange = e => { ui.body = e.target.checked; applyVisibility(); };
    $('#c-outline').onchange = e => { ui.outline = e.target.checked; applyVisibility(); };
    $('#c-grid').onchange = e => { S.ground.visible = S.grid.visible = e.target.checked; ui.gridOn = e.target.checked; };
    $('#c-focus').onchange = e => { ui.focus = e.target.checked; styleAll(); };
    $('#c-hq').onchange = e => { S.renderer.setPixelRatio(e.target.checked ? Math.min(window.devicePixelRatio || 1, 2) : 1); resize(); };
    $$('[data-cm]').forEach(b => b.onclick = () => setColorMode(b.dataset.cm));
    $('#c-color').onchange = e => setColorMode(e.target.checked ? lastColored : 'real');
    $('#cmq').onclick = () => setColorMode(ui.colorMode === 'real' ? lastColored : 'real');
    renderLegend();
    $$('#tabs button').forEach(b => b.onclick = () => {
      $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
      $$('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
    });
    $('#menu-l').onclick = () => { document.body.classList.toggle('lopen'); document.body.classList.remove('ropen'); };
    $('#menu-r').onclick = () => { document.body.classList.toggle('ropen'); document.body.classList.remove('lopen'); };
  }

  /* ============================== Вибір мишею ============================== */
  const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
  function pick(ev) {
    const r = canvas.getBoundingClientRect();
    mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(mouse, S.camera);
    const hits = ray.intersectObjects(pickables, false);
    return hits.length ? hits[0].object.userData.part : null;
  }
  let down = null, hoverQueued = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 5 || e.button !== 0) return;
    const p = pick(e);
    if (p) select(p); else if (selected.size) select(null);
  });
  canvas.addEventListener('dblclick', e => { const p = pick(e); if (p) { select(p); flyToParts([p]); } });
  canvas.addEventListener('pointermove', e => {
    const tip = $('#tip');
    if (e.buttons) { tip.style.display = 'none'; return; }
    hoverQueued = e;
  });
  canvas.addEventListener('pointerleave', () => { $('#tip').style.display = 'none'; setHover(null); });
  function setHover(p) {
    if (hover === p) return;
    const old = hover; hover = p;
    if (old) stylePart(old);
    if (p) stylePart(p);
    canvas.style.cursor = p ? 'pointer' : '';
  }
  function processHover() {
    if (!hoverQueued) return;
    const e = hoverQueued; hoverQueued = null;
    const p = pick(e);
    setHover(p);
    const tip = $('#tip');
    if (p) { tip.textContent = p.title; tip.style.display = 'block'; tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; }
    else tip.style.display = 'none';
  }
  window.addEventListener('keydown', e => { if (e.key === 'Escape') { select(null); ui.isolate = null; applyVisibility(); } });

  /* ============================== Цикл ===================================== */
  const ease = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (tween) {
      tween.t += dt / tween.dur; const k = ease(Math.min(1, tween.t));
      const f = tween.from, to = tween.to;
      ['FL', 'FR', 'RL', 'RR'].forEach(c => { state.travel[c] = f[c] + (to[c] - f[c]) * k; });
      state.steer = f.steer + (to.steer - f.steer) * k;
      dirty = true; syncSliders();
      if (tween.t >= 1) tween = null;
    }
    if (ui.autoOn) {
      autoT += dt;
      const w = 2.4;
      state.travel.FL = 0.05 * Math.sin(autoT * w);
      state.travel.FR = 0.05 * Math.sin(autoT * w + 1.4);
      state.travel.RL = 0.05 * Math.sin(autoT * w + 0.8);
      state.travel.RR = 0.05 * Math.sin(autoT * w + 2.4);
      state.steer = 0.6 * Math.sin(autoT * 0.7);
      dirty = true; syncSliders();
    }
    if (ui.spinOn) { state.spin += dt * 6; dirty = true; }
    if (dirty) {
      car.update(state);
      dirty = false;
      if (now - lastRead > 90) { updateReadout(); lastRead = now; }
    }
    if (camAnim) {
      camAnim.t += dt * 1000 / camAnim.dur; const k = ease(Math.min(1, camAnim.t));
      S.camera.position.lerpVectors(camAnim.p0, camAnim.p1, k);
      S.controls.target.lerpVectors(camAnim.t0, camAnim.t1, k);
      if (camAnim.t >= 1) camAnim = null;
    }
    processHover();
    S.controls.update();
    const gOn = ui.gridOn !== false;
    S.ground.visible = gOn && S.camera.position.y > 0.02;
    S.renderer.render(S.scene, S.camera);
  }
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    S.renderer.setSize(w, h, false);
    S.camera.aspect = w / h;
    S.camera.fov = w / h >= 1.1 ? 36 : Math.min(74, 2 * Math.atan(Math.tan(18 * Math.PI / 180) * 1.1 / (w / h)) * 180 / Math.PI);
    // зсув зображення так, щоб модель була в центрі вільної області між панелями
    if (w > 860) {
      const lw = $('#left').offsetWidth + 12, rw = $('#right').offsetWidth + 12;
      S.camera.setViewOffset(w, h, -(lw - rw) / 2, 0, w, h);
    } else S.camera.clearViewOffset();
    S.camera.updateProjectionMatrix();
  }

  /* ============================== Старт ==================================== */
  function init() {
    S = setupScene(canvas);
    car = buildCar();
    S.scene.add(car.root);
    car.update(state);
    car.parts.forEach(p => { (byType[p.type] = byType[p.type] || []).push(p); p.meshes.forEach(m => { m.geometry.computeBoundingBox(); m.geometry.computeBoundingSphere(); }); });
    Object.values(byType).forEach(l => l.sort((a, b) => SIDE_ORDER[a.frame] - SIDE_ORDER[b.frame]));
    buildTree(); buildViews(); buildHelp(); bindMotion(); bindView();
    syncSliders(); applyVisibility(); showEmpty();
    S.controls.addEventListener('start', () => { camAnim = null; });
    window.addEventListener('resize', resize);
    resize();
    applyHash();
    requestAnimationFrame(frame);
    const ld = $('#loading'); ld.style.opacity = 0; setTimeout(() => ld.remove(), 600);
    window.__app = { car, state, ui, select, openType, selectTypes, S, camTo, applyVisibility, styleAll };
  }

  function applyHash() {
    const num = (k, d) => HASH.has(k) ? parseFloat(HASH.get(k)) : d;
    state.travel.FL = num('fl', 0); state.travel.FR = num('fr', 0); state.travel.RL = num('rl', 0); state.travel.RR = num('rr', 0);
    state.steer = num('steer', 0); state.explode = num('ex', 0); state.spin = num('spin', 0);
    let saved = null; try { saved = localStorage.getItem('rav4.colorMode'); } catch (e) { saved = null; }
    if (HASH.get('cm')) setColorMode(HASH.get('cm')); else if (saved && CM_HINT[saved]) setColorMode(saved); else setColorMode('accent');
    syncDots();
    (HASH.get('hide') || '').split(',').filter(Boolean).forEach(h => Object.keys(INFO).forEach(t => { if (t === h || t.endsWith('_' + h) || t.startsWith(h)) ui.hiddenTypes.add(t); }));
    if (HASH.get('nowheels') === '1') { ui.wheels = false; $('#c-wheels').checked = false; }
    if (HASH.get('nobody') === '1') { ui.body = false; ui.outline = false; $('#c-body').checked = false; $('#c-outline').checked = false; }
    if (HASH.get('sys')) ui.sysFilter = HASH.get('sys');
    if (HASH.get('ax')) ui.axFilter = HASH.get('ax');
    if (HASH.get('tab')) { const b = $(`#tabs [data-tab="${HASH.get('tab')}"]`); if (b) b.click(); }
    if (HASH.get('left') === '0') { $('#left').classList.add('hide'); }
    dirty = true; syncSliders(); applyVisibility();
    car.update(state); dirty = false; updateReadout();
    if (HASH.get('sel')) { const p = partFor(HASH.get('sel'), byType[HASH.get('sel')] && byType[HASH.get('sel')][0]); if (p) select(p); }
    if (HASH.get('sym')) { const s = SYMPTOMS[+HASH.get('sym')]; if (s) selectTypes(s.types, s); }
    if (HASH.get('iso')) { ui.isolate = new Set(HASH.get('iso').split(',')); applyVisibility(); }
    if (HASH.has('cam')) { const v = HASH.get('cam').split(',').map(Number); S.camera.position.set(v[0], v[1], v[2]); S.controls.target.set(v[3], v[4], v[5]); S.controls.update(); }
    if (HASH.get('fly') && byType[HASH.get('fly')]) { car.root.updateMatrixWorld(true); flyToParts([byType[HASH.get('fly')][0]]); camAnim.t = 1; }
    if (HASH.get('auto') === '1') { ui.autoOn = true; $('#c-auto').checked = true; }
    if (HASH.get('spinon') === '1') { ui.spinOn = true; $('#c-spin').checked = true; }
    if (HASH.get('selftest')) {
      let n = 0; const errs = [];
      car.parts.forEach(p => { try { select(p); if (!info.textContent.length) errs.push(p.key + ':empty'); n++; } catch (e) { errs.push(p.key + ':' + e.message); } });
      select(null);
      PRESETS.forEach(([nm, pr]) => { try { setState(pr, pr.steer); car.update(state); } catch (e) { errs.push('preset ' + nm + ':' + e.message); } });
      SYMPTOMS.forEach(s => { try { selectTypes(s.types, s); } catch (e) { errs.push('sym ' + s.t + ':' + e.message); } });
      select(null);
      const m0 = car.parts.get('FL.f_spring').meshes[0].material.color.getHex();
      $('#cmq').click(); const m1 = car.parts.get('FL.f_spring').meshes[0].material.color.getHex(); const modeOff = ui.colorMode;
      $('#cmq').click(); const m2 = car.parts.get('FL.f_spring').meshes[0].material.color.getHex(); const modeOn = ui.colorMode;
      if (!(m0 !== m1 && m0 === m2 && modeOff === 'real' && modeOn === 'accent')) errs.push('color toggle: ' + [m0, m1, m2, modeOff, modeOn].join('/'));
      document.title = 'selftest parts=' + n + ' errs=' + (errs.join(';') || 'none');
    }
  }

  window.addEventListener('load', () => setTimeout(init, 40));
})();
