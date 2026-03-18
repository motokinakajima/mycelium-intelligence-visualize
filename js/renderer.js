/**
 * renderer.js
 * Canvas 描画ロジック
 */

let CELL_SIZE = 40;

/** CELL_SIZE を変更する */
export function setCellSize(size) {
  CELL_SIZE = size;
}

/** 現在の CELL_SIZE を取得する */
export function getCellSize() {
  return CELL_SIZE;
}

/**
 * エッジ重み (w) を菌糸っぽいオレンジ〜褐色に変換
 * @param {number} w
 * @returns {string} CSS rgb()
 */
function weightToColor(w) {
  const t = Math.min(w / 3.0, 1.0);
  const r = Math.round(220 + (139 - 220) * t);
  const g = Math.round(180 + (90  - 180) * t);
  const b = Math.round(100 + (19  - 100) * t);
  return `rgb(${r},${g},${b})`;
}

/**
 * ノードの栄養値を取得（nutrition優先、なければenergy）
 * @param {Object} node
 * @returns {number}
 */
function getNutritionValue(node) {
  const nutrition = Number(node?.nutrition);
  if (Number.isFinite(nutrition)) return nutrition;
  const energy = Number(node?.energy);
  if (Number.isFinite(energy)) return energy;
  return 0;
}

/**
 * 値を 0..1 に正規化（対数スケール）
 * @param {number} value
 * @param {number} minValue
 * @param {number} maxValue
 * @returns {number}
 */
function normalizeNutrition(value, minValue, maxValue) {
  const safeValue = Math.max(0, value);
  const safeMin = Math.max(0, minValue);
  const safeMax = Math.max(safeMin + 1e-9, maxValue);
  const denom = Math.log1p(safeMax) - Math.log1p(safeMin);
  if (denom <= 1e-9) return 0.5;
  const t = (Math.log1p(safeValue) - Math.log1p(safeMin)) / denom;
  return Math.min(1, Math.max(0, t));
}

/**
 * 点と線分の最短距離の2乗を返す
 * @param {number} px
 * @param {number} py
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
function pointToSegmentDistanceSq(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    const sx = px - x1;
    const sy = py - y1;
    return sx * sx + sy * sy;
  }

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const ox = px - cx;
  const oy = py - cy;
  return ox * ox + oy * oy;
}

/**
 * マウス座標に最も近いエッジを返す
 * @param {Array} nodes step.nodes
 * @param {number} x canvas座標
 * @param {number} y canvas座標
 * @param {number} tolerancePx 許容距離(px)
 * @returns {Object|null}
 */
export function findEdgeAtPosition(nodes, x, y, tolerancePx = 8) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const maxDistSq = tolerancePx * tolerancePx;
  let best = null;
  let bestDistSq = Number.POSITIVE_INFINITY;

  for (const node of nodes) {
    if (!node.edges) continue;
    for (const edge of node.edges) {
      const target = nodeMap.get(edge.to);
      if (!target) continue;

      const x1 = node.x * CELL_SIZE;
      const y1 = node.y * CELL_SIZE;
      const x2 = target.x * CELL_SIZE;
      const y2 = target.y * CELL_SIZE;
      const distSq = pointToSegmentDistanceSq(x, y, x1, y1, x2, y2);

      if (distSq <= maxDistSq && distSq < bestDistSq) {
        bestDistSq = distSq;
        best = {
          from: node.id,
          to: edge.to,
          w: edge.w,
          x1,
          y1,
          x2,
          y2,
          midX: (x1 + x2) / 2,
          midY: (y1 + y2) / 2
        };
      }
    }
  }

  return best;
}

/**
 * 迷路の背景を描画する（Canvas サイズも必要に応じてリサイズ）
 * @param {HTMLCanvasElement} canvas
 * @param {Object} maze  { width, height, grid }
 */
