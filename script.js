import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

const viewer = document.querySelector('#viewer');
const loading = document.querySelector('#viewerLoading');
const modelKicker = document.querySelector('#modelKicker');
const modelTitle = document.querySelector('#modelTitle');
const modelIntro = document.querySelector('#modelIntro');
const modelBody = document.querySelector('#modelBody');
const viewerLabel = document.querySelector('#viewerLabel');
const pendingBlock = document.querySelector('#pendingBlock');
const manchuBlock = document.querySelector('#manchuBlock');
const peonyHotspots = document.querySelector('#peonyHotspots');

const models = [
  {
    file: './models/tattoo-01.txt',
    title: 'Apricot Blossom',
    label: '01 / APRICOT BLOSSOM',
    kicker: 'IMAGINED MARK 01',
    intro: 'In Chinese poetry, the apricot blossom represents early spring and youth. A Song dynasty poem by Ye Shaoweng describes a locked garden whose spring cannot be contained: one branch of red apricot reaches beyond the wall.',
    body: 'Here, a vine of Manchu script grows between two blossoms. We imagine the mark worn by a woman who could not leave the courtyard, but whose feelings still found a way beyond it.',
    peony: false
  },
  {
    file: './models/tattoo-02.txt',
    title: 'Crabapple Blossom',
    label: '02 / CRABAPPLE BLOSSOM',
    kicker: 'IMAGINED MARK 02',
    intro: 'The crabapple blossom has almost no scent. Chinese poets praised it for modesty and for refusing to bloom carelessly.',
    body: 'In Qing decorative art it often appears beside the peony and magnolia as a wish for wealth and honour. Here, its beauty belongs to no household: ribbons of Manchu script wind around the flower like words she keeps for herself.',
    peony: false
  },
  {
    file: './models/tattoo-03.txt',
    title: 'Peony',
    label: '03 / PEONY',
    kicker: 'IMAGINED MARK 03',
    intro: 'In Qing decorative art, the peony represents prosperity, honour and beauty, appearing on everything from embroidered robes to porcelain.',
    body: 'Here it becomes a symbol of freedom of self-expression. Just as the peony opens in its own way, she chooses how to carry her emotions.',
    peony: true
  }
];

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.42;
controls.minPolarAngle = Math.PI * 0.1;
controls.maxPolarAngle = Math.PI * 0.9;

scene.add(new THREE.HemisphereLight(0xe9ded2, 0x18090a, 2.15));
const key = new THREE.DirectionalLight(0xffeee0, 4.6);
key.position.set(3.5, 4.5, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0x9b2f33, 7.2);
rim.position.set(-4, 1.2, -3.5);
scene.add(rim);
const fill = new THREE.DirectionalLight(0x7a6a60, 2.0);
fill.position.set(3, -3, 1);
scene.add(fill);

const materials = [
  new THREE.MeshPhysicalMaterial({ color: 0xe5dfd7, roughness: 0.48, metalness: 0.04, clearcoat: 0.25, clearcoatRoughness: 0.62, side: THREE.DoubleSide }),
  new THREE.MeshPhysicalMaterial({ color: 0xe2ded9, roughness: 0.45, metalness: 0.05, clearcoat: 0.30, clearcoatRoughness: 0.58, side: THREE.DoubleSide }),
  new THREE.MeshPhysicalMaterial({ color: 0xe7dfd4, roughness: 0.48, metalness: 0.04, clearcoat: 0.28, clearcoatRoughness: 0.62, side: THREE.DoubleSide })
];

const loader = new OBJLoader();
const cache = new Map();
let model = null;
let fittedRadius = 150;
let activeIndex = 0;
let requestId = 0;

function disposeCurrentModel() {
  if (!model) return;
  scene.remove(model);
  model = null;
}

function fitModel(object) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.sub(center);
  object.updateMatrixWorld(true);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 310 / maxDim;
  object.scale.setScalar(scale);
  object.updateMatrixWorld(true);

  const newBox = new THREE.Box3().setFromObject(object);
  const sphere = newBox.getBoundingSphere(new THREE.Sphere());
  fittedRadius = sphere.radius || 150;

  controls.target.set(0, 0, 0);
  camera.position.set(0, fittedRadius * 0.10, fittedRadius * 3.15);
  controls.minDistance = fittedRadius * 1.15;
  controls.maxDistance = fittedRadius * 6;
  controls.autoRotate = true;
  controls.update();
}

function prepareModel(obj, index) {
  const clone = obj.clone(true);
  clone.traverse((child) => {
    if (child.isMesh) {
      child.material = materials[index];
      child.castShadow = false;
      child.receiveShadow = false;
    }
  });
  return clone;
}

