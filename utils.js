function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*]+/g, '_').trim();
}

module.exports = { pickRandom, sanitizeFilename };
