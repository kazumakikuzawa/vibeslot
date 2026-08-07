import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import './style.css';
import { SYMBOLS, SPIN_COST, STARTING_CREDITS, createSpin, evaluateSpin } from './gameLogic.js';

const canvas = document.querySelector('#scene');
const spinButton = document.querySelector('#spinButton');
const soundButton = document.querySelector('#soundButton');
const creditsNode = document.querySelector('#credits');
const winNode = document.querySelector('#lastWin');
const streakNode = document.querySelector('#streak');
const jackpotNode = document.querySelector('#jackpotValue');
const winBanner = document.querySelector('#winBanner');
const winEyebrow = document.querySelector('#winEyebrow');
const winText = document.querySelector('#winText');
const reelStage = document.querySelector('#reelStage');
const rulesDialog = document.querySelector('#rulesDialog');
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  credits: Number(localStorage.getItem('bibeslot-credits')) || STARTING_CREDITS,
  streak: 0,
  jackpot: 88888,
  spinning: false,
  sound: true,
  shake: 0,
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x08020f, 0.035);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.2, 16);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.15, 0.55, 0.15);
composer.addPass(bloom);

scene.add(new THREE.AmbientLight(0x7b4dff, 1.3));
const pinkLight = new THREE.PointLight(0xff266f, 90, 20, 1.6);
pinkLight.position.set(-7, 3, 7);
scene.add(pinkLight);
const cyanLight = new THREE.PointLight(0x20f6ff, 80, 20, 1.6);
cyanLight.position.set(7, -2, 6);
scene.add(cyanLight);

const world = new THREE.Group();
scene.add(world);

function makeSymbolTexture(symbol) {
  const size = 512;
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = size;
  textureCanvas.height = size;
  const context = textureCanvas.getContext('2d');
  const gradient = context.createRadialGradient(256, 190, 20, 256, 256, 330);
  gradient.addColorStop(0, '#29114a');
  gradient.addColorStop(0.55, '#10051e');
  gradient.addColorStop(1, '#050109');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  context.strokeStyle = symbol.color;
  context.lineWidth = 10;
  context.shadowColor = symbol.color;
  context.shadowBlur = 32;
  context.beginPath();
  context.roundRect(24, 24, 464, 464, 48);
  context.stroke();

  context.font = symbol.label.length > 2 ? '900 108px Arial Black, sans-serif' : '900 230px Arial Black, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = symbol.color;
  context.shadowBlur = 42;
  context.fillText(symbol.label, 256, 250);

  context.shadowBlur = 0;
  context.font = '700 24px Arial, sans-serif';
  context.fillStyle = '#ffffff';
  context.globalAlpha = 0.62;
  context.fillText(symbol.id.toUpperCase(), 256, 435);

  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const symbolTextures = SYMBOLS.map(makeSymbolTexture);
const reels = [];
const panelGeometry = new THREE.PlaneGeometry(2.5, 2.05);
const reelRadius = 2.3;
const step = (Math.PI * 2) / SYMBOLS.length;

function buildReel(x) {
  const reel = new THREE.Group();
  reel.position.set(x, 0.15, 0);

  SYMBOLS.forEach((symbol, index) => {
    const angle = index * step;
    const material = new THREE.MeshStandardMaterial({
      map: symbolTextures[index],
      emissive: new THREE.Color(symbol.color),
      emissiveIntensity: 0.18,
      roughness: 0.28,
      metalness: 0.32,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(panelGeometry, material);
    panel.position.set(0, -Math.sin(angle) * reelRadius, Math.cos(angle) * reelRadius);
    panel.rotation.x = angle;
    reel.add(panel);
  });

  const sideMaterial = new THREE.MeshStandardMaterial({ color: 0x170525, metalness: 0.88, roughness: 0.2 });
  for (const direction of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(reelRadius, 0.07, 10, 48), sideMaterial);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = direction * 1.32;
    reel.add(ring);
  }

  reel.userData = { start: 0, target: 0, startedAt: 0, duration: 0, active: false, symbolIndex: 0 };
  world.add(reel);
  reels.push(reel);
}

[-3.05, 0, 3.05].forEach(buildReel);

const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1b0a2b, metalness: 0.92, roughness: 0.18 });
const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0xff206e, emissive: 0xff0a62, emissiveIntensity: 2.4, metalness: 0.65, roughness: 0.2 });

function addFramePiece(width, height, x, y, material = frameMaterial) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.55), material);
  mesh.position.set(x, y, 2.48);
  world.add(mesh);
}

