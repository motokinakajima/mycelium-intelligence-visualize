/**
 * main.js
 * エントリーポイント – UI イベント & アニメーションループ
 */

import { loadFromFile, loadFromUrl } from './loader.js';
import { drawStep, drawMaze, computeStats, setCellSize, getCellSize, findEdgeAtPosition, captureAndDownloadScreenshot } from './renderer.js';

// ── DOM refs ──────────────────────────────────────────────────────────────
const fileInput       = document.getElementById('fileInput');
const loadSampleBtn   = document.getElementById('loadSample');
const playPauseBtn    = document.getElementById('playPauseBtn');
const stepBackBtn     = document.getElementById('stepBackBtn');
const stepForwardBtn  = document.getElementById('stepForwardBtn');
const resetBtn        = document.getElementById('resetBtn');
const screenshotBtn   = document.getElementById('screenshotBtn');
const stepSlider      = document.getElementById('stepSlider');
const speedSlider     = document.getElementById('speedSlider');
const cellSizeSlider  = document.getElementById('cellSizeSlider');
const stepLabel       = document.getElementById('stepLabel');
const speedLabel      = document.getElementById('speedLabel');
const cellSizeLabel   = document.getElementById('cellSizeLabel');
const nodeCountEl     = document.getElementById('nodeCount');
const edgeCountEl     = document.getElementById('edgeCount');
const maxWeightEl     = document.getElementById('maxWeight');
const nutritionMinEl  = document.getElementById('nutritionMin');
const nutritionAvgEl  = document.getElementById('nutritionAvg');
const nutritionMaxEl  = document.getElementById('nutritionMax');
const canvas          = document.getElementById('mazeCanvas');
const canvasWrapper   = document.getElementById('canvasWrapper');
const dropOverlay     = document.getElementById('dropOverlay');

// ── State ──────────────────────────────────────────────────────────────────
let simData     = null;
let currentStep = 0;
let playing     = false;
let lastTime    = 0;
let interval    = 100; // ms
let globalNutritionRange = { min: 0, max: 1 };
let hoveredEdge = null;
let hoverMouse = { x: 0, y: 0 };

function getNodeNutrition(node) {
  const nutrition = Number(node?.nutrition);
  if (Number.isFinite(nutrition)) return nutrition;
  const energy = Number(node?.energy);
  if (Number.isFinite(energy)) return energy;
  return 0;
}

function computeGlobalNutritionRange(steps) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const step of steps) {
    for (const node of step.nodes) {
      const value = getNodeNutrition(node);
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }
  if (max <= min) {
    return { min, max: min + 1 };
  }
  return { min, max };
}

// ── Init ───────────────────────────────────────────────────────────────────

function onDataLoaded(data) {
  simData     = data;
  currentStep = 0;
  playing     = false;
  hoveredEdge = null;
  globalNutritionRange = computeGlobalNutritionRange(simData.steps);
  updatePlayPauseBtn();

  const maxStep = simData.steps.length - 1;
  stepSlider.min   = 0;
  stepSlider.max   = maxStep;
  stepSlider.value = 0;

  [playPauseBtn, stepBackBtn, stepForwardBtn, resetBtn, stepSlider].forEach(el => {
    el.disabled = false;
  });

  screenshotBtn.disabled = false;

  dropOverlay.classList.add('hidden');
  renderCurrentStep();
}

function renderCurrentStep() {
  if (!simData) return;
  const stepData = simData.steps[currentStep];
  drawStep(canvas, simData.maze, stepData.nodes, {
    nutritionMin: globalNutritionRange.min,
    nutritionMax: globalNutritionRange.max,
    hoveredEdge,
    hoverX: hoverMouse.x,
    hoverY: hoverMouse.y
  });

  const stats = computeStats(stepData.nodes);
  nodeCountEl.textContent = `Nodes: ${stats.nodeCount}`;
  edgeCountEl.textContent = `Edges: ${stats.edgeCount}`;
  maxWeightEl.textContent = `Max Weight: ${stats.maxWeight.toFixed(3)}`;
  nutritionMinEl.textContent = `Nut Min: ${stats.nutritionMin.toFixed(4)}`;
  nutritionAvgEl.textContent = `Nut Avg: ${stats.nutritionAvg.toFixed(4)}`;
  nutritionMaxEl.textContent = `Nut Max: ${stats.nutritionMax.toFixed(4)}`;

  const total = simData.steps.length - 1;
  stepLabel.textContent = `Tick: ${currentStep} / ${total}`;
  stepSlider.value      = currentStep;
}

function getCanvasMousePosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
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
  hoveredEdge = null;
  renderCurrentStep();
});

canvas.addEventListener('mousemove', (event) => {
  if (!simData) return;

  const pos = getCanvasMousePosition(event);
  hoverMouse = pos;

  const stepData = simData.steps[currentStep];
  hoveredEdge = findEdgeAtPosition(stepData.nodes, pos.x, pos.y, Math.max(6, getCellSize() * 0.18));
  canvas.style.cursor = hoveredEdge ? 'pointer' : 'default';
  renderCurrentStep();
});

canvas.addEventListener('mouseleave', () => {
  if (!simData) return;
  hoveredEdge = null;
  canvas.style.cursor = 'default';
  renderCurrentStep();
});

// Screenshot
screenshotBtn.addEventListener('click', () => {
  if (!simData) return;
  const stepData = simData.steps[currentStep];
  captureAndDownloadScreenshot(simData.maze, stepData.nodes, {
    nutritionMin: globalNutritionRange.min,
    nutritionMax: globalNutritionRange.max
  }, 3, currentStep);
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
