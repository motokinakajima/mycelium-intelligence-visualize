/**
 * main.js
 * エントリーポイント – UI イベント & アニメーションループ
 */

import { loadFromFile, loadFromUrl } from './loader.js';
import { drawStep, drawMaze, computeStats, setCellSize, getCellSize } from './renderer.js';

// ── DOM refs ──────────────────────────────────────────────────────────────
const fileInput       = document.getElementById('fileInput');
const loadSampleBtn   = document.getElementById('loadSample');
const playPauseBtn    = document.getElementById('playPauseBtn');
const stepBackBtn     = document.getElementById('stepBackBtn');
const stepForwardBtn  = document.getElementById('stepForwardBtn');
const resetBtn        = document.getElementById('resetBtn');
const stepSlider      = document.getElementById('stepSlider');
const speedSlider     = document.getElementById('speedSlider');
const cellSizeSlider  = document.getElementById('cellSizeSlider');
const stepLabel       = document.getElementById('stepLabel');
const speedLabel      = document.getElementById('speedLabel');
const cellSizeLabel   = document.getElementById('cellSizeLabel');
const nodeCountEl     = document.getElementById('nodeCount');
const edgeCountEl     = document.getElementById('edgeCount');
const maxWeightEl     = document.getElementById('maxWeight');
const canvas          = document.getElementById('mazeCanvas');
const canvasWrapper   = document.getElementById('canvasWrapper');
const dropOverlay     = document.getElementById('dropOverlay');

// ── State ──────────────────────────────────────────────────────────────────
let simData     = null;
let currentStep = 0;
let playing     = false;
let lastTime    = 0;
let interval    = 100; // ms

// ── Init ───────────────────────────────────────────────────────────────────

function onDataLoaded(data) {
  simData     = data;
  currentStep = 0;
  playing     = false;
  updatePlayPauseBtn();

  const maxStep = simData.steps.length - 1;
  stepSlider.min   = 0;
  stepSlider.max   = maxStep;
  stepSlider.value = 0;

  [playPauseBtn, stepBackBtn, stepForwardBtn, resetBtn, stepSlider].forEach(el => {
    el.disabled = false;
  });

  dropOverlay.classList.add('hidden');
  renderCurrentStep();
}

function renderCurrentStep() {
  if (!simData) return;
  const stepData = simData.steps[currentStep];
  drawStep(canvas, simData.maze, stepData.nodes);

  const stats = computeStats(stepData.nodes);
  nodeCountEl.textContent = `Nodes: ${stats.nodeCount}`;
  edgeCountEl.textContent = `Edges: ${stats.edgeCount}`;
  maxWeightEl.textContent = `Max Weight: ${stats.maxWeight.toFixed(3)}`;

  const total = simData.steps.length - 1;
  stepLabel.textContent = `Step: ${currentStep} / ${total}`;
  stepSlider.value      = currentStep;
}

function updatePlayPauseBtn() {
  if (playing) {
    playPauseBtn.textContent = '⏸ Pause';
    playPauseBtn.classList.add('playing');
  } else {
    playPauseBtn.textContent = '▶ Play';
    playPauseBtn.classList.remove('playing');
  }
}

// ── Animation loop ─────────────────────────────────────────────────────────

function loop(timestamp) {
  if (playing && simData && timestamp - lastTime >= interval) {
    lastTime = timestamp;
    renderCurrentStep();
    currentStep = (currentStep + 1) % simData.steps.length;
    // Stop at the last step automatically
    if (currentStep === 0) {
      currentStep = simData.steps.length - 1;
      playing     = false;
      updatePlayPauseBtn();
    }
  }
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ── Event listeners ────────────────────────────────────────────────────────

// File input
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = await loadFromFile(file);
    onDataLoaded(data);
  } catch (err) {
    alert(`Failed to load file: ${err.message}`);
  }
});

// Load sample
loadSampleBtn.addEventListener('click', async () => {
  try {
    const data = await loadFromUrl('sample/sim_output.json');
    onDataLoaded(data);
  } catch (err) {
    alert(`Failed to load sample: ${err.message}`);
  }
});

// Play / Pause
playPauseBtn.addEventListener('click', () => {
  if (!simData) return;
  // If we're at the last step, restart
  if (!playing && currentStep >= simData.steps.length - 1) {
    currentStep = 0;
  }
  playing = !playing;
  lastTime = performance.now();
  updatePlayPauseBtn();
});

// Step back
stepBackBtn.addEventListener('click', () => {
  if (!simData) return;
  playing     = false;
  updatePlayPauseBtn();
  currentStep = Math.max(0, currentStep - 1);
  renderCurrentStep();
});

// Step forward
stepForwardBtn.addEventListener('click', () => {
  if (!simData) return;
  playing     = false;
  updatePlayPauseBtn();
  currentStep = Math.min(simData.steps.length - 1, currentStep + 1);
  renderCurrentStep();
});

// Reset
resetBtn.addEventListener('click', () => {
  if (!simData) return;
  playing     = false;
  currentStep = 0;
  updatePlayPauseBtn();
  renderCurrentStep();
});

// Step slider
stepSlider.addEventListener('input', () => {
  if (!simData) return;
  playing     = false;
  updatePlayPauseBtn();
  currentStep = parseInt(stepSlider.value, 10);
  renderCurrentStep();
});

// Speed slider
speedSlider.addEventListener('input', () => {
  interval             = parseInt(speedSlider.value, 10);
  speedLabel.textContent = `${interval} ms`;
});

// Cell size slider
cellSizeSlider.addEventListener('input', () => {
  const size = parseInt(cellSizeSlider.value, 10);
  setCellSize(size);
  cellSizeLabel.textContent = `${size} px`;
  renderCurrentStep();
});

// ── Drag & Drop ────────────────────────────────────────────────────────────

canvasWrapper.addEventListener('dragover', (e) => {
  e.preventDefault();
  canvasWrapper.classList.add('dragover');
});

canvasWrapper.addEventListener('dragleave', () => {
  canvasWrapper.classList.remove('dragover');
});

canvasWrapper.addEventListener('drop', async (e) => {
  e.preventDefault();
  canvasWrapper.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  try {
    const data = await loadFromFile(file);
    onDataLoaded(data);
  } catch (err) {
    alert(`Failed to load file: ${err.message}`);
  }
});
