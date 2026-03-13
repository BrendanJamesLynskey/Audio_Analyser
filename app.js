/* ── Audio Analyser ── UI & Visualisation Controller ── */

const engine = new AnalyserEngine();
let listening = false;
let animId = null;
let particles = [];
let history = []; // scrolling spectrogram history

// ── DOM ──
const btnListen  = document.getElementById('btn-listen');
const modeButtons = document.querySelectorAll('.mode-btn');
const sliderGain  = document.getElementById('slider-gain');
const sliderSmooth = document.getElementById('slider-smooth');
const sliderBright = document.getElementById('slider-bright');
const valGain     = document.getElementById('val-gain');
const valSmooth   = document.getElementById('val-smooth');
const valBright   = document.getElementById('val-bright');
const infoBar     = document.getElementById('info-bar');
const canvasMain  = document.getElementById('viz-main');
const canvasTime  = document.getElementById('viz-time');
const ctxMain     = canvasMain.getContext('2d');
const ctxTime     = canvasTime.getContext('2d');

let brightness = 1.0;
let dpr = window.devicePixelRatio || 1;

// ── Resize ──
function resize() {
  dpr = window.devicePixelRatio || 1;

  canvasMain.width = window.innerWidth * dpr;
  canvasMain.height = Math.floor(window.innerHeight * 0.7) * dpr;
  canvasMain.style.width = window.innerWidth + 'px';
  canvasMain.style.height = Math.floor(window.innerHeight * 0.7) + 'px';

  canvasTime.width = window.innerWidth * dpr;
  canvasTime.height = Math.floor(window.innerHeight * 0.3) * dpr;
  canvasTime.style.width = window.innerWidth + 'px';
  canvasTime.style.height = Math.floor(window.innerHeight * 0.3) + 'px';

  history = [];
  initParticles();
}

// ── Particles ──
function initParticles() {
  particles = [];
  const w = canvasMain.width;
  const h = canvasMain.height;
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.5 + 0.5,
      a: Math.random() * 0.2 + 0.05,
      hue: 220 + Math.random() * 60
    });
  }
}

// ── Toggle Listening ──
async function toggleListen() {
  if (!listening) {
    try {
      await engine.start();
      listening = true;
      btnListen.textContent = 'STOP';
      btnListen.classList.add('active');
      history = [];
      draw();
    } catch (e) {
      console.error('Microphone access denied:', e);
    }
  } else {
    listening = false;
    engine.stop();
    btnListen.textContent = 'LISTEN';
    btnListen.classList.remove('active');
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    fadeOut();
  }
}

// ── Mode Selection ──
function selectMode(mode) {
  engine.setMode(mode);
  modeButtons.forEach(b => {
    b.classList.toggle('selected', b.dataset.mode === mode);
  });
  history = [];
}

// ── Slider Handlers ──
function updateGain() {
  const v = sliderGain.value / 100;
  valGain.textContent = Math.round(v * 100) + '%';
}

function updateSmoothing() {
  const v = sliderSmooth.value / 100;
  valSmooth.textContent = (v * 100).toFixed(0) + '%';
  if (engine.analyser) {
    engine.analyser.smoothingTimeConstant = v;
  }
}

function updateBrightness() {
  brightness = sliderBright.value / 100;
  valBright.textContent = Math.round(brightness * 100) + '%';
}

// ── Colour Maps ──
function spectralColor(t, alpha) {
  // Deep blue → cyan → green → yellow → magenta → white
  const a = alpha * brightness;
  if (t < 0.2)  return `hsla(240, 80%, ${20 + t * 200}%, ${a})`;
  if (t < 0.4)  return `hsla(${240 - (t - 0.2) * 600}, 85%, ${40 + (t - 0.2) * 100}%, ${a})`;
  if (t < 0.6)  return `hsla(${120 + (t - 0.4) * 300}, 80%, ${50 + (t - 0.4) * 50}%, ${a})`;
  if (t < 0.8)  return `hsla(${60 - (t - 0.6) * 200}, 90%, ${55 + (t - 0.6) * 80}%, ${a})`;
  return `hsla(${300 + (t - 0.8) * 300}, 70%, ${70 + (t - 0.8) * 150}%, ${a})`;
}