addFramePiece(10.55, 0.24, 0, 2.02, edgeMaterial);
addFramePiece(10.55, 0.24, 0, -1.72, edgeMaterial);
addFramePiece(0.24, 3.95, -5.16, 0.15, edgeMaterial);
addFramePiece(0.24, 3.95, 5.16, 0.15, edgeMaterial);
addFramePiece(0.12, 3.65, -1.53, 0.15, frameMaterial);
addFramePiece(0.12, 3.65, 1.53, 0.15, frameMaterial);

const halo = new THREE.Mesh(
  new THREE.TorusGeometry(8.2, 0.035, 8, 160),
  new THREE.MeshBasicMaterial({ color: 0x7d37ff }),
);
halo.position.z = -2;
halo.scale.y = 0.7;
scene.add(halo);

const particleCount = prefersReducedMotion ? 180 : 620;
const particlePositions = new Float32Array(particleCount * 3);
for (let index = 0; index < particleCount; index += 1) {
  particlePositions[index * 3] = (Math.random() - 0.5) * 32;
  particlePositions[index * 3 + 1] = (Math.random() - 0.5) * 22;
  particlePositions[index * 3 + 2] = (Math.random() - 0.5) * 18 - 4;
}
const particleGeometry = new THREE.BufferGeometry();
particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
const particles = new THREE.Points(
  particleGeometry,
  new THREE.PointsMaterial({ color: 0xf2ccff, size: 0.035, transparent: true, opacity: 0.72 }),
);
scene.add(particles);

const sparks = [];
const clock = new THREE.Clock();
let audioContext;

function playTone(frequency, duration = 0.1, type = 'sine', volume = 0.045, delay = 0) {
  if (!state.sound) return;
  audioContext ??= new AudioContext();
  const start = audioContext.currentTime + delay;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency * 1.15), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function burst(color, amount = 80) {
  if (prefersReducedMotion) return;
  const material = new THREE.MeshBasicMaterial({ color });
  for (let index = 0; index < amount; index += 1) {
    const spark = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.04), material);
    spark.position.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 1.2, 3.2);
    spark.rotation.z = Math.random() * Math.PI;
    spark.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 0.17, Math.random() * 0.15 + 0.04, (Math.random() - 0.5) * 0.08);
    spark.userData.life = 1;
    scene.add(spark);
    sparks.push(spark);
  }
}

function format(value) {
  return Math.round(value).toLocaleString('ja-JP');
}

function updateHud() {
  creditsNode.textContent = format(state.credits);
  streakNode.textContent = state.streak;
  jackpotNode.textContent = format(state.jackpot);
  localStorage.setItem('bibeslot-credits', String(state.credits));
}