function updateCopy(index) {
  const item = models[index];
  modelKicker.textContent = item.kicker;
  modelTitle.textContent = item.title;
  modelIntro.textContent = item.intro;
  modelBody.textContent = item.body;
  viewerLabel.textContent = item.label;
  pendingBlock.hidden = item.peony;
  manchuBlock.hidden = !item.peony;
  peonyHotspots.hidden = !item.peony;
  document.querySelectorAll('.archive-tab').forEach((button, i) => button.classList.toggle('active', i === index));
}

function showModel(index) {
  activeIndex = index;
  updateCopy(index);
  closeNote();
  const item = models[index];
  loading.textContent = `Loading ${item.title}…`;
  loading.classList.remove('hidden');
  const thisRequest = ++requestId;

  const useLoaded = (source) => {
    if (thisRequest !== requestId) return;
    disposeCurrentModel();
    model = prepareModel(source, index);
    scene.add(model);
    fitModel(model);
    loading.classList.add('hidden');
  };

  if (cache.has(item.file)) {
    useLoaded(cache.get(item.file));
    return;
  }

  loader.load(
    item.file,
    (obj) => {
      cache.set(item.file, obj);
      useLoaded(obj);
    },
    undefined,
    (error) => {
      if (thisRequest !== requestId) return;
      console.error(error);
      loading.textContent = 'The 3D model could not be loaded. Please refresh the page.';
    }
  );
}

