const { app, BrowserWindow, dialog, utilityProcess } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;
let backendProcess;
let selectedPort = 5000;

const isDev = !app.isPackaged;
const logPath = path.join(app.getPath('userData'), 'backend.log');

// 1. Logging Setup
function logToFile(message) {
  const logMessage = `[${new Date().toISOString()}] ${message}\n`;
  try {
    fs.appendFileSync(logPath, logMessage);
  } catch (e) {
    fs.writeFileSync(logPath, logMessage);
  }
}

// 2. Port Check Logic
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = http.createServer().listen(port, () => {
      server.close();
      resolve(true);
    });
    server.on('error', () => resolve(false));
  });
}

// 3. Start Backend Logic (utilityProcess.fork - No external Node.js dependency)
async function startBackend() {
  if (!(await isPortAvailable(5000))) {
    logToFile('FATAL: Port 5000 is occupied. Attempting recovery via clean...');
    dialog.showErrorBox('Port Conflict', 'Port 5000 is being used by another process. Please restart the app or run "npm run clean".');
    app.quit();
    return;
  }

  selectedPort = 5000;

  const serverPath = isDev
    ? path.join(__dirname, '..', 'backend', 'server.js')
    : path.join(process.resourcesPath, 'backend', 'server.js');

  logToFile(`Starting backend on port ${selectedPort} at ${serverPath}`);

  const unpackedModules = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules');

  // LAUNCH via utilityProcess (Uses Electron's internal Node environment)
  backendProcess = utilityProcess.fork(serverPath, [], {
    stdio: 'pipe',
    cwd: isDev ? path.join(__dirname, '..', 'backend') : path.join(process.resourcesPath, 'backend'),
    env: {
      ...process.env,
      PORT: selectedPort.toString(),
      NODE_ENV: 'production',
      isDev: isDev ? 'true' : 'false',
      // Provide paths to backend bootstrap
      NODE_PATH: isDev 
        ? path.join(__dirname, '..', 'node_modules')
        : unpackedModules
    }
  });

  // Capture utilityProcess output for logging
  backendProcess.stdout.on('data', (data) => {
    const msg = data.toString();
    logToFile(`B-STDOUT: ${msg}`);
    if (isDev) console.log(`[Backend Log]: ${msg}`);
  });

  backendProcess.stderr.on('data', (data) => {
    const msg = data.toString();
    logToFile(`B-STDERR: ${msg}`);
    if (isDev) console.error(`[Backend Error]: ${msg}`);
  });

  backendProcess.on('exit', (code) => {
    logToFile(`Backend process exited with code ${code}`);
    if (code !== 0) {
      dialog.showErrorBox('Backend Crash', `The background server crashed (Code: ${code}). Check backend.log.`);
    }
  });

  backendProcess.on('spawn', () => {
    logToFile('Backend process spawned successfully ✅');
  });
}

// 4. Wait for Backend
function waitForBackend(callback) {
  let retries = 0;
  const maxRetries = 20;

  const check = () => {
    const req = http.get(`http://127.0.0.1:${selectedPort}/`, (res) => {
      logToFile('Backend verified responsive ✅');
      callback();
    });

    req.on('error', (err) => {
      retries++;
      if (retries >= maxRetries) {
        logToFile(`Backend connection failed after ${maxRetries} attempts ❌`);
        dialog.showErrorBox('Connection Error', 'Failed to connect to background server. Ensure MongoDB Atlas is accessible and check backend.log.');
        callback(); 
        return;
      }
      setTimeout(check, 1000);
    });
    
    req.end();
  };
  check();
}

// 5. Wait for Frontend (Dev Mode)
function waitForFrontend(callback) {
  if (!isDev) return callback();

  let retries = 0;
  const maxRetries = 30; // Wait up to 30 seconds for ng serve

  const check = () => {
    const req = http.get('http://localhost:4200/', (res) => {
      logToFile('Frontend verified responsive ✅');
      callback();
    });

    req.on('error', (err) => {
      retries++;
      if (retries >= maxRetries) {
        logToFile(`Frontend connection failed after ${maxRetries} attempts ❌`);
        dialog.showErrorBox('Frontend Ready Timeout', 'The Angular dev server (ng serve) took too long to start. Please ensure "npm start" is running.');
        callback(); 
        return;
      }
      setTimeout(check, 1000);
    });
    
    req.end();
  };
  check();
}

// 6. Create Window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const frontendPath = isDev
    ? path.join(__dirname, '..', 'dist', 'elms', 'browser', 'index.html')
    : path.join(process.resourcesPath, 'dist', 'elms', 'browser', 'index.html');

  if (isDev) {
    logToFile(`Loading Dev Server: http://localhost:4200`);
    mainWindow.loadURL('http://localhost:4200', {
      query: { port: selectedPort.toString() }
    });
  } else {
    logToFile(`Loading UI: ${frontendPath}`);
    mainWindow.loadFile(frontendPath, {
      query: { port: selectedPort.toString() }
    });
  }

  // Remove the default Electron menu bar
  mainWindow.setMenu(null);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    logToFile(`UI LOAD FAILED: ${errorDescription} (${errorCode}) at ${validatedURL}`);
    dialog.showErrorBox('Frontend Error', `Could not load application files: ${errorDescription}\nPath: ${validatedURL}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startBackend();
  waitForBackend(() => {
    waitForFrontend(() => {
      createWindow();
    });
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) backendProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});
