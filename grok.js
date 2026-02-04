const fs = require('fs');
const { log } = require('./logger');

async function applyGrokSettings(page, config) {
  log("Applying Grok settings...");

  const settings = [
    "GROK_SETTING_RATIO_BUTTON",
    "GROK_SETTING_VIDEO_MODE_BUTTON",
    "GROK_SETTING_QUALITY_BUTTON"
  ];

  for (const key of settings) {
    if (config[key]) {
      try {
        await page.waitForSelector(config[key], { timeout: 15000 });
        await page.click(config[key]);
      } catch {}
    }
  }

  log("Grok settings applied.");
}

async function sendPrompt(page, url, title, scene, config) {
  await page.goto(url, { waitUntil: "networkidle2" });

  await page.waitForSelector(config.INPUT_SELECTOR);
  await page.evaluate(sel => document.querySelector(sel).innerText = "", config.INPUT_SELECTOR);
  await page.type(config.INPUT_SELECTOR, `${title}\n\n${scene}`, { delay: 30 });

  await page.waitForSelector(config.SUBMIT_SELECTOR);
  await page.click(config.SUBMIT_SELECTOR);
  log("Prompt sent.");
}

module.exports = { applyGrokSettings, sendPrompt };
