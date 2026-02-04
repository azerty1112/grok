const fs = require('fs');
const path = require('path');
const { launchBrowser } = require('./browser');
const { applyGrokSettings, sendPrompt } = require('./grok');
const { waitForGeneration, clickDownload } = require('./downloader');
const { withRetry } = require('./retry');
const { sanitizeFilename } = require('./utils');
const { log } = require('./logger');

// Load config
const config = fs.readFileSync('config.txt','utf8')
  .split('\n')
  .reduce((acc,line)=>{
    if(line.includes('=')){
      const [k,v] = line.split('=');
      acc[k.trim()] = v.trim();
    }
    return acc;
  }, {});

// Load titles
const titles = fs.readFileSync('titre.txt','utf8')
  .split('\n').map(t => t.trim()).filter(Boolean);

// Load scripts
function loadScripts(folder) {
  return fs.readdirSync(folder)
    .filter(f => f.endsWith('.txt'))
    .map(f => fs.readFileSync(path.join(folder,f),'utf8'));
}

const scripts = loadScripts(config.VIDEO_SCRIPTS_FOLDER);

// Split scenes
function splitScenes(text) {
  return text.split('----------').map(s => s.trim()).filter(Boolean);
}

(async ()=>{
  const { browser, page } = await launchBrowser();

  await applyGrokSettings(page, config);

  for (let t = 0; t < titles.length; t++) {
    const title = sanitizeFilename(titles[t]);
    const videoFolder = path.join(config.DOWNLOAD_ROOT, title);
    fs.mkdirSync(videoFolder, { recursive: true });

    log(`\n=== START VIDEO: ${title} ===`);

    const scenes = splitScenes(scripts[t % scripts.length]);

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      log(`Scene ${i+1}/${scenes.length}`);

      await withRetry(async () => {
        await sendPrompt(page, config.GROK_URL, title, scene, config);
        const done = await waitForGeneration(page, config);
        if (done) {
          await clickDownload(page, videoFolder, i, config);
        } else {
          throw new Error("Generation failed");
        }
      }, parseInt(config.MAX_RETRIES));

      await new Promise(r => setTimeout(r, parseInt(config.BETWEEN_SCENES_WAIT)));
    }

    log(`=== FINISHED VIDEO: ${title} ===`);
    await new Promise(r => setTimeout(r, parseInt(config.BETWEEN_VIDEOS_WAIT)));
  }

  // await browser.close();
})();
