# Antivirus False Positive Guidance

## Issue
Some antivirus software may flag the Steam Review Analyser as potentially unwanted software or malware. This is a **false positive** - the application is safe and legitimate.

## Why This Happens
1. **PyInstaller Executables** - The bundled Python backend is created with PyInstaller, which is commonly flagged
2. **Unsigned Executables** - The application isn't code-signed with an expensive certificate 
3. **Network Activity** - The app makes legitimate API calls to Steam and LLM providers
4. **File Creation** - The app creates output files and manages configuration

## What We've Done to Minimize False Positives

### ✅ Backend Improvements
- Added version information to the backend executable
- Included proper company and product metadata
- Used clean PyInstaller build with explicit imports
- Added proper file descriptions and copyright info

### ✅ Electron App Improvements  
- Added publisher information
- Included proper metadata in package.json
- Used official Electron signing practices
- Disabled unnecessary features that trigger AV

### ✅ Build Process Improvements
- Clean build environment
- Explicit dependency management
- Proper file structure and organization

## For End Users

### If Your Antivirus Blocks the App:

1. **Add to Exceptions/Whitelist**
   - Add the installation directory to your antivirus exceptions
   - Whitelist both the main app and backend executable

2. **Temporary Disable During Installation**
   - Temporarily disable real-time protection
   - Install the application
   - Re-enable protection and add exceptions

3. **Use Windows Defender SmartScreen Override**
   - If SmartScreen blocks, click "More info" → "Run anyway"

### Safe Download Verification
- Only download from official GitHub releases
- Verify file sizes match expected values
- Check that executables are properly signed (when available)

## For Developers/Distributors

### Long-term Solutions:

1. **Code Signing Certificate** (Recommended)
   ```bash
   # Purchase from a trusted CA (DigiCert, Sectigo, etc.)
   # Cost: ~$200-400/year
   # Significantly reduces false positives
   ```

2. **Submit to Antivirus Vendors**
   - Submit to major AV vendors for whitelisting
   - Provide source code for review if requested

3. **Windows App Certification**
   - Submit to Microsoft Store (if applicable)
   - Get Windows compatibility certification

4. **VirusTotal Submission**
   - Upload builds to VirusTotal for analysis
   - Monitor detection rates

### Build Improvements Made:

```python
# Backend version info added
VSVersionInfo(
  ffi=FixedFileInfo(
    filevers=(1, 0, 0, 0),
    prodvers=(1, 0, 0, 0),
    # ... proper metadata
  ),
  kids=[
    StringFileInfo([
      StringTable(u'040904B0', [
        StringStruct(u'CompanyName', u'Steam Review Analyser'),
        StringStruct(u'FileDescription', u'Steam Review Analyser Backend Server'),
        # ... more metadata
      ])
    ])
  ]
)
```

## User Instructions Template

When distributing, include these instructions:

---

**If your antivirus blocks Steam Review Analyser:**

This is a false positive. The app is safe and legitimate. To resolve:

1. **Windows Defender**: Add installation folder to exclusions
2. **Other Antivirus**: Add to whitelist/exceptions  
3. **SmartScreen**: Click "More info" → "Run anyway"

The app needs network access to:
- Fetch Steam reviews (Steam API)
- Connect to AI services (OpenAI, etc.)
- Check for updates

**File locations to whitelist:**
- Installation directory (usually `C:\Program Files\Steam Review Analyser\`)
- User data directory (`%APPDATA%\steam-review-analyser\`)

---

## Technical Details

### Bundled Components:
- **Electron** - Desktop app framework
- **Python Backend** - FastAPI server (PyInstaller bundle)
- **Dependencies** - pandas, numpy, requests, etc.

### Network Behavior:
- HTTP requests to Steam Web API
- HTTPS requests to LLM providers
- WebSocket connections (localhost only)
- No data collection or telemetry

### File System Access:
- Read/write configuration files
- Create output directories for results  
- Read Steam game data
- Write analysis reports

All behavior is legitimate and necessary for the application's functionality.