/* ============================================================================
   COLORS — режим «Акценти»: функціональні групи деталей мають постійний колір.
   Фарбуються лише вказані матеріали деталі (болти, гума пильовиків, сталь
   залишаються реалістичними), тому модель лишається схожою на справжню.
   ========================================================================== */

const ACCENT_GROUPS = [
  { id: 'spring', ua: 'Пружини', color: 0x3a9bff, mats: ['springPaint'],
    types: ['f_spring', 'r_spring'] },
  { id: 'damper', ua: 'Амортизатори', color: 0xffc42e, mats: ['steelPaint'],
    types: ['f_damper', 'r_shock'] },
  { id: 'arm', ua: 'Важелі й поздовжній важіль', color: 0x22c1b0, mats: ['steelPaint'],
    types: ['f_arm', 'r_upper', 'r_lower1', 'r_lower2', 'r_trail'] },
  { id: 'bush', ua: 'Сайлентблоки й гумові опори', color: 0xff7a1a, mats: ['rubber'],
    types: ['f_bushF', 'f_bushR', 'r_bushUpIn', 'r_bushUpOut', 'r_bushL1In', 'r_bushL1Out', 'r_bushL2In', 'r_bushL2Out', 'r_bushTrIn', 'r_bushTrOut',
      'f_mount', 'f_bearing', 'f_subMounts', 'r_subMounts', 'f_swayBush', 'r_swayBush', 'r_shockMount', 'r_springSeat', 'f_rack'] },
  { id: 'joint', ua: 'Шарніри: кульова, наконечники, стійки стабілізатора', color: 0xb066ff, mats: ['steelDark'],
    types: ['f_ball', 'f_tieRod', 'f_tieEnd', 'f_link', 'r_link'] },
  { id: 'bar', ua: 'Стабілізатори', color: 0x9be34a, mats: ['steelDark'],
    types: ['f_swayBar', 'r_swayBar'] },
  { id: 'caliper', ua: 'Суппорти', color: 0xe5322d, mats: ['caliper'],
    types: ['f_caliper', 'r_caliper'] },
  { id: 'rack', ua: 'Рульова рейка', color: 0x35d07f, mats: ['alu'],
    types: ['f_rack'] },
  { id: 'drive', ua: 'ШРУСи (шарніри привода)', color: 0xff5fc0, mats: ['steel'],
    types: ['f_cvOuter', 'r_cvOuter', 'f_cvInner', 'r_cvInner'] },
];

const ACCENT = {};
ACCENT_GROUPS.forEach(g => g.types.forEach(t => {
  (ACCENT[t] = ACCENT[t] || []).push(...g.mats.map(m => ({ mat: M[m], color: new THREE.Color(g.color), gid: g.id })));
}));
