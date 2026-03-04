/**
 * loader.js
 * JSON ファイルの読み込みとパース
 */

/**
 * File オブジェクト（<input type="file">）から sim_output.json をパースして返す
 * @param {File} file
 * @returns {Promise<Object>} simData
 */
export function loadFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        validateSimData(data);
        resolve(data);
      } catch (err) {
        reject(new Error(`JSON parse error: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsText(file);
  });
}

/**
 * URL から sim_output.json を fetch してパースして返す
 * @param {string} url
 * @returns {Promise<Object>} simData
 */
export async function loadFromUrl(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  validateSimData(data);
  return data;
}

/**
 * 最低限のバリデーション
 * @param {Object} data
 */
function validateSimData(data) {
  if (!data.maze) throw new Error('missing maze field');
  if (!Array.isArray(data.maze.grid)) throw new Error('missing maze.grid');
  if (!Array.isArray(data.steps)) throw new Error('missing steps field');
}
