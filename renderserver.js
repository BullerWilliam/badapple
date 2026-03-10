const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const os = require('os');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;

// Self-ping function to prevent Render.com from shutting down the server
function startSelfPing() {
    setInterval(() => {
        // Random interval between 1-5 minutes
        const randomDelay = Math.random() * (5 - 1) + 1; // 1-5 minutes
        
        setTimeout(() => {
            const randomFrame = Math.floor(Math.random() * 100) + 1;
            const options = {
                hostname: 'localhost',
                port: PORT,
                path: `/?minframe=${randomFrame}&maxframe=${randomFrame + 1}&anim=badapple`,
                method: 'GET',
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    console.log(`[PING] Self-ping successful at ${new Date().toISOString()}`);
                });
            });

            req.on('error', (err) => {
                console.log(`[PING] Self-ping error: ${err.message}`);
            });

            req.on('timeout', () => {
                req.destroy();
                console.log(`[PING] Self-ping timeout`);
            });

            req.end();
        }, randomDelay * 60 * 1000);
    }, 1); // Start first ping immediately
}

app.get('/', async (req, res) => {
    const anim = req.query.anim;
    
    // If amount query is present, return frame count for the animation
    if (req.query.amount !== undefined) {
        if (!anim) {
            return res.status(400).json({ error: 'anim parameter required when using amount' });
        }
        const imagesDir = path.join(__dirname, 'anims', anim, 'images');
        try {
            const files = fs.readdirSync(imagesDir).filter(file => file.endsWith('.png'));
            const frameCount = files.length;
            return res.json({ frames: frameCount });
        } catch (err) {
            return res.status(404).json({ error: 'Animation not found' });
        }
    }
    
    // Original logic for frame data
    const minframe = parseInt(req.query.minframe) || 1;
    const maxframe = parseInt(req.query.maxframe) || 10;
    const imagesDir = anim 
        ? path.join(__dirname, 'anims', anim, 'images')
        : path.join(__dirname, 'images');
    const frames = [];

    for (let i = minframe; i <= maxframe; i++) {
        console.log(`Reading image ${i} from ${imagesDir}`);
        try {
            const imagePath = path.join(imagesDir, `${i}.png`);
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

app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
    console.log(`[${new Date().toISOString()}] API: http://localhost:${PORT}?minframe=1&maxframe=10&anim=badapple`);
    console.log(`[${new Date().toISOString()}] Starting self-ping to prevent server shutdown...`);
    startSelfPing();
});
