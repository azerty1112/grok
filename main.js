'use strict';

const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('./browser');
const { applyGrokSettings, sendPrompt } = require('./grok');
const { waitForGeneration, clickDownload } = require('./downloader');
const { withRetry } = require('./retry');
const { sanitizeFilename, formatDuration } = require('./utils');
const { log, logError } = require('./logger');
const { notifyByMail } = require('./notify');
const config = require('./config.json');

if (!fs.existsSync('./logs')) fs.mkdirSync('./logs');
if (!fs.existsSync(config.ERRORS_DIR)) fs.mkdirSync(config.ERRORS_DIR, { recursive: true });

const startAll = Date.now();

// تحميل العناوين
const titles = fs.readFileSync('titre.txt','utf8')
  .split('\n')
  .map(t => t.trim())
  .filter(Boolean);

// تحميل نصوص المشاهد
function loadScripts(folder) {
  return fs.readdirSync(folder)
    .filter(f => f.endsWith('.txt'))
    .map(f => fs.readFileSync(path.join(folder,f),'utf8'));
}
const scripts = loadScripts(config.VIDEO_SCRIPTS_FOLDER);

// تقسيم المشاهد
function splitScenes(text) {
  return text.split('----------').map(s => s.trim()).filter(Boolean);
}

let failedScenes = [], succeededScenes = [];

async function handleFailedScene(title, sceneIndex, sceneText, error, page) {
  logError(`⚠️ Scene failed: (${title}, Scene ${sceneIndex + 1}) — Reason: ${error.message}`);
  failedScenes.push({title, sceneIndex, sceneText});
  await handleDebugOnError(page, title, sceneIndex);
}

async function handleDebugOnError(page, title, sceneIndex) {
  const prefix = `${sanitizeFilename(title)}_scene${sceneIndex+1}_${Date.now()}`;
  if (config.SAVE_HTML_ON_ERROR) {
    const html = await page.content();
    fs.writeFileSync(path.join(config.ERRORS_DIR, `${prefix}.html`), html);
  }
  if (config.SCREENSHOT_ON_ERROR) {
    await page.screenshot({ path: path.join(config.ERRORS_DIR, `${prefix}.png`), fullPage: true });
  }
}

(async ()=>{
  const { browser, page } = await launchBrowser();
  await applyGrokSettings(page, config);
  let totalScenes = 0;
  let doneScenes = 0;

  for (let t = 0; t < titles.length; t++) {
    const title = sanitizeFilename(titles[t]);
    const videoFolder = path.join(config.DOWNLOAD_ROOT, title);
    if (!fs.existsSync(videoFolder)) fs.mkdirSync(videoFolder, { recursive: true });

    log(`\n=== 📹 START VIDEO: ${title} ===`);
    const scenes = splitScenes(scripts[t % scripts.length]);
    totalScenes += scenes.length;

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      log(`Scene ${i+1}/${scenes.length}`);
      try {
        await withRetry(async () => {
          await sendPrompt(page, config.GROK_URL, title, scene, config);
          const done = await waitForGeneration(page, config);
          if (done) {
            await clickDownload(page, videoFolder, i, config);
            succeededScenes.push({title, sceneIndex: i});
            doneScenes++;
            log(`🎬 Scene ${i+1} of "${title}" finished successfully.`);
          } else {
            throw new Error("Generation failed");
          }
        }, parseInt(config.MAX_RETRIES));
      } catch (e) {
        await handleFailedScene(title, i, scene, e, page);
      }
      await new Promise(r => setTimeout(r, parseInt(config.BETWEEN_SCENES_WAIT)));
    }
  }

  // إعادة محاولة المشاهد
  if (failedScenes.length > 0) {
    log(`🔁 Retrying failed scenes:`);
    for (const {title, sceneIndex, sceneText} of failedScenes) {
      const videoFolder = path.join(config.DOWNLOAD_ROOT, title);
      try {
        await withRetry(async () => {
          await sendPrompt(page, config.GROK_URL, title, sceneText, config);
          const done = await waitForGeneration(page, config);
          if (done) {
            await clickDownload(page, videoFolder, sceneIndex, config);
            log(`🟢 RETRY succeeded: ${title} scene ${sceneIndex+1}`);
            doneScenes++;
          }
        }, parseInt(config.MAX_RETRIES));
      } catch (e) {
        logError(`❌ RETRY failed: ${title}, scene ${sceneIndex+1}`);
        await handleDebugOnError(page, title, sceneIndex);
        if (config.ENABLE_NOTIFY && config.NOTIFY_EMAIL && config.NOTIFY_TO) {
          await notifyByMail(
            `[grok][Scene Failure] ${title} scene ${sceneIndex+1}`,
            `Failed to generate scene after all retries.`
          );
        }
      }
    }
  }

  const duration = formatDuration(Date.now() - startAll);
  log(`✅ ALL SCENES DONE! (${doneScenes}/${totalScenes}) | Duration: ${duration}`);
  await browser.close();
})();