function resizeViewer() {
  const rect = viewer.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

new ResizeObserver(resizeViewer).observe(viewer);
resizeViewer();

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

renderer.domElement.addEventListener('pointerdown', () => {
  controls.autoRotate = false;
});

document.querySelector('#resetView').addEventListener('click', () => {
  if (!model) return;
  controls.target.set(0, 0, 0);
  camera.position.set(0, fittedRadius * 0.10, fittedRadius * 3.15);
  controls.autoRotate = true;
  controls.update();
});

document.querySelectorAll('.archive-tab').forEach((button) => {
  button.addEventListener('click', () => showModel(Number(button.dataset.model)));
});

document.querySelectorAll('.model-jump').forEach((button) => {
  button.addEventListener('click', () => {
    showModel(Number(button.dataset.model));
    document.querySelector('#archive').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

const notes = {
  symbol: {
    index: '01 / SYMBOL',
    title: 'Peony',
    text: 'In Qing decorative art, the peony represents prosperity, honour and beauty, appearing on everything from embroidered robes to porcelain.',
    manchu: false
  },
  freedom: {
    index: '02 / REINTERPRETATION',
    title: 'Freedom of self-expression',
    text: 'Here the peony becomes a symbol of a woman’s freedom to express herself. Just as the peony opens in its own way, she chooses how to carry her emotions.',
    manchu: false
  },
  inscription: {
    index: '03 / INSCRIPTION',
    title: 'Follow your heart',
    text: 'The design incorporates the Manchu phrase ᡤᡳᠶᠠᠨ ᠮᡠᠵᡳᠯᡝᠨ — “Follow your heart.”',
    manchu: true
  },
  'why-skin': {
    index: 'WHY THE SKIN?',
    title: 'Why the skin?',
    text: 'Across cultures, tattoos have marked transitions, belonging and identity. Among the Li people of Hainan, women’s tattoos once signalled adulthood and were believed to allow ancestors to recognise them after death. Contemporary research also describes tattooing as a way of reclaiming authorship over the body — through self-expression, emotional regulation and regained control. A tattoo is not a cure. But it can give a feeling a lasting form, one chosen by the wearer. That is the idea we carry into our imagined past.',
    manchu: false
  }
};

const panel = document.querySelector('#notePanel');
const backdrop = document.querySelector('#panelBackdrop');
const noteIndex = document.querySelector('#noteIndex');
const noteTitle = document.querySelector('#noteTitle');
const noteText = document.querySelector('#noteText');
const noteManchu = document.querySelector('#noteManchu');

function openNote(key) {
  const note = notes[key];
  if (!note) return;
  noteIndex.textContent = note.index;
  noteTitle.textContent = note.title;
  noteText.textContent = note.text;
  noteManchu.hidden = !note.manchu;
  panel.classList.add('open');
  backdrop.classList.add('open');
  panel.setAttribute('aria-hidden', 'false');
  document.body.classList.add('panel-open');
}

function closeNote() {
  panel.classList.remove('open');
  backdrop.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('panel-open');
}

document.querySelectorAll('[data-note]').forEach((button) => {
  button.addEventListener('click', () => openNote(button.dataset.note));
});

document.querySelector('#noteClose').addEventListener('click', closeNote);
backdrop.addEventListener('click', closeNote);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeNote();
  if (event.key === 'ArrowLeft') showModel((activeIndex + models.length - 1) % models.length);
  if (event.key === 'ArrowRight') showModel((activeIndex + 1) % models.length);
});

showModel(0);


// v4 — Mark & Form. Browser translation of the Processing interaction.
const markCanvas = document.querySelector('#markFormCanvas');
const markStage = document.querySelector('.mark-form-stage');
const markReset = document.querySelector('#markFormReset');

if (markCanvas && markStage) {
  const ctx = markCanvas.getContext('2d');
  const overlay = document.createElement('canvas');
  const overlayCtx = overlay.getContext('2d');
  const clothed = new Image();
  const tattooed = new Image();
  clothed.src = './images/mark-form-clothed.jpg';
  tattooed.src = './images/mark-form-tattoo.jpg';

  const points = [];
  const lifetime = 5000;
  const fadeStart = 4000;
  const brushRadius = 58;
  let imagesReady = 0;
  let raf = null;

  function ready() {
    imagesReady += 1;
    if (imagesReady === 2) {
      markCanvas.width = clothed.naturalWidth;
      markCanvas.height = clothed.naturalHeight;
      overlay.width = markCanvas.width;
      overlay.height = markCanvas.height;
      renderMarkForm(performance.now());
    }
  }
  clothed.addEventListener('load', ready);
  tattooed.addEventListener('load', ready);

  function renderMarkForm(now) {
    if (imagesReady < 2) return;
    for (let i = points.length - 1; i >= 0; i--) {
      if (now - points[i].born > lifetime) points.splice(i, 1);
    }

    ctx.clearRect(0, 0, markCanvas.width, markCanvas.height);
    ctx.drawImage(tattooed, 0, 0, markCanvas.width, markCanvas.height);

    overlayCtx.clearRect(0, 0, overlay.width, overlay.height);
    overlayCtx.globalCompositeOperation = 'source-over';
    overlayCtx.globalAlpha = 1;
    overlayCtx.drawImage(clothed, 0, 0, overlay.width, overlay.height);

    for (const p of points) {
      const age = now - p.born;
      let eraseStrength = 1;
      if (age > fadeStart) eraseStrength = Math.max(0, 1 - (age - fadeStart) / (lifetime - fadeStart));
      overlayCtx.save();
      overlayCtx.globalCompositeOperation = 'destination-out';
      overlayCtx.globalAlpha = eraseStrength;
      const gradient = overlayCtx.createRadialGradient(p.x, p.y, brushRadius * .55, p.x, p.y, brushRadius);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      overlayCtx.fillStyle = gradient;
      overlayCtx.beginPath();
      overlayCtx.arc(p.x, p.y, brushRadius, 0, Math.PI * 2);
      overlayCtx.fill();
      overlayCtx.restore();
    }
    overlayCtx.globalCompositeOperation = 'source-over';
    overlayCtx.globalAlpha = 1;
    ctx.drawImage(overlay, 0, 0);

    if (points.length) raf = requestAnimationFrame(renderMarkForm);
    else raf = null;
  }

  function addPoint(clientX, clientY) {
    if (imagesReady < 2) return;
    const rect = markCanvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (markCanvas.width / rect.width);
    const y = (clientY - rect.top) * (markCanvas.height / rect.height);
    points.push({ x, y, born: performance.now() });
    if (points.length > 650) points.splice(0, points.length - 650);
    markStage.classList.add('engaged');
    if (!raf) raf = requestAnimationFrame(renderMarkForm);
  }

  let drawing = false;
  markCanvas.addEventListener('pointerdown', (event) => {
    drawing = true;
    markCanvas.setPointerCapture?.(event.pointerId);
    addPoint(event.clientX, event.clientY);
  });
  markCanvas.addEventListener('pointermove', (event) => {
    const canHoverDraw = event.pointerType === 'mouse';
    if (drawing || canHoverDraw) addPoint(event.clientX, event.clientY);
  });
  markCanvas.addEventListener('pointerup', () => { drawing = false; });
  markCanvas.addEventListener('pointercancel', () => { drawing = false; });
  markCanvas.addEventListener('pointerleave', () => { drawing = false; });

  markReset?.addEventListener('click', () => {
    points.length = 0;
    markStage.classList.remove('engaged');
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    renderMarkForm(performance.now());
  });
}


// v6 — restrained hero parallax and interactive brush cursor
const hero = document.querySelector('.hero');
const heroImage = document.querySelector('.hero-image');
if (hero && heroImage && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const rect = hero.getBoundingClientRect();
    const nx = ((event.clientX - rect.left) / rect.width - 0.5);
    const ny = ((event.clientY - rect.top) / rect.height - 0.5);
    heroImage.style.setProperty('--hero-x', `${nx * 14}px`);
    heroImage.style.setProperty('--hero-y', `${ny * 10}px`);
  });
  hero.addEventListener('pointerleave', () => {
    heroImage.style.setProperty('--hero-x', '0px');
    heroImage.style.setProperty('--hero-y', '0px');
  });
}

const markCursor = document.querySelector('#markFormCursor');
if (markCanvas && markStage && markCursor) {
  markCanvas.addEventListener('pointermove', (event) => {
    const rect = markStage.getBoundingClientRect();
    markCursor.style.left = `${event.clientX - rect.left}px`;
    markCursor.style.top = `${event.clientY - rect.top}px`;
  });
}
