import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import './style.css';
import { SYMBOLS, SPIN_COST, STARTING_CREDITS, createCoinTimeline, createGridSpin, evaluateGridSpin } from './gameLogic.js';

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
const slotGrid = document.querySelector('#slotGrid');
const slotGridWrap = document.querySelector('#slotGridWrap');
const winLines = document.querySelector('#winLines');
const coinRain = document.querySelector('#coinRain');
const rulesDialog = document.querySelector('#rulesDialog');
const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const state = {
  credits: Number(localStorage.getItem('vibeslot-credits')) || STARTING_CREDITS,
  streak: 0,
  jackpot: 88888,
  spinning: false,
  sound: true,
  shake: 0,
  bgmStarted: false,
};

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020611, 0.028);

const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0, 0.2, 16);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.58, 0.42, 0.52);
composer.addPass(bloom);

scene.add(new THREE.AmbientLight(0x263968, 1.05));
const blueLight = new THREE.PointLight(0x365dff, 34, 22, 1.8);
blueLight.position.set(-7, 4, 5);
scene.add(blueLight);
const cyanLight = new THREE.PointLight(0x39dff5, 28, 20, 1.8);
cyanLight.position.set(7, -2, 5);
scene.add(cyanLight);
const violetLight = new THREE.PointLight(0x7a45d8, 18, 24, 2);
violetLight.position.set(0, 6, -2);
scene.add(violetLight);

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
      emissive: new THREE.Color(0xffffff),
      emissiveMap: symbolTextures[index],
      emissiveIntensity: 0.52,
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
const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x263d9e, emissive: 0x4f6cff, emissiveIntensity: 0.9, metalness: 0.72, roughness: 0.24 });

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
world.visible = false;

const halo = new THREE.Mesh(
  new THREE.TorusGeometry(8.2, 0.035, 8, 160),
  new THREE.MeshBasicMaterial({ color: 0x5668ff, transparent: true, opacity: 0.52 }),
);
halo.position.z = -3;
halo.scale.y = 0.7;
scene.add(halo);

function makeNebulaTexture(innerColor, outerColor) {
  const nebulaCanvas = document.createElement('canvas');
  nebulaCanvas.width = 1024;
  nebulaCanvas.height = 512;
  const context = nebulaCanvas.getContext('2d');
  const gradient = context.createRadialGradient(512, 256, 8, 512, 256, 490);
  gradient.addColorStop(0, innerColor);
  gradient.addColorStop(0.28, outerColor);
  gradient.addColorStop(0.72, 'rgba(16, 28, 84, 0.08)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 512);
  return new THREE.CanvasTexture(nebulaCanvas);
}

function addNebula(x, y, z, scale, texture, opacity) {
  const nebula = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  nebula.position.set(x, y, z);
  nebula.scale.set(scale, scale * 0.48, 1);
  scene.add(nebula);
  return nebula;
}

const blueNebula = addNebula(-5.5, 2.8, -8, 19, makeNebulaTexture('rgba(45, 105, 255, 0.52)', 'rgba(33, 52, 150, 0.3)'), 0.36);
const violetNebula = addNebula(6, -3.5, -9, 17, makeNebulaTexture('rgba(132, 69, 255, 0.42)', 'rgba(59, 32, 132, 0.24)'), 0.3);

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
  new THREE.PointsMaterial({ color: 0xd9e8ff, size: 0.032, transparent: true, opacity: 0.82 }),
);
scene.add(particles);

const sparks = [];
const clock = new THREE.Clock();
let audioContext;
let bgmTimer;

const gridCells = Array.from({ length: 20 }, (_, index) => {
  const cell = document.createElement('div');
  cell.className = 'slot-cell';
  cell.dataset.index = index;
  cell.innerHTML = '<span class="cell-symbol"></span><small></small><i></i>';
  slotGrid.appendChild(cell);
  return cell;
});

function setCellSymbol(cell, symbol) {
  cell.dataset.symbol = symbol.id;
  cell.style.setProperty('--symbol-color', symbol.color);
  cell.querySelector('.cell-symbol').textContent = symbol.label;
  cell.querySelector('small').textContent = symbol.id.toUpperCase();
}

gridCells.forEach((cell, index) => setCellSymbol(cell, SYMBOLS[index % SYMBOLS.length]));

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

