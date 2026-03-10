# Bad Apple Video API

A high-performance Node.js/Express API server that extracts frames from video files and serves pixel data in hexadecimal format. Supports multiple animations and is deployable on Render.com.

---

## 📋 Table of Contents

- [Features](#features)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Configuration](#configuration)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)

---

## ✨ Features

- **Frame Extraction**: Automatically extracts frames from video files (MP4 format)
- **Multi-Animation Support**: Process multiple videos into separate animation folders
- **Hex Pixel Format**: Returns pixel data as hex colors (`#RRGGBB`)
- **Frame Queries**: Fetch specific frame ranges or get frame count
- **Server Keep-Alive**: Automatic self-pinging to prevent Render.com shutdown
- **Resolution**: Fixed 64x40 pixel frames for consistency
- **FPS Control**: Configurable frame extraction rate (default: 5 FPS)

---

## 📁 Project Structure

```
badapple/
├── renderserver.js          # Production server for Render.com (with self-ping)
├── server.js                # Local development server
├── build_animations.py      # Frame extraction script
├── extract_frames.py        # Legacy single-video extraction (reference)
├── package.json             # Node.js dependencies and scripts
├── requirements.txt         # Python dependencies
├── render.yaml              # Render.com deployment config
├── Procfile                 # Heroku-style process file
├── videos/                  # Input video files (*.mp4)
├── anims/                   # Output animation folders
│   ├── animation1/
│   │   └── images/          # Numbered PNG frames (1.png, 2.png, ...)
│   ├── animation2/
│   │   └── images/
│   └── ...
└── images/                  # Legacy/default animation frames
```

---

## 🚀 Local Setup

### Prerequisites

- **Node.js** (v14 or higher)
- **Python** (v3.8 or higher)
- **ffmpeg** (optional, for video compatibility)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd badapple
   ```

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Create and activate Python virtual environment** (optional but recommended)
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate
   
   # macOS/Linux
   python -m venv .venv
   source .venv/bin/activate
   ```

4. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

5. **Add video files**
   - Create a `videos/` folder in the project root
   - Add `.mp4` video files to this folder

### Building Animations

Extract frames from all videos in the `videos/` folder:

```bash
npm run build
```

Or manually:
```bash
python build_animations.py
```

This will:
- Create the `anims/` folder
- Process each MP4 file
- Extract frames at 5 FPS
- Resize to 64x40 pixels
- Save as numbered PNGs in `anims/{videoname}/images/`

### Running Locally

**Development server** (includes process cleanup):
```bash
npm run dev
# Server runs on http://localhost:3001
```

**Production server** (includes self-ping):
```bash
npm start
# Server runs on http://localhost:3001
```

---

## 📡 API Documentation

### Base URL
```
http://localhost:3001/
```

### Endpoints

#### 1. **Get Frame Range**
Retrieve pixel data for a range of frames.

**Request:**
```
GET /?minframe=1&maxframe=10&anim=badapple
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `minframe` | integer | No | Starting frame number (default: 1) |
| `maxframe` | integer | No | Ending frame number (default: 10) |
| `anim` | string | No | Animation name (folder in `anims/`). Omit to use default `images/` folder |

**Response:**
```json
[
  [
    ["#000000", "#ffffff", ...],  // Frame 1, row 1
    ["#ff0000", "#00ff00", ...],  // Frame 1, row 2
    ...
  ],
  [
    ["#000000", "#ffffff", ...],  // Frame 2, row 1
    ...
  ]
]
```

**Status Codes:**
- `200` - Success
- `400` - Missing required parameters
- `404` - Animation or frame not found

---

#### 2. **Get Frame Count**
Get the total number of frames for an animation.

**Request:**
```
GET /?amount=1&anim=badapple
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | any | Yes | Trigger count mode (value doesn't matter) |
| `anim` | string | Yes | Animation name |

**Response:**
```json
{
  "frames": 2232
}
```

**Status Codes:**
- `200` - Success
- `400` - Missing `anim` parameter
- `404` - Animation folder not found

---

## 🌐 Deployment

### Render.com Setup

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Render.com**
   - Go to [render.com](https://render.com)
   - Create a new Web Service
   - Connect your GitHub repository

3. **Configuration**
   - Render.com will automatically detect and use `render.yaml`
   - Build command: `pip install -r requirements.txt && npm install && python build_animations.py`
   - Start command: `npm start`

4. **Add Environment Variables** (in Render.com dashboard, if needed)
   - `NODE_ENV`: `production` (already set in render.yaml)

5. **Deploy**
   - Connect the service
   - Render will automatically build and deploy

### Key Features for Production

- **Self-Ping**: Server automatically pings itself every 1-5 minutes to prevent idle shutdown
- **Port Configuration**: Uses `process.env.PORT` for Render.com compatibility
- **Environment Detection**: Automatically detects and uses dynamic port assignment

---

## ⚙️ Configuration

### Video Frame Extraction Settings

Edit `build_animations.py` to customize:

```python
# Frame extraction rate (default: 5 FPS)
frame_interval = int(fps / 5) if fps > 5 else 1

# Resolution (default: 64x40)
frame = cv2.resize(frame, (64, 40))
```

### Server Settings

Edit `renderserver.js` or `server.js`:

```javascript
const PORT = process.env.PORT || 3001;  // Port number

// Self-ping interval (1-5 minutes)
const randomDelay = Math.random() * (5 - 1) + 1;
```

### Python Dependencies

Edit `requirements.txt`:
```
opencv-python>=4.10.0    # Video processing
numpy>=1.26.0            # Numerical computing
```

---

## 💡 Examples

### Using cURL

**Get first 5 frames of badapple animation:**
```bash
curl "http://localhost:3001/?minframe=1&maxframe=5&anim=badapple"
```

**Get frame count:**
```bash
curl "http://localhost:3001/?amount=1&anim=badapple"
```

### Using JavaScript/Fetch

**Get frame data:**
```javascript
const response = await fetch('http://localhost:3001/?minframe=1&maxframe=10&anim=badapple');
const frames = await response.json();

// Process frames
frames.forEach((frame, frameIndex) => {
  frame.forEach((row, rowIndex) => {
    row.forEach((pixel, colIndex) => {
      console.log(`Frame ${frameIndex}, Row ${rowIndex}, Col ${colIndex}: ${pixel}`);
    });
  });
});
```

**Get animation info:**
```javascript
const response = await fetch('http://localhost:3001/?amount=1&anim=badapple');
const data = await response.json();
console.log(`Total frames: ${data.frames}`);
```

### Using Python

**Fetch and display frame data:**
```python
import requests
import json

response = requests.get('http://localhost:3001/?minframe=1&maxframe=5&anim=badapple')
frames = response.json()

for frame_idx, frame in enumerate(frames):
    print(f"Frame {frame_idx + 1}:")
    for row in frame:
        print([pixel for pixel in row[:8]])  # Show first 8 pixels
```

---

## 🔧 Troubleshooting

### Python Import Errors

**Error:** `ImportError: numpy.core.multiarray failed to import`

**Solution:** Update Python dependencies
```bash
pip install --upgrade -r requirements.txt
```

### Video Not Found

**Error:** `Error: 'videos' directory not found`

**Solution:** Create the `videos/` folder and add MP4 files:
```bash
mkdir videos
# Copy your .mp4 files to this folder
```

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::3001`

**Solution:** Kill existing process or use different port
```bash
# Windows
taskkill /im node.exe /f

# macOS/Linux
pkill -f "node server.js"

# Or set different port
PORT=3002 npm start
```

### Render.com Build Fails

**Check the following:**
1. Ensure `videos/` folder is in the repository (or `anims/` is pre-built)
2. Verify Python and dependencies are correct in `requirements.txt`
3. Check `render.yaml` syntax (YAML is whitespace-sensitive)
4. Review Render.com build logs for specific errors

### Frames Not Generating

**Verification steps:**
```bash
# Check if videos folder exists
dir videos

# Manually run extraction
python build_animations.py

# Check output
dir anims
```

---

## 📊 Performance Notes

- **Frame Size**: 64×40 pixels × 3 RGB channels = 7,680 bytes per frame
- **Default Response**: 10 frames ≈ 77 KB JSON
- **Processing Time**: ~100-500ms for 10 frames depending on system
- **Self-Ping**: Minimal impact (~1KB per ping, 1-5 min intervals)

---

## 📝 File Formats

### Input
- **Videos**: `.mp4` format (H.264 video, AAC audio recommended)
- **Location**: `videos/` folder

### Output
- **Frames**: PNG format (8-bit RGB)
- **Naming**: Sequential numbers (1.png, 2.png, 3.png, ...)
- **Location**: `anims/{animation_name}/images/`

### Response Format
- **Content-Type**: `application/json`
- **Pixel Format**: Hexadecimal color (`#RRGGBB`)
- **Array Structure**: `[frames][rows][columns]`

---

## 🛠️ Development

### Scripts

```bash
npm run build      # Extract frames from videos
npm run dev        # Run local development server
npm start          # Run production server
```

### File Organization

- **Server Logic**: `renderserver.js` (production), `server.js` (development)
- **Build Logic**: `build_animations.py`
- **Dependencies**: `package.json`, `requirements.txt`
- **Deployment**: `render.yaml`, `Procfile`

---

## 📜 License

This project is open source and available under the ISC license.

---

## 🔗 Related Files

- [package.json](package.json) - Node.js configuration
- [requirements.txt](requirements.txt) - Python dependencies
- [render.yaml](render.yaml) - Render.com deployment config
- [renderserver.js](renderserver.js) - Production server code
- [build_animations.py](build_animations.py) - Frame extraction code

---

## ❓ FAQ

**Q: Can I use different video formats?**
A: Currently supports MP4. Other formats can work if processed through ffmpeg separately.

**Q: Why 64×40 resolution?**
A: Optimized for balance between quality and response size. Edit `build_animations.py` to change.

**Q: How long does frame extraction take?**
A: Depends on video length and FPS. A 10-minute video at 5 FPS ≈ 3,000 frames ≈ 2-5 minutes.

**Q: Can I extract at different FPS rates?**
A: Yes, edit `build_animations.py` line 28: `frame_interval = int(fps / X)` where X is desired FPS.

**Q: Does the server use much bandwidth?**
A: Self-ping uses minimal bandwidth (~1KB per 1-5 minutes). API responses vary with frame requests.

---

**Last Updated:** March 10, 2026  
**Version:** 1.0.0
