/* ============================================================================
   SCENE — рендерер, світло, середовище (для відблисків металу), земля, камера.
   ========================================================================== */

function makeEnvironment(renderer) {
  const env = new THREE.Scene();
  // градієнтна «студія»
  const geo = new THREE.SphereGeometry(50, 32, 16);
  const cols = [];
  const pos = geo.attributes.position;
  const top = new THREE.Color(0xb9c6da), mid = new THREE.Color(0x5b6572), bot = new THREE.Color(0x151a21);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 50, c = new THREE.Color();
    if (y > 0) c.copy(mid).lerp(top, Math.pow(y, 0.7)); else c.copy(mid).lerp(bot, Math.pow(-y, 0.6));
    cols.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  env.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  // софтбокси
  const box = (w, h, x, y, z, i) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i * 1.02), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  box(30, 14, 18, 30, 20, 4.5); box(24, 10, -30, 18, 10, 3.2); box(40, 8, 0, 6, -34, 2.4); box(16, 16, -10, 40, -10, 4);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(env, 0.03).texture;
  pm.dispose();
  return tex;
}

function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(256, 256, 20, 256, 256, 256);
  grad.addColorStop(0, 'rgba(44,52,66,1)'); grad.addColorStop(0.6, 'rgba(26,31,40,1)'); grad.addColorStop(1, 'rgba(14,17,22,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 512);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
}

function setupScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.Fog(0x0d1117, 12, 30);
  scene.environment = makeEnvironment(renderer);

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x1c1f26, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.05); key.position.set(4, 7, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9db8ff, 0.5); rim.position.set(-5, 3, -6); scene.add(rim);
  const under = new THREE.DirectionalLight(0xffe2c4, 0.28); under.position.set(0, -5, 2); scene.add(under);

  // земля: диск з градієнтом і тонка сітка
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 64).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: groundTexture(), transparent: true, depthWrite: false }));
  ground.position.y = -0.002; ground.renderOrder = -2; scene.add(ground);
  const grid = new THREE.GridHelper(12, 48, 0x3a4658, 0x232b38);
  grid.position.y = -0.001; grid.material.transparent = true; grid.material.opacity = 0.22; grid.material.depthWrite = false; grid.renderOrder = -1;
  scene.add(grid);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 80);
  camera.position.set(3.5, 1.9, 4.2);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.target.set(0, 0.4, 0);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 0.35; controls.maxDistance = 14;
  controls.maxPolarAngle = Math.PI * 0.98;
  controls.screenSpacePanning = true;
  controls.update();

  return { renderer, scene, camera, controls, ground, grid };
}