function ensureAudio() {
  audioContext ??= new AudioContext();
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function scheduleKick(time) {
  const context = ensureAudio();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.setValueAtTime(145, time);
  oscillator.frequency.exponentialRampToValueAtTime(46, time + 0.16);
  gain.gain.setValueAtTime(0.11, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.24);
}

function scheduleHat(time, accent = false) {
  const context = ensureAudio();
  const buffer = context.createBuffer(1, context.sampleRate * 0.045, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = 'highpass';
  filter.frequency.value = 7200;
  gain.gain.setValueAtTime(accent ? 0.025 : 0.014, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(time);
}

function scheduleBass(frequency, time) {
  const context = ensureAudio();
  const oscillator = context.createOscillator();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  oscillator.type = 'sawtooth';
  oscillator.frequency.setValueAtTime(frequency, time);
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.032, time + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.21);
  oscillator.connect(filter).connect(gain).connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.23);
}

function scheduleBgmBar() {
  if (!state.sound) return;
  const context = ensureAudio();
  const start = context.currentTime + 0.06;
  const bassline = [55, 55, 65.41, 73.42, 55, 82.41, 73.42, 65.41];
  for (let stepIndex = 0; stepIndex < 8; stepIndex += 1) {
    const time = start + stepIndex * 0.24;
    if (stepIndex % 2 === 0) scheduleKick(time);
    scheduleHat(time + 0.12, stepIndex % 4 === 3);
    scheduleBass(bassline[stepIndex], time);
  }
}

function startBgm() {
  if (state.bgmStarted || !state.sound) return;
  state.bgmStarted = true;
  scheduleBgmBar();
  bgmTimer = setInterval(scheduleBgmBar, 1920);
}

function stopBgm() {
  clearInterval(bgmTimer);
  bgmTimer = undefined;
  state.bgmStarted = false;
}

function startSpinSound() {
  if (!state.sound) return () => {};
  const context = ensureAudio();
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 1.6, context.sampleRate);
  const noise = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noise.length; index += 1) noise[index] = (Math.random() * 2 - 1) * (1 - index / noise.length);
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  const motor = context.createOscillator();
  const motorGain = context.createGain();
  source.buffer = noiseBuffer;
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(520, context.currentTime);
  filter.frequency.exponentialRampToValueAtTime(1900, context.currentTime + 1.3);
  gain.gain.value = 0.026;
  motor.type = 'sawtooth';
  motor.frequency.setValueAtTime(72, context.currentTime);
  motor.frequency.linearRampToValueAtTime(118, context.currentTime + 1.2);
  motorGain.gain.value = 0.014;
  source.connect(filter).connect(gain).connect(context.destination);
  motor.connect(motorGain).connect(context.destination);
  source.start();
  motor.start();
  return () => {
    const stopAt = context.currentTime + 0.09;
    gain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    motorGain.gain.exponentialRampToValueAtTime(0.0001, stopAt);
    source.stop(stopAt + 0.02);
    motor.stop(stopAt + 0.02);
  };
}

function playCoinChime(delay, index) {
  if (!state.sound) return;
  const base = 1180 + (index % 7) * 95;
  playTone(base, 0.085, 'sine', 0.028, delay);
  playTone(base * 1.52, 0.055, 'triangle', 0.014, delay + 0.012);
}

