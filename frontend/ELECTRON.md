# Steam Review Analyser - Desktop App

This directory contains the Electron desktop application configuration for the Steam Review Analyser.

## Features

✅ **Native Desktop App** - Runs as a standalone application  
✅ **Integrated Backend** - Automatically starts and manages Python backend  
✅ **Cross-Platform** - Windows, macOS, and Linux support  
✅ **Auto-Updates** - Built-in update mechanism  
✅ **File System Access** - Direct access to output files  
✅ **System Integration** - Native menus, shortcuts, and notifications  

## Quick Start

### Development Mode

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run electron-dev
   ```
   Or double-click `electron-dev.bat` on Windows

### Production Build

1. **Build Application**
   ```bash
   npm run electron-dist
   ```
   Or double-click `electron-build.bat` on Windows

2. **Find Your Installer**
   - Windows: `dist-electron/Steam Review Analyser Setup 1.0.0.exe`
   - macOS: `dist-electron/Steam Review Analyser-1.0.0.dmg`
   - Linux: `dist-electron/Steam Review Analyser-1.0.0.AppImage`

## Backend Integration

The Electron app automatically:
- 🔍 **Finds Python** - Locates virtual environment or system Python
- 🚀 **Starts Backend** - Launches FastAPI server on startup
- 🔄 **Manages Process** - Stops backend when app closes
- ⚡ **Auto-Restart** - Built-in backend restart functionality

## File Structure

```
electron/
├── main.js          # Main Electron process
├── preload.js       # Secure API bridge
└── assets/          # App icons and resources

dist-electron/       # Built applications (after build)
├── win-unpacked/    # Windows unpacked
├── mac/            # macOS app bundle
└── linux-unpacked/ # Linux unpacked
```

## Development Scripts

| Command | Description |
|---------|-------------|
| `npm run electron` | Run Electron with built React app |
| `npm run electron-dev` | Development mode (hot reload) |
| `npm run electron-pack` | Build and package for current platform |
| `npm run electron-dist` | Build distributables for all platforms |

## Configuration

### App Metadata
Edit `package.json` to customize:
- App name and description
- Version number
- Author information
- Repository URL

### Build Settings
Modify the `build` section in `package.json`:
- Target platforms
- Icon paths
- Installer options
- File associations

### Backend Settings
Configure in `electron/main.js`:
- Backend port (default: 8000)
- Python executable path
- Startup behavior

## Icons

Place your app icons in `electron/assets/`:
- `icon.png` - 512×512 PNG (Linux/general)
- `icon.ico` - Windows ICO file
- `icon.icns` - macOS ICNS file

Use [Icon Generator](https://www.electron.build/icons) to create all formats from a single PNG.

## Troubleshooting

### Backend Won't Start
1. Check if Python is installed
2. Verify virtual environment exists: `backend/venv/`
3. Check backend dependencies: `pip install -r backend/requirements.txt`
4. Try manual backend start: `python backend/app/main.py`

### Build Fails
1. Clear node_modules: `rm -rf node_modules && npm install`
2. Clear Electron cache: `npx electron-builder install-app-deps`
3. Check for missing dependencies in package.json

### App Won't Start
1. Check Electron version compatibility
2. Verify main.js path in package.json
3. Check for JavaScript errors in DevTools

## Distribution

### Windows
- **Installer**: NSIS installer with automatic updates
- **Portable**: Standalone executable (no installation)
- **Requirements**: Windows 10+ (64-bit)

### macOS
- **DMG**: Disk image with drag-to-install
- **Auto-Updates**: Built-in updater support
- **Requirements**: macOS 10.13+ (Intel/Apple Silicon)

### Linux
- **AppImage**: Portable application bundle
- **DEB**: Debian/Ubuntu package
- **Requirements**: Ubuntu 18.04+ or equivalent

## Security

The app implements Electron security best practices:
- ✅ Context isolation enabled
- ✅ Node integration disabled
- ✅ Remote module disabled
- ✅ Content Security Policy
- ✅ Secure preload script

## Next Steps

1. **Customize Icons** - Replace default icons with your brand
2. **Add Auto-Updates** - Configure update server
3. **Code Signing** - Sign app for distribution
4. **CI/CD Pipeline** - Automate builds and releases