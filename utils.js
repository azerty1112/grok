'use strict';

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim();
}

function formatDuration(ms) {
  const s = Math.floor(ms/1000);
  const min = Math.floor(s/60);
  const sec = s%60;
  return `${min}:${sec.toString().padStart(2,'0')}`;
}

module.exports = { pickRandom, sanitizeFilename, formatDuration };