function heatColor(t) {
  if (t < 0.33) return `rgb(${Math.round(t * 3 * 200)}, 0, ${Math.round(t * 3 * 180)})`;
  if (t < 0.66) return `rgb(200, ${Math.round((t - 0.33) * 3 * 200)}, ${Math.round(180 - (t - 0.33) * 3 * 180)})`;
  return `rgb(${200 + Math.round((t - 0.66) * 3 * 55)}, 200, ${Math.round((t - 0.66) * 3 * 255)})`;
}

// ── Main Draw Loop ──
function draw() {
  if (!listening) return;
  animId = requestAnimationFrame(draw);

  const analysis = engine.getAnalysisData();
  const timeData = engine.getTimeDomainData();
  const gain = sliderGain.value / 100;

  drawMainViz(analysis, gain);
  drawTimeWaveform(timeData, analysis.data);
  updateInfo();
}

// ── Main Visualisation (upper 70%) ──
function drawMainViz(analysis, gain) {
  const w = canvasMain.width;
  const h = canvasMain.height;
  const { data, freqs, labels } = analysis;
  const mode = engine.mode;

  // Fade trail
  ctxMain.fillStyle = 'rgba(10, 10, 24, 0.12)';
  ctxMain.fillRect(0, 0, w, h);

  // ── Spectrogram waterfall (scrolling) ──
  const sliceHeight = 2 * dpr;

  // Build current column
  const col = new Array(data.length);
  for (let i = 0; i < data.length; i++) {
    col[i] = Math.min(1, data[i] * (0.5 + gain * 1.5));
  }
  history.push(col);

  const maxSlices = Math.floor(h * 0.4 / sliceHeight);
  if (history.length > maxSlices) history.shift();

  // Draw spectrogram in top portion
  const spectroH = h * 0.4;
  for (let row = 0; row < history.length; row++) {
    const slice = history[row];
    const y = spectroH - (history.length - row) * sliceHeight;
    const binW = w / slice.length;
    for (let i = 0; i < slice.length; i++) {
      const v = slice[i];
      if (v < 0.02) continue;
      ctxMain.fillStyle = heatColor(v * brightness);
      ctxMain.fillRect(i * binW, y, binW + 1, sliceHeight);
    }
  }

  // ── Bar / curve visualisation (lower 60% of main canvas) ──
  const barAreaTop = spectroH + 10 * dpr;
  const barAreaH = h - barAreaTop - 20 * dpr;
  const barW = w / data.length;

  // Glow layer
  ctxMain.save();
  ctxMain.globalAlpha = 0.6;
  ctxMain.shadowBlur = 12 * dpr;

  {
    // STFT, CWT, Constant-Q: smooth curve + bars
    ctxMain.beginPath();
    for (let i = 0; i < data.length; i++) {
      const v = Math.min(1, data[i] * (0.5 + gain * 1.5));
      const x = i * barW + barW / 2;
      const y = barAreaTop + barAreaH * (1 - v);
      if (i === 0) ctxMain.moveTo(x, y);
      else ctxMain.lineTo(x, y);
    }
    ctxMain.strokeStyle = 'rgba(123, 104, 238, 0.7)';
    ctxMain.shadowColor = 'rgba(123, 104, 238, 0.5)';
    ctxMain.lineWidth = 1.5 * dpr;
    ctxMain.stroke();

    // Filled area under curve
    ctxMain.lineTo(data.length * barW, barAreaTop + barAreaH);
    ctxMain.lineTo(0, barAreaTop + barAreaH);
    ctxMain.closePath();

    const grad = ctxMain.createLinearGradient(0, barAreaTop, 0, barAreaTop + barAreaH);
    grad.addColorStop(0, `rgba(123, 104, 238, ${0.25 * brightness})`);
    grad.addColorStop(0.5, `rgba(78, 205, 196, ${0.12 * brightness})`);
    grad.addColorStop(1, 'rgba(10, 10, 24, 0)');
    ctxMain.fillStyle = grad;
    ctxMain.fill();

    // Thin bars for detail
    const skipFactor = Math.max(1, Math.floor(data.length / 256));
    for (let i = 0; i < data.length; i += skipFactor) {
      const v = Math.min(1, data[i] * (0.5 + gain * 1.5));
      if (v < 0.03) continue;
      const x = i * barW;
      const bh = v * barAreaH;
      ctxMain.fillStyle = spectralColor(i / data.length, 0.35);
      ctxMain.fillRect(x, barAreaTop + barAreaH - bh, Math.max(barW * skipFactor - dpr, 1), bh);
    }
  }
  ctxMain.restore();

  // ── Particles ──
  // Compute bass/mid/high energy for reactivity
  const third = Math.floor(data.length / 3);
  let bass = 0, mid = 0, high = 0;
  for (let i = 0; i < third; i++) bass += data[i];
  for (let i = third; i < third * 2; i++) mid += data[i];
  for (let i = third * 2; i < data.length; i++) high += data[i];
  bass = (bass / third) * gain;
  mid = (mid / third) * gain;
  high = (high / Math.max(1, data.length - third * 2)) * gain;

  for (const p of particles) {
    p.x += p.vx + (Math.random() - 0.5) * bass * 4;
    p.y += p.vy + (Math.random() - 0.5) * mid * 3;
    if (p.x < 0) p.x = w;
    if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    if (p.y > h) p.y = 0;

    const glow = p.a + high * 0.3;
    ctxMain.beginPath();
    ctxMain.arc(p.x, p.y, p.r * (1 + bass * 3), 0, Math.PI * 2);
    ctxMain.fillStyle = `hsla(${p.hue}, 60%, 70%, ${glow})`;
    ctxMain.fill();
  }

  // ── Central glow ──
  const glowR = (0.1 + bass * 0.4) * Math.min(w, h) * 0.5;
  const cg = ctxMain.createRadialGradient(w / 2, h * 0.7, 0, w / 2, h * 0.7, glowR);
  cg.addColorStop(0, `rgba(123, 104, 238, ${0.08 * brightness})`);
  cg.addColorStop(1, 'transparent');
  ctxMain.fillStyle = cg;
  ctxMain.fillRect(0, 0, w, h);

  // ── Labels ──
  ctxMain.fillStyle = 'rgba(136, 136, 170, 0.5)';
  ctxMain.font = `${10 * dpr}px Inter, sans-serif`;
  for (let i = 0; i < labels.length; i++) {
    const x = (i / labels.length) * w + 4 * dpr;
    ctxMain.fillText(labels[i], x, barAreaTop + barAreaH + 14 * dpr);
  }
}

