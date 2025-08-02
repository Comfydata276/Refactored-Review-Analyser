const { spawn } = require('child_process');
const { exec } = require('child_process');

console.log('🚀 Starting Steam Review Analyser Development Mode...\n');

// Start Vite dev server
console.log('📦 Starting Vite development server...');
const vite = spawn('npm', ['run', 'dev'], { stdio: 'pipe', shell: true });

vite.stdout.on('data', (data) => {
  console.log(`[Vite] ${data}`);
});

vite.stderr.on('data', (data) => {
  console.error(`[Vite Error] ${data}`);
});

// Wait for server to be ready then start Electron
setTimeout(() => {
  console.log('🔍 Waiting for development server...');
  
  const checkServer = () => {
    // Check multiple possible ports
    const checkPort = (port) => {
      return new Promise((resolve) => {
        exec(`powershell -Command "try { Invoke-WebRequest -Uri http://localhost:${port} -UseBasicParsing -TimeoutSec 1 | Out-Null; Write-Output 'success' } catch { Write-Output 'failed' }"`, (error, stdout) => {
          resolve(!error && stdout.trim() === 'success');
        });
      });
    };
    
    const tryPorts = async () => {
      for (const port of [5173, 5174, 5175, 5176, 5177, 5178]) {
        if (await checkPort(port)) {
          startElectron(port);
          return;
        }
      }
      setTimeout(checkServer, 1000);
    };
    
    tryPorts();
  };
  
  const startElectron = (port) => {
    console.log(`⚡ Starting Electron app on port ${port}...`);
    process.env.NODE_ENV = 'development';
    process.env.VITE_PORT = port;
    
    // Try different ways to run electron
    const fs = require('fs');
    let electronCmd;
    
    if (fs.existsSync('node_modules\\.bin\\electron.cmd')) {
      electronCmd = 'node_modules\\.bin\\electron.cmd';
    } else if (fs.existsSync('node_modules\\.bin\\electron')) {
      electronCmd = 'node_modules\\.bin\\electron';
    } else {
      electronCmd = 'npx';
    }
    
    const args = electronCmd === 'npx' ? ['electron', '.'] : ['.'];
    
    console.log(`📦 Using electron command: ${electronCmd} ${args.join(' ')}`);
    
    const electron = spawn(electronCmd, args, { 
      stdio: 'inherit', 
      shell: true,
      env: { ...process.env, NODE_ENV: 'development', VITE_PORT: port }
    });
    
    electron.on('close', (code) => {
      console.log(`\n🛑 Electron closed with code ${code}`);
      vite.kill();
      process.exit(code);
    });
  };
  
  checkServer();
}, 3000);

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  vite.kill();
  process.exit(0);
});