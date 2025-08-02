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
            const outputPath = path.join(__dirname, '../../backend/output')
            if (fs.existsSync(outputPath)) {
              shell.openPath(outputPath)
            } else {
              dialog.showErrorBox('Error', 'Output folder not found')
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

function findPythonExecutable() {
  const possiblePaths = [
    path.join(__dirname, '../../backend/venv/Scripts/python.exe'), // Windows venv
    path.join(__dirname, '../../backend/venv/bin/python'), // Unix venv
    'python',
    'python3'
  ]

  for (const pythonPath of possiblePaths) {
    if (fs.existsSync(pythonPath)) {
      return pythonPath
    }
  }
  
  return 'python' // Fallback to system python
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

  const pythonPath = findPythonExecutable()
  
  // Determine backend directory based on whether we're in development or production
  let backendDir
  if (isDev) {
    // Development mode - backend is in the project directory
    backendDir = path.join(__dirname, '../../backend')
  } else {
    // Production mode - backend is in resources/backend
    backendDir = path.join(process.resourcesPath, 'backend')
  }
  
  const mainPy = path.join(backendDir, 'app/main.py')

  console.log(`Starting backend with: ${pythonPath} -m app.main`)
  console.log(`Backend directory: ${backendDir}`)
  console.log(`Python path: ${pythonPath}`)

  // Check if files exist
  if (!fs.existsSync(mainPy)) {
    console.error(`main.py not found at: ${mainPy}`)
    dialog.showErrorBox('Backend Error', `Backend file not found: ${mainPy}`)
    return
  }

  const args = ['-m', 'app.main']
  console.log(`Command: ${pythonPath} ${args.join(' ')}`)
  console.log(`Working directory: ${backendDir}`)

  backendProcess = spawn(pythonPath, args, {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { 
      ...process.env,
      PYTHONPATH: backendDir,
      PYTHON_UNBUFFERED: '1',
      // Add current directory to Python path for module resolution
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
    dialog.showErrorBox('Backend Error', `Failed to start backend server: ${error.message}`)
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
  const outputPath = path.join(__dirname, '../../backend/output')
  if (fs.existsSync(outputPath)) {
    shell.openPath(outputPath)
    return true
  }
  return false
})

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event) => {
    event.preventDefault()
  })
})