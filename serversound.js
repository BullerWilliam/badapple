const express = require('express');
const path = require('path');
const fs = require('fs');
const { execSync, spawnSync } = require('child_process');
const os = require('os');

// Kill existing node processes on startup
try {
    if (os.platform() === 'win32') {
        execSync('taskkill /im node.exe /f /fi "PID ne ' + process.pid + '"', { stdio: 'ignore' });
    } else {
        execSync('pkill -f "node server sound.js" || true', { stdio: 'ignore' });
    }
} catch (err) {
    // Ignore errors
}

const app = express();
const port = 3002;

const SAMPLE_RATE = 44100;
const SAMPLES_PER_SECOND = 400;
const BASE_FREQ_HZ = 20;
const MIN_PITCH_HZ = 20;
const MAX_PITCH_HZ = 2000;

function resolveSoundPath(soundQuery) {
    if (!soundQuery || typeof soundQuery !== 'string') {
        return null;
    }

    const safeName = path.basename(soundQuery.trim());
    if (!safeName) {
        return null;
    }

    const name = safeName.toLowerCase().endsWith('.mp3')
        ? safeName.slice(0, -4)
        : safeName;

    if (!name) {
        return null;
    }

    const soundsDir = path.join(__dirname, 'sounds');
    const soundPath = path.join(soundsDir, `${name}.mp3`);
    const resolved = path.resolve(soundPath);
    const resolvedDir = path.resolve(soundsDir) + path.sep;

    if (!resolved.startsWith(resolvedDir)) {
        return null;
    }

    return soundPath;
}

function getDurationSeconds(soundPath) {
    const result = spawnSync(
        'ffprobe',
        [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            soundPath
        ],
        { encoding: 'utf8' }
    );

    if (result.error) {
        throw new Error('ffprobe is not available on PATH');
    }

    if (result.status !== 0) {
        throw new Error((result.stderr || 'ffprobe failed').toString());
    }

    const duration = parseFloat((result.stdout || '').trim());
    if (!Number.isFinite(duration)) {
        throw new Error('Unable to read duration');
    }

    return duration;
}

function getPcmSamples(soundPath, startSeconds, durationSeconds) {
    const result = spawnSync(
        'ffmpeg',
        [
            '-ss', startSeconds.toString(),
            '-t', durationSeconds.toString(),
            '-i', soundPath,
            '-vn',
            '-ac', '1',
            '-ar', SAMPLE_RATE.toString(),
            '-f', 's16le',
            'pipe:1'
        ],
        {
            encoding: 'buffer',
            maxBuffer: 50 * 1024 * 1024
        }
    );

    if (result.error) {
        throw new Error('ffmpeg is not available on PATH');
    }

    if (result.status !== 0) {
        throw new Error((result.stderr || 'ffmpeg failed').toString());
    }

    const buffer = result.stdout || Buffer.alloc(0);
    const sampleCount = Math.floor(buffer.length / 2);
    return new Int16Array(buffer.buffer, buffer.byteOffset, sampleCount);
}

function estimatePitchHz(samples, sampleRate) {
    const n = samples.length;
    if (n < 32) {
        return null;
    }

    let mean = 0;
    for (let i = 0; i < n; i++) {
        mean += samples[i];
    }
    mean /= n;

    for (let i = 0; i < n; i++) {
        samples[i] -= mean;
    }

    let energy = 0;
    for (let i = 0; i < n; i++) {
        energy += samples[i] * samples[i];
    }

    if (energy < 1e-6) {
        return null;
    }

    const minLag = Math.max(1, Math.floor(sampleRate / MAX_PITCH_HZ));
    const maxLag = Math.min(n - 1, Math.floor(sampleRate / MIN_PITCH_HZ));

    let bestLag = -1;
    let bestCorr = 0;

    for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0;
        for (let i = 0; i < n - lag; i++) {
            corr += samples[i] * samples[i + lag];
        }
        if (corr > bestCorr) {
            bestCorr = corr;
            bestLag = lag;
        }
    }

    if (bestLag === -1) {
        return null;
    }

    return sampleRate / bestLag;
}

function buildPitchAndVolume(int16Samples, secondsCount) {
    const windowSamples = Math.floor(SAMPLE_RATE / SAMPLES_PER_SECOND);
    const pitches = [];
    const volumes = [];

    for (let secondIndex = 0; secondIndex < secondsCount; secondIndex++) {
        const pitchRow = [];
        const volumeRow = [];
        for (let sampleIndex = 0; sampleIndex < SAMPLES_PER_SECOND; sampleIndex++) {
            const startSample = (secondIndex * SAMPLES_PER_SECOND + sampleIndex) * windowSamples;
            const window = new Float32Array(windowSamples);

            for (let i = 0; i < windowSamples; i++) {
                const idx = startSample + i;
                window[i] = idx < int16Samples.length ? int16Samples[idx] / 32768 : 0;
            }

            const hz = estimatePitchHz(window, SAMPLE_RATE);
            const multiplier = hz ? hz / BASE_FREQ_HZ : 1;
            pitchRow.push(Number(multiplier.toFixed(2)));

            let sumSq = 0;
            for (let i = 0; i < window.length; i++) {
                const v = window[i];
                sumSq += v * v;
            }
            const rms = window.length ? Math.sqrt(sumSq / window.length) : 0;
            const volume = Math.min(1, rms * 20);
            volumeRow.push(Number(volume.toFixed(3)));
        }
        pitches.push(pitchRow);
        volumes.push(volumeRow);
    }

    return { pitches, volumes };
}

app.get('/', async (req, res) => {
    const soundPath = resolveSoundPath(req.query.sound);
    if (!soundPath) {
        return res.status(400).json({ error: 'sound parameter required (name without path)' });
    }

    if (!fs.existsSync(soundPath)) {
        return res.status(404).json({ error: 'Sound not found' });
    }

    if (req.query.amount !== undefined) {
        try {
            const duration = getDurationSeconds(soundPath);
            const seconds = Math.ceil(duration);
            return res.json({
                seconds,
                fps: SAMPLES_PER_SECOND
            });
        } catch (err) {
            return res.status(500).json({ error: err.message || 'Unable to read duration' });
        }
    }

    const minSound = Number.parseInt(req.query.minsound, 10);
    const maxSound = Number.parseInt(req.query.maxsound, 10);
    const startSecond = Number.isFinite(minSound) ? minSound : 1;
    const endSecond = Number.isFinite(maxSound) ? maxSound : 10;

    if (startSecond < 1 || endSecond < startSecond) {
        return res.status(400).json({ error: 'minsound must be >= 1 and maxsound must be >= minsound' });
    }

    const secondsCount = endSecond - startSecond + 1;
    const startSeconds = startSecond - 1;

    try {
        const samples = getPcmSamples(soundPath, startSeconds, secondsCount);
        const data = buildPitchAndVolume(samples, secondsCount);
        return res.json({
            fps: SAMPLES_PER_SECOND,
            seconds: secondsCount,
            pitches: data.pitches,
            volumes: data.volumes
        });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Unable to process audio' });
    }
});

app.listen(port, () => {
    console.log(`[${new Date().toISOString()}] Server running on http://localhost:${port}`);
    console.log(`[${new Date().toISOString()}] API: http://localhost:${port}?minsound=1&maxsound=10&sound=example`);
});
