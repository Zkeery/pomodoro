const { app, BrowserWindow, ipcMain, Notification, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

app.setName("番茄钟");

const storePath = () => path.join(app.getPath("userData"), "pomodoro-store.json");

const defaultStore = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  alwaysOnTop: true,
  soundEnabled: true,
  todayDate: "",
  todayCount: 0,
  completedInSet: 0,
};

function readStore() {
  try {
    const raw = fs.readFileSync(storePath(), "utf8");
    return { ...defaultStore, ...JSON.parse(raw) };
  } catch {
    return { ...defaultStore };
  }
}

function writeStore(data) {
  fs.mkdirSync(path.dirname(storePath()), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), "utf8");
}

function createIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="36" r="22" fill="#ef5a3c"/>
      <ellipse cx="24" cy="30" rx="6" ry="8" fill="#ff8a6a" opacity="0.45"/>
      <path d="M32 16c2-6 10-8 12-4-6 1-8 5-8 8" fill="#3d8b4a"/>
      <path d="M32 16c-3-5-9-6-11-2 5 1 8 4 9 8" fill="#4caf5a"/>
    </svg>`;
  return nativeImage.createFromDataURL(
    `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
  );
}

let mainWindow = null;

function createWindow() {
  const store = readStore();
  const icon = createIcon();

  mainWindow = new BrowserWindow({
    width: 340,
    height: 520,
    minWidth: 340,
    minHeight: 520,
    maxWidth: 340,
    maxHeight: 520,
    frame: false,
    transparent: true,
    resizable: false,
    fullscreenable: false,
    hasShadow: true,
    alwaysOnTop: store.alwaysOnTop !== false,
    skipTaskbar: false,
    title: "番茄钟",
    icon,
    show: false,
    backgroundColor: "#00000000",
    vibrancy: "under-window",
    visualEffectState: "active",
    roundedCorners: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.platform === "darwin") {
    app.dock.setIcon(icon);
  }

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("store:get", () => readStore());

ipcMain.handle("store:set", (_event, patch) => {
  const next = { ...readStore(), ...patch };
  writeStore(next);
  return next;
});

ipcMain.handle("window:set-always-on-top", (_event, flag) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(Boolean(flag));
  }
  const next = { ...readStore(), alwaysOnTop: Boolean(flag) };
  writeStore(next);
  return next.alwaysOnTop;
});

ipcMain.handle("window:minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window:close", () => {
  app.quit();
});

ipcMain.handle("notify:session-end", (_event, payload) => {
  if (!Notification.isSupported()) return false;
  const { title, body } = payload || {};
  const notification = new Notification({
    title: title || "番茄钟",
    body: body || "当前时段已结束",
    silent: true,
  });
  notification.show();
  return true;
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(createWindow);

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
