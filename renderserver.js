const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const os = require('os');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;

// Self-ping function to prevent Render.com from shutting down the server
function startSelfPing() {
    // always ping localhost instead of external URL
    setInterval(() => {
        // Random interval between 1-5 minutes
        const randomDelay = Math.random() * (5 - 1) + 1; // 1-5 minutes
        
        setTimeout(() => {
            // Ping local root path
            const options = {
                hostname: 'localhost',
                port: PORT,
                path: '/?minframe=1&maxframe=10&anim=badapple',
                method: 'GET',
                timeout: 5000
            };

            const req = http.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    console.log(`[PING] Self-ping successful (${res.statusCode}) at ${new Date().toISOString()}`);
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
    
    // If amount query is present, return frame count for the animation (using video duration)
    if (req.query.amount !== undefined) {
        if (!anim) {
            return res.status(400).json({ error: 'anim parameter required when using amount' });
        }
        const videoPath = path.join(__dirname, 'videos', `${anim}.mp4`);
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Animation not found' });
        }
        try {
            // use ffprobe to get duration
            const { execSync } = require('child_process');
            const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`).toString().trim();
            const seconds = parseFloat(dur);
            const frameCount = Math.floor(seconds * 10); // 10 fps sample
            return res.json({ frames: frameCount });
        } catch (err) {
            return res.status(500).json({ error: 'Could not probe video' });
        }
    }
    
    // Require anim parameter
    if (!anim) {
        return res.status(400).json({ 
            error: 'anim parameter is required',
            hint: 'Usage: /?minframe=1&maxframe=10&anim=animationname'
        });
    }

    const videoPath = path.join(__dirname, 'videos', `${anim}.mp4`);
    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: `Animation "${anim}" not found` });
    }

    // parse requested frame range
    const minframe = parseInt(req.query.minframe) || 1;
    const maxframe = parseInt(req.query.maxframe) || 10;

    const frames = [];

    // helper to grab a frame using ffmpeg by timestamp
    const getFrameBuffer = (timeSec) => {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-ss', timeSec.toString(),
                '-i', videoPath,
                '-vframes', '1',
                '-s', '128x80',
                '-f', 'rawvideo',
                '-pix_fmt', 'rgb24',
                '-' // output to stdout
            ]);

            const chunks = [];
            ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
            ffmpeg.stderr.on('data', () => {}); // ignore
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve(Buffer.concat(chunks));
                } else {
                    reject(new Error('ffmpeg failed')); 
                }
            });
        });
    };

    // function to convert raw rgb buffer to hex grid
    const bufferToHex = (buf) => {
        const width = 128;
        const height = 80;
        const pixels = [];
        for (let y = 0; y < height; y++) {
            pixels[y] = [];
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 3;
                const r = buf[idx].toString(16).padStart(2,'0');
                const g = buf[idx+1].toString(16).padStart(2,'0');
                const b = buf[idx+2].toString(16).padStart(2,'0');
                pixels[y][x] = `#${r}${g}${b}`;
            }
        }
        return pixels;
    };

    // need video duration for time calculation
    let durationSec = 0;
    try {
        const out = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`).toString().trim();
        durationSec = parseFloat(out);
    } catch (err) {
        console.error('ffprobe error', err.message);
    }

    for (let i = minframe; i <= maxframe; i++) {
        const time = (i - 1) / 10; // sample 10fps
        if (time > durationSec) break;
        try {
            const buf = await getFrameBuffer(time);
            frames.push(bufferToHex(buf));
            console.log(`Extracted frame ${i} at ${time}s`);
        } catch (err) {
            console.error(`ffmpeg error for frame ${i}:`, err.message);
        }
    }

    res.json(frames);
});

app.listen(PORT, () => {
    console.log(`[${new Date().toISOString()}] Server running on port ${PORT}`);
    console.log(`[${new Date().toISOString()}] API: http://localhost:${PORT}?minframe=1&maxframe=10&anim=animationname`);
    
    // List available animations
    const animsDir = path.join(__dirname, 'anims');
    try {
        if (fs.existsSync(animsDir)) {
            const animations = fs.readdirSync(animsDir).filter(f => {
                const stat = fs.statSync(path.join(animsDir, f));
                return stat.isDirectory();
            });
            if (animations.length > 0) {
                console.log(`[${new Date().toISOString()}] Available animations: ${animations.join(', ')}`);
                console.log(`[${new Date().toISOString()}] Usage: http://localhost:${PORT}?minframe=1&maxframe=10&anim=${animations[0]}`);
            } else {
                console.log(`[${new Date().toISOString()}] No animations found. Add videos to the 'videos/' folder and rebuild.`);
            }
        } else {
            console.log(`[${new Date().toISOString()}] No animations found. Add videos to the 'videos/' folder and rebuild.`);
        }
    } catch (err) {
        console.log(`[${new Date().toISOString()}] Could not scan animations folder: ${err.message}`);
    }
    
    console.log(`[${new Date().toISOString()}] Starting self-ping to prevent server shutdown...`);
    startSelfPing();
});