// ── Time-Domain Waveform (lower 30%) ──
function drawTimeWaveform(timeData, freqData) {
  const w = canvasTime.width;
  const h = canvasTime.height;
  const gain = sliderGain.value / 100;

  // Dark clear
  ctxTime.fillStyle = 'rgba(10, 10, 24, 0.25)';
  ctxTime.fillRect(0, 0, w, h);

  // Compute RMS for colour intensity
  let rms = 0;
  for (let i = 0; i < timeData.length; i++) rms += timeData[i] * timeData[i];
  rms = Math.sqrt(rms / timeData.length);
  const intensity = Math.min(1, rms * 4 * (0.5 + gain));

  // Center line
  ctxTime.strokeStyle = 'rgba(123, 104, 238, 0.08)';
  ctxTime.lineWidth = 1;
  ctxTime.beginPath();
  ctxTime.moveTo(0, h / 2);
  ctxTime.lineTo(w, h / 2);
  ctxTime.stroke();

  // Grid lines at ±0.5
  ctxTime.strokeStyle = 'rgba(123, 104, 238, 0.04)';
  ctxTime.beginPath();
  ctxTime.moveTo(0, h * 0.25);
  ctxTime.lineTo(w, h * 0.25);
  ctxTime.moveTo(0, h * 0.75);
  ctxTime.lineTo(w, h * 0.75);
  ctxTime.stroke();

  // Main waveform
  const samples = timeData.length;
  const step = w / samples;

  // Glow waveform (wider, blurred)
  ctxTime.save();
  ctxTime.shadowBlur = 8 * dpr;
  ctxTime.shadowColor = `rgba(78, 205, 196, ${0.3 * brightness})`;
  ctxTime.strokeStyle = `rgba(78, 205, 196, ${(0.15 + intensity * 0.4) * brightness})`;
  ctxTime.lineWidth = 3 * dpr;
  ctxTime.beginPath();
  for (let i = 0; i < samples; i++) {
    const x = i * step;
    const y = h / 2 - timeData[i] * (h / 2) * 0.85 * (0.5 + gain);
    if (i === 0) ctxTime.moveTo(x, y);
    else ctxTime.lineTo(x, y);
  }
  ctxTime.stroke();
  ctxTime.restore();

  // Sharp waveform on top
  ctxTime.strokeStyle = `rgba(123, 104, 238, ${(0.4 + intensity * 0.5) * brightness})`;
  ctxTime.lineWidth = 1.5 * dpr;
  ctxTime.beginPath();
  for (let i = 0; i < samples; i++) {
    const x = i * step;
    const y = h / 2 - timeData[i] * (h / 2) * 0.85 * (0.5 + gain);
    if (i === 0) ctxTime.moveTo(x, y);
    else ctxTime.lineTo(x, y);
  }
  ctxTime.stroke();

  // Fill under waveform
  ctxTime.lineTo(w, h / 2);
  ctxTime.lineTo(0, h / 2);
  ctxTime.closePath();
  const grad = ctxTime.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `rgba(123, 104, 238, ${0.04 * brightness})`);
  grad.addColorStop(0.5, `rgba(78, 205, 196, ${0.06 * brightness * intensity})`);
  grad.addColorStop(1, `rgba(123, 104, 238, ${0.04 * brightness})`);
  ctxTime.fillStyle = grad;
  ctxTime.fill();

  // Amplitude labels
  ctxTime.fillStyle = 'rgba(136, 136, 170, 0.35)';
  ctxTime.font = `${9 * dpr}px Inter, sans-serif`;
  ctxTime.fillText('+1.0', 4 * dpr, h * 0.08);
  ctxTime.fillText(' 0.0', 4 * dpr, h * 0.5 + 4 * dpr);
  ctxTime.fillText('-1.0', 4 * dpr, h * 0.94);
}

