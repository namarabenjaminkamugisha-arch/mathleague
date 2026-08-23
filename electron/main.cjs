// main.cjs — the Electron shell. Loads the same src/ that runs in a browser.

const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('node:path');

const isDev = !app.isPackaged;
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1040,
    height: 820,
    minWidth: 380,
    minHeight: 620,
    backgroundColor: '#05070a',
    show: false,
    autoHideMenuBar: true,
    title: 'MathLeague',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());
  if (isDev) win.webContents.openDevTools({ mode: 'detach' });

  // External links go to the real browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  win.on('closed', () => { win = null; });
}

// One instance only; a second launch focuses the first.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'MathLeague',
          submenu: [
            { role: 'reload' },
            { role: 'toggleDevTools' },
            { type: 'separator' },
            { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
            { type: 'separator' },
            { role: 'togglefullscreen' },
            { role: 'quit' },
          ],
        },
      ]),
    );
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
