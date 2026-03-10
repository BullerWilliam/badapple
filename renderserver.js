const express = require('express');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');
const os = require('os');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;

// Check if ffmpeg is available
let ffmpegAvailable = false;
let ffprobeAvailable = false;
try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    ffmpegAvailable = true;
    console.log('[INIT] ffmpeg is available');
} catch (err) {
    console.log('[INIT] ffmpeg not found, will use fallback');
}

try {
    execSync('ffprobe -version', { stdio: 'ignore' });
    ffprobeAvailable = true;
    console.log('[INIT] ffprobe is available');
} catch (err) {
    console.log('[INIT] ffprobe not found');
}

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
    // Set a timeout for the entire request (30 seconds)
    const timeout = setTimeout(() => {
        if (!res.headersSent) {
            res.status(504).json({ error: 'Request timeout', details: 'Video processing took too long' });
        }
    }, 30000);

    try {
    
    // If amount query is present, return frame count for the animation (using video duration)
    if (req.query.amount !== undefined) {
        const anim = req.query.anim;
        if (!anim) {
            return res.status(400).json({ error: 'anim parameter required when using amount' });
        }
        const videoPath = path.join(__dirname, 'videos', `${anim}.mp4`);
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Animation not found' });
        }
        try {
            if (!ffprobeAvailable) {
                return res.status(500).json({ error: 'Video probing not available', details: 'ffprobe not found' });
            }
            // use ffprobe to get duration
            const dur = execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`).toString().trim();
            const seconds = parseFloat(dur);
            const frameCount = Math.floor(seconds * 10); // 10 fps sample
            clearTimeout(timeout);
            return res.json({ frames: frameCount });
        } catch (err) {
            console.error('ffprobe error:', err.message);
            return res.status(500).json({ error: 'Could not probe video', details: err.message });
        }
    }
    
    // Require anim parameter
    const anim = req.query.anim;
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

    // Extract all frames at 10 FPS using ffmpeg (like the Python script)
    const extractAllFrames = () => {
        return new Promise((resolve, reject) => {
            if (!ffmpegAvailable) {
                reject(new Error('ffmpeg not available'));
                return;
            }

            const allFrames = [];
            const ffmpeg = spawn('ffmpeg', [
                '-i', videoPath,
                '-vf', 'fps=10,scale=128:80',
                '-f', 'rawvideo',
                '-pix_fmt', 'rgb24',
                '-'
            ]);

            const chunks = [];
            let timeout = setTimeout(() => {
                ffmpeg.kill();
                reject(new Error('ffmpeg extraction timeout'));
            }, 120000); // 2 minute timeout for video processing

            ffmpeg.stdout.on('data', (chunk) => chunks.push(chunk));
            ffmpeg.stderr.on('data', () => {}); // ignore stderr
            ffmpeg.on('close', (code) => {
                clearTimeout(timeout);
                if (code === 0) {
                    // Process the raw video data into frames
                    const buffer = Buffer.concat(chunks);
                    const frameSize = 128 * 80 * 3; // width * height * 3 bytes per pixel
                    const frameCount = Math.floor(buffer.length / frameSize);
                    
                    for (let i = 0; i < frameCount; i++) {
                        const frameBuffer = buffer.slice(i * frameSize, (i + 1) * frameSize);
                        allFrames.push(bufferToHex(frameBuffer));
                    }
                    
                    resolve(allFrames);
                } else {
                    reject(new Error(`ffmpeg exited with code ${code}`));
                }
            });
            ffmpeg.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
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

    // Fallback: create a simple gradient frame
    const createFallbackFrame = () => {
        const width = 128;
        const height = 80;
        const pixels = [];
        for (let y = 0; y < height; y++) {
            pixels[y] = [];
            for (let x = 0; x < width; x++) {
                // Simple gradient from black to white
                const gray = Math.floor((x / width) * 255);
                const hex = gray.toString(16).padStart(2, '0');
                pixels[y][x] = `#${hex}${hex}${hex}`;
            }
        }
        return pixels;
    };

    try {
        // Extract all frames at once
        const allFrames = await extractAllFrames();
        
        // Return only the requested frame range
        for (let i = minframe - 1; i < Math.min(maxframe, allFrames.length); i++) {
            if (allFrames[i]) {
                frames.push(allFrames[i]);
            } else {
                frames.push(createFallbackFrame());
            }
        }
        
        console.log(`Returning frames ${minframe}-${Math.min(maxframe, allFrames.length)} of ${allFrames.length} total`);
    } catch (err) {
        console.error('Frame extraction error:', err.message);
        // Return fallback frames for the requested range
        for (let i = minframe; i <= maxframe; i++) {
            frames.push(createFallbackFrame());
        }
        console.log('Using fallback frames due to extraction error');
    }

    clearTimeout(timeout);
    res.json(frames);
    } catch (err) {
        clearTimeout(timeout);
        console.error('Request error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error', details: err.message });
        }
    }
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