// ── Info Bar ──
function updateInfo() {
  const modeNames = { stft: 'STFT', cwt: 'CWT', constantq: 'Constant-Q' };
  const sr = engine.getSampleRate();
  infoBar.textContent = `${modeNames[engine.mode]} · ${sr} Hz · FFT ${engine.fftSize}`;
}

// ── Fade Out ──
function fadeOut() {
  let alpha = 1;
  function fade() {
    alpha -= 0.03;
    if (alpha <= 0) return;
    ctxMain.fillStyle = `rgba(10, 10, 24, 0.08)`;
    ctxMain.fillRect(0, 0, canvasMain.width, canvasMain.height);
    ctxTime.fillStyle = `rgba(10, 10, 24, 0.08)`;
    ctxTime.fillRect(0, 0, canvasTime.width, canvasTime.height);
    requestAnimationFrame(fade);
  }
  fade();
}

// ── Event Bindings ──
btnListen.addEventListener('click', toggleListen);

modeButtons.forEach(b => {
  b.addEventListener('click', () => selectMode(b.dataset.mode));
});

sliderGain.addEventListener('input', updateGain);
sliderSmooth.addEventListener('input', updateSmoothing);
sliderBright.addEventListener('input', updateBrightness);

window.addEventListener('resize', resize);

// ── Init ──
resize();
updateGain();
updateSmoothing();
updateBrightness();
