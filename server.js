const express = require('express');
const sharp = require('sharp');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');

// Kill existing node processes on startup
try {
    if (os.platform() === 'win32') {
        execSync('taskkill /im node.exe /f /fi "PID ne ' + process.pid + '"', { stdio: 'ignore' });
    } else {
        execSync(`pkill -f "node server.js" || true`, { stdio: 'ignore' });
    }
} catch (err) {
    // Ignore errors
}

const app = express();
const port = 3001;

app.get('/', async (req, res) => {
    const minframe = parseInt(req.query.minframe) || 1;
    const maxframe = parseInt(req.query.maxframe) || 10;
    const frames = [];

    for (let i = minframe; i <= maxframe; i++) {
        console.log(`Reading image ${i}`);
        try {
            const imagePath = path.join(__dirname, 'images', `${i}.png`);
            const image = sharp(imagePath);
            const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
            const pixels = [];
            for (let y = 0; y < info.height; y++) {
                pixels[y] = [];
                for (let x = 0; x < info.width; x++) {
                    const idx = (y * info.width + x) * 3;
                    const r = data[idx].toString(16).padStart(2, '0');
                    const g = data[idx + 1].toString(16).padStart(2, '0');
                    const b = data[idx + 2].toString(16).padStart(2, '0');
                    pixels[y][x] = `#${r}${g}${b}`;
                }
            }
            frames.push(pixels);
            console.log(`Pushed frame ${i}`);
        } catch (err) {
            console.error(`Error reading image ${i}.png:`, err);
            // Skip or push null if needed
        }
    }
    res.json(frames);
});

app.listen(port, () => {
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:${port}`);
    console.log(`[${new Date().toISOString()}] API: http://localhost:${port}?minframe=1&maxframe=10`);
});