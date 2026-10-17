// Entry point: checks WebGL support and starts the game.
import { Game } from './game.js';

function fatal(msg) {
  const f = document.getElementById('fatal');
  document.getElementById('fatalMsg').textContent = msg;
  document.getElementById('menu').classList.add('hidden');
  f.classList.remove('hidden');
}
try {
  const c = document.createElement('canvas');
  if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw new Error('Your browser does not support WebGL. Try a recent Chrome, Edge or Firefox.');
  new Game();
} catch (e) {
  console.error(e);
  fatal(String(e.message || e));
}
