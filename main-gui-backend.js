'use strict';

// هذه الطبقة تتعامل مع جميع الشغل الحقيقي (استيراد دوالك القديمة)
const configFile = './config.json';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let currentState = { running: false, progress: 0, log: '', ...require(configFile) };
let activeProcess = null;

function readConfig() {
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

function readLogTail(filePath, maxLines = 200) {
  if (!fs.existsSync(filePath)) return '';
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.trim()) return '';
  return content.split('\n').filter(Boolean).slice(-maxLines).join('\n');
}

function ensureLogFileExists(logFile) {
  const absolutePath = path.resolve(logFile);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (!fs.existsSync(absolutePath)) fs.writeFileSync(absolutePath, '', 'utf8');
}

module.exports = {
  getCurrentState: async () => currentState,
  saveConfig: async (newConfig) => {
    fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2), 'utf8');
    Object.assign(currentState, newConfig);
    return true;
  },
  runAutomation: async (params) => {
    if (currentState.running) {
      return { status: 'busy', message: 'Automation is already running.' };
    }

    try {
      await module.exports.saveConfig(params);
      const runtimeConfig = readConfig();
      ensureLogFileExists(runtimeConfig.LOG_FILE);

      currentState.running = true;
      currentState.progress = 0;
      currentState.log = 'تم بدء تشغيل الأتمتة الفعلية...';

      const runPromise = new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['main.js'], {
          cwd: __dirname,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        activeProcess = child;

        child.stdout.on('data', (chunk) => {
          const text = String(chunk).trim();
          if (!text) return;
          currentState.log = `${readLogTail(runtimeConfig.LOG_FILE)}\n${text}`.trim();
        });

        child.stderr.on('data', (chunk) => {
          const text = String(chunk).trim();
          if (!text) return;
          currentState.log = `${currentState.log}\n[stderr] ${text}`.trim();
        });

        child.on('error', reject);
        child.on('close', (code) => {
          activeProcess = null;
          if (code === 0) resolve();
          else reject(new Error(`main.js exited with code ${code}`));
        });
      });

      await runPromise;
      currentState.progress = 100;
      currentState.log = readLogTail(runtimeConfig.LOG_FILE) || 'تم التنفيذ بدون سجل.';
      currentState.running = false;
      return { status: 'done' };
    } catch (e) {
      currentState.running = false;
      currentState.progress = 0;
      currentState.log = `${currentState.log}\n[ERROR] ${e.message}`.trim();
      if (activeProcess && !activeProcess.killed) {
        activeProcess.kill('SIGTERM');
        activeProcess = null;
      }
      throw e;
    }
  }
};
