const fs = require('fs');

function log(msg) {
  const time = new Date().toISOString();
  const line = `[${time}] ${msg}\n`;
  console.log(line.trim());
  fs.appendFileSync('automation.log', line);
}

module.exports = { log };
