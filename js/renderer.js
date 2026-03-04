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

  // Entry highlight (col=0, row=1)
  ctx.fillStyle = 'rgba(100, 220, 100, 0.30)';
  ctx.fillRect(0, 1 * CELL_SIZE, CELL_SIZE, CELL_SIZE);

  // Exit highlight (col=W-1, row=H-2)
  ctx.fillStyle = 'rgba(220, 80, 80, 0.30)';
  ctx.fillRect((maze.width - 1) * CELL_SIZE, (maze.height - 2) * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

/**
 * 指定ステップのノード・エッジを描画する
 * @param {HTMLCanvasElement} canvas
 * @param {Object} maze
 * @param {Array}  nodes  step.nodes
 */
export function drawStep(canvas, maze, nodes) {
  const ctx = canvas.getContext('2d');

  // 1. 迷路背景
  drawMaze(canvas, maze);

  // ノード ID → ノードオブジェクトのマップを作る（高速ルックアップ用）
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // 2. エッジ（ノードより下）
  for (const node of nodes) {
    if (!node.edges) continue;
    for (const edge of node.edges) {
      const target = nodeMap.get(edge.to);
      if (!target) continue;

      ctx.strokeStyle = weightToColor(edge.w);
      ctx.lineWidth   = Math.min(edge.w * 3, 8);
      ctx.lineCap     = 'round';

      ctx.beginPath();
      ctx.moveTo(node.x * CELL_SIZE, node.y * CELL_SIZE);
      ctx.lineTo(target.x * CELL_SIZE, target.y * CELL_SIZE);
      ctx.stroke();
    }
  }

  // 3. ノード（エッジの上）
  for (const node of nodes) {
    const cx = node.x * CELL_SIZE;
    const cy = node.y * CELL_SIZE;

    ctx.fillStyle   = '#e8c87a';
    ctx.strokeStyle = '#8b5e1a';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * ステップの統計情報を計算して返す
 * @param {Array} nodes
 * @returns {{ nodeCount: number, edgeCount: number, maxWeight: number }}
 */
export function computeStats(nodes) {
  let edgeCount = 0;
  let maxWeight = 0;
  for (const node of nodes) {
    if (!node.edges) continue;
    edgeCount += node.edges.length;
    for (const e of node.edges) {
      if (e.w > maxWeight) maxWeight = e.w;
    }
  }
  return { nodeCount: nodes.length, edgeCount, maxWeight };
}
