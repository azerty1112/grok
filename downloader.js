const fs = require('fs');
const path = require('path');
const { log } = require('./logger');

async function waitForGeneration(page, config) {
  const start = Date.now();
  while (Date.now() - start < parseInt(config.MAX_WAIT)) {
    const cancelBtn = await page.$(config.CANCEL_BUTTON_SELECTOR);
    if (!cancelBtn) {
      log("Generation finished.");
      return true;
    }
    await new Promise(r => setTimeout(r, parseInt(config.CHECK_INTERVAL)));
  }
  log("Timeout waiting for generation.");
  return false;
}

async function clickDownload(page, folder, index, config) {
  const btn = await page.$(config.DOWNLOAD_BUTTON_SELECTOR);
  if (!btn) {
    log("Download button not found.");
    return false;
  }

  await btn.click();
  log(`Downloading scene ${index + 1}...`);
  await new Promise(r => setTimeout(r, parseInt(config.AFTER_DOWNLOAD_WAIT)));
  return true;
}

module.exports = { waitForGeneration, clickDownload };
