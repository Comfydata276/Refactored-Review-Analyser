const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')

// Keep a global reference of the window object
let mainWindow
let backendProcess = null

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'

// Backend configuration
const BACKEND_HOST = 'localhost'
const BACKEND_PORT = 8000
const FRONTEND_PORT = process.env.VITE_PORT || 5173

// Resolve a writable Output folder path in both dev and packaged builds
function resolveOutputPath() {
  // 1) Packaged app resources path (where backend is bundled)
  const packagedBackendOutput = path.join(process.resourcesPath || '', 'backend', 'output')
  if (process.resourcesPath && fs.existsSync(path.join(process.resourcesPath, 'backend'))) {
    try {
      fs.mkdirSync(packagedBackendOutput, { recursive: true })
      return packagedBackendOutput
    } catch (_) {
      // fall through to userData
    }
  }

  // 2) Dev repo layout (running from source)
  const devOutput = path.join(__dirname, '../../backend/output')
  if (fs.existsSync(path.join(__dirname, '../../backend'))) {
    try {
      fs.mkdirSync(devOutput, { recursive: true })
      return devOutput
    } catch (_) {
      // fall through to userData
    }
  }

  // 3) Fallback to userData (always writable)
  const userDataOutput = path.join(app.getPath('userData'), 'output')
  try {
    fs.mkdirSync(userDataOutput, { recursive: true })
  } catch (_) {
    // ignore mkdir errors; shell.openPath will handle existence
  }
  return userDataOutput
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png'), // We'll create this later
    show: false, // Don't show until ready
    titleBarStyle: isMac ? 'hiddenInset' : 'default'
  })

  // Load the app
  const startUrl = isDev 
    ? `http://localhost:${FRONTEND_PORT}` 
    : `file://${path.join(__dirname, '../dist/index.html')}`
  
  console.log(`Loading URL: ${startUrl}`)
  console.log(`Development mode: ${isDev}`)
  
  mainWindow.loadURL(startUrl)
  
  // Handle load failures in development
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load ${validatedURL}: ${errorDescription}`)
    if (isDev) {
      // Retry after a delay in development mode
      setTimeout(() => {
        console.log('Retrying to load development server...')
        mainWindow.loadURL(startUrl)
      }, 2000)
    }
  })

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (isDev) {
      mainWindow.webContents.openDevTools()
    }
  })

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Prevent navigation away from the app
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl)
    if (parsedUrl.origin !== `http://localhost:${FRONTEND_PORT}` && !isDev) {
      event.preventDefault()
    }
  })
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Output Folder',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            const outputPath = resolveOutputPath()
            if (fs.existsSync(outputPath)) {
              shell.openPath(outputPath)
            } else {
              // Try to create then open
              try { fs.mkdirSync(outputPath, { recursive: true }) } catch (_) {}
              if (fs.existsSync(outputPath)) {
                shell.openPath(outputPath)
              } else {
                dialog.showErrorBox('Error', `Output folder not found or not writable:\n${outputPath}`)
              }
            }
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Backend',
      submenu: [
        {
          label: 'Start Backend Server',
          click: () => startBackend()
        },
        {
          label: 'Stop Backend Server',
          click: () => stopBackend()
        },
        {
          label: 'Restart Backend Server',
          click: () => restartBackend()
        }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Steam Review Analyser',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Steam Review Analyser',
              message: 'Steam Review Analyser',
              detail: 'A comprehensive application for scraping Steam game reviews and analyzing them using Large Language Models.\n\nVersion: 1.0.0'
            })
          }
        },
        {
          label: 'Visit GitHub Repository',
          click: () => {
            shell.openExternal('https://github.com/Comfydata276/Refactored-Review-Analyser')
          }
        }
      ]
    }
  ]

  // macOS specific menu adjustments
  if (isMac) {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })

    // Window menu
    template[4].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ]
  }

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

function findBackendExecutable() {
  // In production, use standalone backend executable
  if (!isDev) {
    const standaloneBackend = path.join(process.resourcesPath, 'backend', 'steam-review-backend.exe')
    if (fs.existsSync(standaloneBackend)) {
      console.log(`Using standalone backend: ${standaloneBackend}`)
      return { type: 'standalone', path: standaloneBackend }
    }
  }

  // Development mode - use Python with backend directory
  const possiblePaths = [
    path.join(__dirname, '../../backend/venv/Scripts/python.exe'), // Windows venv
    path.join(__dirname, '../../backend/venv/bin/python'), // Unix venv
    'python',
    'python3'
  ]

  for (const pythonPath of possiblePaths) {
    if (fs.existsSync(pythonPath)) {
      console.log(`Using Python: ${pythonPath}`)
      return { type: 'python', path: pythonPath }
    }
  }
  
  console.log('No Python found, falling back to system python')
  return { type: 'python', path: 'python' } // Fallback to system python
}

