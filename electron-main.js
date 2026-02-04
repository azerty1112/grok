'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const config = require('./config.json');
const backend = require('./main-gui-backend'); // new: نفس وظائفك (worker/background logic)
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 630,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: __dirname + '/app/logo.png'
  });

  mainWindow.loadFile('./app/index.html');
  // mainWindow.webContents.openDevTools(); // للتطوير فقط
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ربط واجهة المستخدم بوظائف الأتمتة الخلفية (backend)
ipcMain.handle('grok:run', async (_, params) => {
  return await backend.runAutomation(params);
});
ipcMain.handle('grok:saveConfig', async (_, newConf) => {
  return await backend.saveConfig(newConf);
});
ipcMain.handle('grok:getState', async () => {
  return await backend.getCurrentState();
});