function rainCoins(amount) {
  coinRain.replaceChildren();
  if (prefersReducedMotion) return;
  const fragment = document.createDocumentFragment();
  const timeline = createCoinTimeline(amount);
  timeline.forEach((entry) => {
    const coin = document.createElement('i');
    coin.style.setProperty('--x', `${entry.x}%`);
    coin.style.setProperty('--delay', `${entry.delay}s`);
    coin.style.setProperty('--duration', `${entry.duration}s`);
    coin.style.setProperty('--drift', `${entry.drift}px`);
    coin.textContent = '◆';
    fragment.appendChild(coin);
  });
  coinRain.appendChild(fragment);
  const chimeCount = Math.min(timeline.length, 28);
  for (let index = 0; index < chimeCount; index += 1) {
    const delay = chimeCount === 1 ? 0 : (index / (chimeCount - 1)) * 1.42;
    playCoinChime(delay, index);
  }
  setTimeout(() => coinRain.replaceChildren(), 2050);
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
  localStorage.setItem('vibeslot-credits', String(state.credits));
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

function clearGridEffects() {
  winLines.replaceChildren();
  gridCells.forEach((cell) => cell.classList.remove('winner'));
}

function animateGrid(outcome) {
  const intervals = [];
  gridCells.forEach((cell, index) => {
    cell.classList.add('rolling');
    intervals[index] = setInterval(() => {
      setCellSymbol(cell, SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
    }, 54 + (index % 3) * 7);
  });

  return Promise.all(gridCells.map((cell, index) => new Promise((resolve) => {
    const row = Math.floor(index / 5);
    const col = index % 5;
    const settleDelay = prefersReducedMotion ? 220 : 570 + col * 145 + row * 34;
    setTimeout(() => {
      clearInterval(intervals[index]);
      setCellSymbol(cell, outcome[index]);
      cell.classList.remove('rolling');
      cell.classList.add('landed');
      setTimeout(() => cell.classList.remove('landed'), 180);
      playTone(240 + col * 38 + row * 9, 0.055, 'square', 0.012);
      resolve();
    }, settleDelay);
  })));
}

function drawWinLines(wins) {
  winLines.replaceChildren();
  const wrapRect = slotGridWrap.getBoundingClientRect();
  winLines.setAttribute('viewBox', `0 0 ${wrapRect.width} ${wrapRect.height}`);

  wins.forEach((win, index) => {
    win.cells.forEach((cellIndex) => gridCells[cellIndex].classList.add('winner'));
    const firstRect = gridCells[win.cells[0]].getBoundingClientRect();
    const lastRect = gridCells[win.cells.at(-1)].getBoundingClientRect();
    const x1 = firstRect.left - wrapRect.left + firstRect.width / 2;
    const y1 = firstRect.top - wrapRect.top + firstRect.height / 2;
    const x2 = lastRect.left - wrapRect.left + lastRect.width / 2;
    const y2 = lastRect.top - wrapRect.top + lastRect.height / 2;
    const underlay = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    for (const element of [underlay, line]) {
      element.setAttribute('x1', x1);
      element.setAttribute('y1', y1);
      element.setAttribute('x2', x2);
      element.setAttribute('y2', y2);
      element.style.setProperty('--line-delay', `${index * 90}ms`);
    }
    underlay.classList.add('win-line-underlay');
    line.classList.add('win-line');
    line.setAttribute('stroke', win.symbol.color);
    winLines.append(underlay, line);
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
  startBgm();
  state.credits -= SPIN_COST;
  state.jackpot += 11;
  spinButton.disabled = true;
  reelStage.classList.add('is-spinning');
  clearGridEffects();
  winBanner.className = 'win-banner';
  winEyebrow.textContent = 'GOOD LUCK';
  winText.textContent = '20 CELLS IN MOTION';
  updateHud();

  const outcome = createGridSpin();
  const stopSpinSound = startSpinSound();
  await animateGrid(outcome);
  stopSpinSound();
  reelStage.classList.remove('is-spinning');

  const result = evaluateGridSpin(outcome, state.streak);
  const creditsBeforeWin = state.credits;
  state.streak = result.nextStreak;
  state.credits += result.payout;
  winNode.textContent = format(result.payout);

  if (result.payout > 0) {
    drawWinLines(result.wins);
    winBanner.classList.add('show', result.tier);
    winEyebrow.textContent = result.tier === 'jackpot' ? `${result.wins.length} LINE OVERDRIVE` : result.multiplier > 1 ? `STREAK ×${result.multiplier}` : `${result.wins.length} LINE HIT`;
    winText.textContent = `+${format(result.payout)} CREDITS`;
    animateNumber(creditsNode, creditsBeforeWin, state.credits, result.tier === 'jackpot' ? 1400 : 700);
    burst(result.tier === 'jackpot' ? 0xffd84a : 0xff2b7d, result.tier === 'jackpot' ? 180 : 70);
    rainCoins(result.payout);
    state.shake = result.tier === 'jackpot' ? 1.4 : 0.55;
    const chord = result.tier === 'jackpot' ? [392, 494, 587, 784] : [440, 554, 659];
    chord.forEach((frequency, index) => playTone(frequency, 0.34, 'triangle', 0.055, index * 0.09));
  } else {
    winEyebrow.textContent = 'NO LINE';
    winText.textContent = 'RUN THE MATRIX AGAIN';
    playTone(110, 0.16, 'square', 0.018);
  }

  localStorage.setItem('vibeslot-credits', String(state.credits));
  updateHud();
  state.spinning = false;
  spinButton.disabled = false;
}

function animate(now) {
  const elapsed = clock.getElapsedTime();
  halo.rotation.z = elapsed * 0.08;
  blueNebula.material.opacity = 0.33 + Math.sin(elapsed * 0.18) * 0.04;
  violetNebula.material.opacity = 0.28 + Math.cos(elapsed * 0.16) * 0.035;
  particles.rotation.y = elapsed * 0.018;
  particles.position.y = Math.sin(elapsed * 0.25) * 0.25;
  blueLight.intensity = 31 + Math.sin(elapsed * 1.1) * 4;
  cyanLight.intensity = 26 + Math.cos(elapsed * 0.9) * 3;

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
  if (state.sound) {
    playTone(440, 0.1, 'sine');
    startBgm();
  } else {
    stopBgm();
  }
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
