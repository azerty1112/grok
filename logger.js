'use strict';

const fs = require('fs');
const config = require('./config.json');

function log(msg) {
  const time = new Date().toISOString();
  const line = `[${time}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync(config.LOG_FILE, line);
}

function logError(msg) {
  log(`[ERROR] ${msg}`);
}

module.exports = { log, logError };