function animateNumber(node, from, to, duration = 650) {
  const startedAt = performance.now();
  function tick(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - (1 - progress) ** 3;
    node.textContent = format(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function positiveModulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function spinReel(reel, symbolIndex, reelIndex) {
  const current = reel.rotation.x;
  const desiredModulo = positiveModulo(-symbolIndex * step, Math.PI * 2);
  const currentModulo = positiveModulo(current, Math.PI * 2);
  const correction = positiveModulo(desiredModulo - currentModulo, Math.PI * 2);
  reel.userData = {
    ...reel.userData,
    start: current,
    target: current + (4 + reelIndex) * Math.PI * 2 + correction,
    startedAt: performance.now() + reelIndex * 240,
    duration: (prefersReducedMotion ? 500 : 1450) + reelIndex * 360,
    active: true,
    symbolIndex,
  };
}

function waitForReels() {
  return new Promise((resolve) => {
    const poll = () => (reels.some((reel) => reel.userData.active) ? requestAnimationFrame(poll) : resolve());
    poll();
  });
}

async function spin() {
  if (state.spinning) return;
  if (state.credits < SPIN_COST) {
    state.credits = STARTING_CREDITS;
    winEyebrow.textContent = 'FREE REFILL';
    winText.textContent = '1,000 CREDITS';
    updateHud();
    playTone(480, 0.18, 'triangle');
    return;
  }

  state.spinning = true;
  state.credits -= SPIN_COST;
  state.jackpot += 7;
  spinButton.disabled = true;
  reelStage.classList.add('is-spinning');
  winBanner.className = 'win-banner';
  winEyebrow.textContent = 'GOOD LUCK';
  winText.textContent = 'LIGHTS IN MOTION';
  updateHud();

  const outcome = createSpin();
  outcome.forEach((symbol, index) => spinReel(reels[index], SYMBOLS.indexOf(symbol), index));
  [110, 146, 184].forEach((frequency, index) => playTone(frequency, 0.8, 'sawtooth', 0.022, index * 0.24));

  await waitForReels();
  reelStage.classList.remove('is-spinning');
  outcome.forEach((symbol, index) => {
    document.querySelector(`#reel${index}`).textContent = symbol.label;
  });

  const result = evaluateSpin(outcome, state.streak);
  const creditsBeforeWin = state.credits;
  state.streak = result.nextStreak;
  state.credits += result.payout;
  winNode.textContent = format(result.payout);

  if (result.payout > 0) {
    winBanner.classList.add('show', result.tier);
    winEyebrow.textContent = result.tier === 'jackpot' ? 'MEGA JACKPOT' : result.multiplier > 1 ? `STREAK ×${result.multiplier}` : 'WINNER';
    winText.textContent = `+${format(result.payout)} CREDITS`;
    animateNumber(creditsNode, creditsBeforeWin, state.credits, result.tier === 'jackpot' ? 1400 : 700);
    burst(result.tier === 'jackpot' ? 0xffd84a : 0xff2b7d, result.tier === 'jackpot' ? 180 : 70);
    state.shake = result.tier === 'jackpot' ? 1.4 : 0.55;
    const chord = result.tier === 'jackpot' ? [392, 494, 587, 784] : [440, 554, 659];
    chord.forEach((frequency, index) => playTone(frequency, 0.34, 'triangle', 0.055, index * 0.09));
  } else {
    winEyebrow.textContent = 'SO CLOSE';
    winText.textContent = outcome[0].id === outcome[1].id || outcome[1].id === outcome[2].id ? 'ONE LIGHT AWAY' : 'RUN IT BACK';
    playTone(110, 0.16, 'square', 0.018);
  }

  localStorage.setItem('bibeslot-credits', String(state.credits));
  updateHud();
  state.spinning = false;
  spinButton.disabled = false;
}

function animate(now) {
  const elapsed = clock.getElapsedTime();
  halo.rotation.z = elapsed * 0.08;
  particles.rotation.y = elapsed * 0.018;
  particles.position.y = Math.sin(elapsed * 0.25) * 0.25;
  pinkLight.intensity = 75 + Math.sin(elapsed * 2.1) * 18;
  cyanLight.intensity = 70 + Math.cos(elapsed * 1.7) * 15;

  reels.forEach((reel, index) => {
    if (!reel.userData.active || now < reel.userData.startedAt) return;
    const progress = Math.min((now - reel.userData.startedAt) / reel.userData.duration, 1);
    const eased = 1 - (1 - progress) ** 4;
    reel.rotation.x = THREE.MathUtils.lerp(reel.userData.start, reel.userData.target, eased);
    if (progress >= 1) {
      reel.rotation.x = positiveModulo(reel.userData.target, Math.PI * 2);
      reel.userData.active = false;
      playTone(180 + index * 55, 0.08, 'square', 0.035);
      state.shake = 0.16;
    }
  });

  for (let index = sparks.length - 1; index >= 0; index -= 1) {
    const spark = sparks[index];
    spark.position.add(spark.userData.velocity);
    spark.userData.velocity.y -= 0.0035;
    spark.rotation.x += 0.08;
    spark.userData.life -= 0.012;
    spark.scale.setScalar(Math.max(0, spark.userData.life));
    if (spark.userData.life <= 0) {
      scene.remove(spark);
      spark.geometry.dispose();
      sparks.splice(index, 1);
    }
  }

  if (state.shake > 0.01 && !prefersReducedMotion) {
    camera.position.x = (Math.random() - 0.5) * state.shake * 0.12;
    camera.position.y = 0.2 + (Math.random() - 0.5) * state.shake * 0.08;
    state.shake *= 0.9;
  } else {
    camera.position.x *= 0.86;
    camera.position.y += (0.2 - camera.position.y) * 0.14;
  }

  composer.render();
  requestAnimationFrame(animate);
}

function resize() {
  const width = innerWidth;
  const height = innerHeight;
  camera.aspect = width / height;
  camera.position.z = width < 700 ? 21.5 : width < 1050 ? 18.5 : 16;
  world.scale.setScalar(width < 700 ? 0.82 : 1);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
  composer.setSize(width, height);
}

spinButton.addEventListener('click', spin);
soundButton.addEventListener('click', () => {
  state.sound = !state.sound;
  soundButton.setAttribute('aria-pressed', String(state.sound));
  soundButton.textContent = state.sound ? '♪' : '×';
  if (state.sound) playTone(440, 0.1, 'sine');
});
document.querySelector('#rulesButton').addEventListener('click', () => rulesDialog.showModal());
addEventListener('keydown', (event) => {
  if (event.code === 'Space' && !rulesDialog.open && event.target.tagName !== 'BUTTON') {
    event.preventDefault();
    spin();
  }
});
addEventListener('resize', resize);

updateHud();
resize();
requestAnimationFrame(animate);
