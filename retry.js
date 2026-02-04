'use strict';
const { log } = require('./logger');

async function withRetry(fn, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (e) {
      log(`Retry ${i + 1}/${maxRetries} due to error: ${e.message}`);
      if (i === maxRetries - 1) throw e;
    }
  }
}

module.exports = { withRetry };