function startBackend() {
  if (backendProcess) {
    console.log('Backend is already running')
    return
  }
  
  // Check if backend is already running on port 8000
  const http = require('http')
  const req = http.request({
    hostname: 'localhost',
    port: 8000,
    path: '/health',
    method: 'GET',
    timeout: 1000
  }, (res) => {
    console.log('Backend already running on port 8000, skipping startup')
    return
  })
  
  req.on('error', () => {
    // Port is free, proceed with startup
    actuallyStartBackend()
  })
  
  req.on('timeout', () => {
    req.destroy()
    actuallyStartBackend()
  })
  
  req.end()
}

function actuallyStartBackend() {
  const backend = findBackendExecutable()
  
  let backendCommand, backendArgs, workingDir

  if (backend.type === 'standalone') {
    // Use standalone executable
    backendCommand = backend.path
    backendArgs = []
    workingDir = path.dirname(backend.path)
    
    console.log(`Starting standalone backend: ${backendCommand}`)
    console.log(`Working directory: ${workingDir}`)
    
    // Check if executable exists
    if (!fs.existsSync(backendCommand)) {
      console.error(`Standalone backend not found at: ${backendCommand}`)
      dialog.showErrorBox('Backend Error', `Backend executable not found: ${backendCommand}`)
      return
    }
  } else {
    // Use Python with source code
    backendCommand = backend.path
    backendArgs = ['-m', 'app.main']
    
    // Determine backend directory based on whether we're in development or production
    if (isDev) {
      workingDir = path.join(__dirname, '../../backend')
    } else {
      workingDir = path.join(process.resourcesPath, 'backend')
    }
    
    const mainPy = path.join(workingDir, 'app/main.py')
    
    console.log(`Starting backend with: ${backendCommand} ${backendArgs.join(' ')}`)
    console.log(`Backend directory: ${workingDir}`)
    console.log(`Python path: ${backendCommand}`)
    
    // Check if files exist
    if (!fs.existsSync(mainPy)) {
      console.error(`main.py not found at: ${mainPy}`)
      dialog.showErrorBox('Backend Error', `Backend file not found: ${mainPy}`)
      return
    }
  }

  console.log(`Command: ${backendCommand} ${backendArgs.join(' ')}`)

  backendProcess = spawn(backendCommand, backendArgs, {
    cwd: workingDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { 
      ...process.env,
      PYTHONPATH: workingDir,
      PYTHON_UNBUFFERED: '1',
      PATH: process.env.PATH
    }
  })

  backendProcess.stdout.on('data', (data) => {
    console.log(`Backend stdout: ${data}`)
  })

  backendProcess.stderr.on('data', (data) => {
    console.log(`Backend stderr: ${data}`)
  })

  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`)
    backendProcess = null
  })

  backendProcess.on('error', (error) => {
    console.error('Failed to start backend:', error)
    const errorMsg = `Failed to start backend server: ${error.message}\n\nTroubleshooting:\n- Ensure Python is installed\n- Check if port 8000 is available\n- Try restarting the application`
    dialog.showErrorBox('Backend Error', errorMsg)
    backendProcess = null
  })
}

function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend server...')
    backendProcess.kill('SIGTERM')
    backendProcess = null
  }
}

function restartBackend() {
  stopBackend()
  setTimeout(() => {
    startBackend()
  }, 2000)
}

// App event handlers
app.whenReady().then(() => {
  createWindow()
  createMenu()
  
  // Start backend server automatically
  startBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  if (!isMac) {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopBackend()
})

// IPC handlers
ipcMain.handle('get-app-version', () => {
  return app.getVersion()
})

ipcMain.handle('get-backend-status', async () => {
  return {
    running: backendProcess !== null,
    host: BACKEND_HOST,
    port: BACKEND_PORT
  }
})

ipcMain.handle('restart-backend', async () => {
  restartBackend()
  return true
})

ipcMain.handle('open-output-folder', async () => {
  const outputPath = resolveOutputPath()
  if (fs.existsSync(outputPath)) {
    await shell.openPath(outputPath)
    return true
  }
  try { fs.mkdirSync(outputPath, { recursive: true }) } catch (_) {}
  if (fs.existsSync(outputPath)) {
    await shell.openPath(outputPath)
    return true
  }
  return false
})

// Window management handlers (used by preload windowAPI)
ipcMain.handle('window-close', async () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.close()
  return true
})

ipcMain.handle('window-minimize', async () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) win.minimize()
  return true
})

ipcMain.handle('window-maximize', async () => {
  const win = BrowserWindow.getFocusedWindow()
  if (win) {
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  }
  return true
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event) => {
    event.preventDefault()
  })
})