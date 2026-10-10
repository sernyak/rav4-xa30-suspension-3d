/* ============================================================================
   MATS — матеріали (MeshStandardMaterial). Середовище (envMap) ставиться сценою.
   ========================================================================== */

const _std = (color, metal, rough, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, metalness: metal, roughness: rough }, extra || {}));

const M = {
  steel:      _std(0x80878f, 0.82, 0.40),   // штампована/кована сталь
  steelDark:  _std(0x3a3e44, 0.78, 0.48),   // чорнена сталь
  steelPaint: _std(0x2a2d33, 0.30, 0.50),   // фарбована сталь (важелі, підрамник)
  cast:       _std(0x4e5258, 0.60, 0.58),   // чавун (кулак, диски)
  alu:        _std(0xaeb3bb, 0.88, 0.36),   // алюміній
  aluDark:    _std(0x70767e, 0.85, 0.44),
  zinc:       _std(0xc9ad4f, 0.85, 0.38),   // жовтий цинк (болти)
  rubber:     _std(0x141415, 0.00, 0.92),
  rubberSoft: _std(0x2b2b2d, 0.00, 0.85),
  rubberBoot: _std(0x1a1a1c, 0.00, 0.88, { side: THREE.DoubleSide }),
  rubberRed:  _std(0x8a2a22, 0.00, 0.80),   // гідро-вставка / індикатори
  rotor:      _std(0x6c6862, 0.88, 0.48),
  rotorRust:  _std(0x6a5c50, 0.7, 0.7),
  pad:        _std(0x2e2a27, 0.10, 0.92),
  caliper:    _std(0x30333a, 0.40, 0.42),
  caliperRed: _std(0x9a2b25, 0.5, 0.38),
  springPaint:_std(0x23262c, 0.35, 0.45),
  hose:       _std(0x19191b, 0.0, 0.7),
  brass:      _std(0xb08d4a, 0.9, 0.32),
  plastic:    _std(0x35373b, 0.0, 0.7),
  plasticLt:  _std(0xd8d6cf, 0.0, 0.55),
  tire:       _std(0x151516, 0.0, 0.96),
  wheel:      _std(0xb4bac2, 0.90, 0.30),
  wheelDark:  _std(0x30343a, 0.6, 0.4),
  oil:        _std(0x3a3328, 0.3, 0.5),
  glassy:     _std(0x9fb4c8, 0.2, 0.2, { transparent: true, opacity: 0.35 }),
  gold:       _std(0xcaa84a, 0.95, 0.3),
};

/* Системні кольори для режиму «колір за системами» */
const SYS_COLORS = {
  susp:  0x3b8cff,   // підвіска
  brake: 0xff4d4d,   // гальма
  steer: 0x3ddc84,   // рульове керування
  drive: 0xffa53b,   // привід
  wheel: 0xa0a8b4,   // колесо
  body:  0x7a8696,   // кузов / контекст
};

Object.values(M).forEach(m => { m.envMapIntensity = 0.62; });