export function drawMaze(canvas, maze) {
  canvas.width  = maze.width  * CELL_SIZE;
  canvas.height = maze.height * CELL_SIZE;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < maze.height; row++) {
    for (let col = 0; col < maze.width; col++) {
      const isWall = maze.grid[row][col] === 1;
      ctx.fillStyle = isWall ? '#2a2a2a' : '#f5f0e8';
      ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }

  // Entry highlight (col=1, row=1)
  ctx.fillStyle = 'rgba(100, 220, 100, 0.30)';
  ctx.fillRect(1 * CELL_SIZE, 1 * CELL_SIZE, CELL_SIZE, CELL_SIZE);

  // Exit highlight (col=W-2, row=H-2)
  ctx.fillStyle = 'rgba(220, 80, 80, 0.30)';
  ctx.fillRect((maze.width - 2) * CELL_SIZE, (maze.height - 2) * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

/**
 * 指定ステップのノード・エッジを描画する
 * @param {HTMLCanvasElement} canvas
 * @param {Object} maze
 * @param {Array}  nodes  step.nodes
 * @param {Object} options
 */
export function drawStep(canvas, maze, nodes, options = {}) {
  const ctx = canvas.getContext('2d');
  const hoveredEdge = options.hoveredEdge || null;
  const lineWidthScale = Number.isFinite(options.lineWidthScale) ? options.lineWidthScale : 1;
  const glowScale = Number.isFinite(options.glowScale) ? options.glowScale : 1;

  // 1. 迷路背景
  drawMaze(canvas, maze);

  // ノード ID → ノードオブジェクトのマップを作る（高速ルックアップ用）
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const values = nodes.map(getNutritionValue);
  const localMin = values.length > 0 ? Math.min(...values) : 0;
  const localMax = values.length > 0 ? Math.max(...values) : 1;
  const nutritionMin = Number.isFinite(options.nutritionMin) ? options.nutritionMin : localMin;
  const nutritionMax = Number.isFinite(options.nutritionMax) ? options.nutritionMax : localMax;

  // 2. エッジ（ノードより下）
  let hoveredEdgeDrawn = false;
  for (const node of nodes) {
    if (!node.edges) continue;
    for (const edge of node.edges) {
      const target = nodeMap.get(edge.to);
      if (!target) continue;

      const isHovered = Boolean(
        hoveredEdge
        && hoveredEdge.from === node.id
        && hoveredEdge.to === edge.to
      );

      ctx.strokeStyle = weightToColor(edge.w);
      ctx.lineWidth = Math.min(edge.w * 3 * lineWidthScale, 8 * lineWidthScale) + (isHovered ? 2.5 * lineWidthScale : 0);
      ctx.lineCap = 'round';
      if (isHovered) {
        hoveredEdgeDrawn = true;
        ctx.shadowColor = 'rgba(255, 245, 180, 0.9)';
        ctx.shadowBlur = Math.round(10 * glowScale);
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.moveTo(node.x * CELL_SIZE, node.y * CELL_SIZE);
      ctx.lineTo(target.x * CELL_SIZE, target.y * CELL_SIZE);
      ctx.stroke();
    }
  }
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // 3. ノード（エッジの上）
  for (const node of nodes) {
    const cx = node.x * CELL_SIZE;
    const cy = node.y * CELL_SIZE;
    const nutrition = getNutritionValue(node);
    const t = normalizeNutrition(nutrition, nutritionMin, nutritionMax);
    const isSource = Boolean(node.source);

    const glowRadius = 7 + t * (CELL_SIZE * 0.7);
    const coreRadius = (3 + t * 3) * glowScale;
    const glowAlpha = 0.18 + t * 0.42;

    const glowColor = isSource
      ? `rgba(120, 235, 140, ${glowAlpha.toFixed(3)})`
      : `rgba(255, 210, 120, ${glowAlpha.toFixed(3)})`;

    const gradient = ctx.createRadialGradient(cx, cy, coreRadius * 0.3, cx, cy, glowRadius);
    gradient.addColorStop(0, glowColor);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isSource ? '#8ee6a0' : '#e8c87a';
    ctx.strokeStyle = isSource ? '#2f7a44' : '#8b5e1a';
    ctx.lineWidth = 1.5 * glowScale;
    ctx.beginPath();
    ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const label = `${nutrition.toFixed(1)}`;
    const fontSize = Math.max(9, Math.round(CELL_SIZE * 0.22));
    ctx.font = `${fontSize}px Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineWidth = 2 * glowScale;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.strokeText(label, cx, cy + coreRadius + 2 * glowScale);
    ctx.fillStyle = '#f4f6ea';
    ctx.fillText(label, cx, cy + coreRadius + 2 * glowScale);
  }

  if (hoveredEdge && hoveredEdgeDrawn) {
    const tipX = Number.isFinite(options.hoverX) ? options.hoverX + 10 : hoveredEdge.midX + 8;
    const tipY = Number.isFinite(options.hoverY) ? options.hoverY - 20 : hoveredEdge.midY - 10;
    const text = `w: ${Number(hoveredEdge.w).toFixed(4)}`;
    const fontSize = Math.max(10, Math.round(CELL_SIZE * 0.25));

    ctx.font = `${fontSize}px Segoe UI, sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const padX = Math.max(6, Math.round(6 * glowScale));
    const boxH = fontSize + Math.round(8 * glowScale);
    const boxW = textWidth + padX * 2;
    const x = Math.max(2, Math.min(canvas.width - boxW - 2, tipX));
    const y = Math.max(2, Math.min(canvas.height - boxH - 2, tipY));

    ctx.fillStyle = 'rgba(18, 24, 30, 0.85)';
    ctx.strokeStyle = 'rgba(255, 220, 140, 0.9)';
    ctx.lineWidth = Math.max(1, glowScale);
    ctx.beginPath();
    ctx.rect(x, y, boxW, boxH);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffe7b0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padX, y + boxH / 2 + 0.5);
  }
}

/**
 * ステップの統計情報を計算して返す
 * @param {Array} nodes
 * @returns {{ nodeCount: number, edgeCount: number, maxWeight: number, nutritionMin: number, nutritionAvg: number, nutritionMax: number }}
 */
export function computeStats(nodes) {
  let edgeCount = 0;
  let maxWeight = 0;
  let nutritionMin = Number.POSITIVE_INFINITY;
  let nutritionMax = Number.NEGATIVE_INFINITY;
  let nutritionSum = 0;

  for (const node of nodes) {
    const nutrition = getNutritionValue(node);
    nutritionMin = Math.min(nutritionMin, nutrition);
    nutritionMax = Math.max(nutritionMax, nutrition);
    nutritionSum += nutrition;

    if (!node.edges) continue;
    edgeCount += node.edges.length;
    for (const e of node.edges) {
      if (e.w > maxWeight) maxWeight = e.w;
    }
  }

  if (nodes.length === 0) {
    nutritionMin = 0;
    nutritionMax = 0;
  }

  const nutritionAvg = nodes.length > 0 ? nutritionSum / nodes.length : 0;

  return { nodeCount: nodes.length, edgeCount, maxWeight, nutritionMin, nutritionAvg, nutritionMax };
}

/**
 * 高解像度 PNG としてキャンバスをキャプチャ＆ダウンロード
 * @param {Object} maze
 * @param {Array} nodes
 * @param {Object} options { nutritionMin, nutritionMax, hoveredEdge, hoverX, hoverY }
 * @param {number} scale 倍率（デフォルト 3 = 3倍高品質）
 * @param {number} tickNumber 現在のティック番号
 */
export function captureAndDownloadScreenshot(maze, nodes, options = {}, scale = 3, tickNumber = 0) {
  const originalCellSize = CELL_SIZE;
  const newCellSize = originalCellSize * scale;
  CELL_SIZE = newCellSize;

  const screenshotCanvas = document.createElement('canvas');
  screenshotCanvas.width = maze.width * newCellSize;
  screenshotCanvas.height = maze.height * newCellSize;

  const screenshotOptions = {
    ...options,
    lineWidthScale: scale,
    glowScale: scale
  };

  drawStep(screenshotCanvas, maze, nodes, screenshotOptions);

  CELL_SIZE = originalCellSize;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const filename = `mycelium-tick-${tickNumber}-${timestamp}.png`;

  screenshotCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 'image/png', 1.0);
}
