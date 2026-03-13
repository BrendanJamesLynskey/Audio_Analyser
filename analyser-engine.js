/* ── Audio Analyser Engine ──
   Provides real-time frequency analysis via multiple transforms:
   STFT, CWT, DWT, and Constant-Q.
   All analysis runs on the Web Audio API AnalyserNode (FFT)
   with post-processing to simulate each transform's behaviour. */

class AnalyserEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
    this.source = null;
    this.running = false;
    this.fftSize = 4096;
    this.mode = 'stft'; // stft | cwt | dwt | constantq
  }

  async start() {
    if (this.running) return;

    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.ctx.createMediaStreamSource(this.stream);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = this.fftSize;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyser.minDecibels = -100;
    this.analyser.maxDecibels = -20;

    this.source.connect(this.analyser);
    this.running = true;

    // Buffers
    this._freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this._timeData = new Float32Array(this.analyser.fftSize);
  }

  stop() {
    if (!this.running) return;
    if (this.source) this.source.disconnect();
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.ctx) this.ctx.close();
    this.running = false;
    this.ctx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
  }

  setMode(mode) {
    this.mode = mode;
  }

  getSampleRate() {
    return this.ctx ? this.ctx.sampleRate : 44100;
  }

  /* ── Time-domain waveform ── */
  getTimeDomainData() {
    if (!this.running) return new Float32Array(1024);
    this.analyser.getFloatTimeDomainData(this._timeData);
    return this._timeData;
  }

  /* ── Main analysis output ──
     Returns { data: Float32Array, freqs: Float32Array, labels: string[] }
     data values are normalised 0..1 */
  getAnalysisData() {
    if (!this.running) {
      return { data: new Float32Array(128), freqs: new Float32Array(128), labels: [] };
    }

    this.analyser.getByteFrequencyData(this._freqData);

    switch (this.mode) {
      case 'stft':      return this._stft();
      case 'cwt':       return this._cwt();
      case 'dwt':       return this._dwt();
      case 'constantq': return this._constantQ();
      default:          return this._stft();
    }
  }

  /* ── STFT ──
     Standard linear-frequency magnitude spectrum */
  _stft() {
    const binCount = this.analyser.frequencyBinCount;
    const sr = this.getSampleRate();
    const useBins = Math.min(binCount, 1024);
    const data = new Float32Array(useBins);
    const freqs = new Float32Array(useBins);
    const labels = [];

    for (let i = 0; i < useBins; i++) {
      data[i] = this._freqData[i] / 255;
      freqs[i] = (i * sr) / this.fftSize;
    }

    const step = Math.floor(useBins / 8);
    for (let i = 0; i < 8; i++) {
      const f = freqs[i * step];
      labels.push(f < 1000 ? Math.round(f) + ' Hz' : (f / 1000).toFixed(1) + ' kHz');
    }

    return { data, freqs, labels };
  }

  /* ── CWT (Continuous Wavelet Transform approximation) ──
     Logarithmic frequency mapping with variable bandwidth,
     simulating Morlet wavelet scalogram behaviour */
  _cwt() {
    const numScales = 256;
    const sr = this.getSampleRate();
    const binCount = this.analyser.frequencyBinCount;
    const freqRes = sr / this.fftSize;
    const data = new Float32Array(numScales);
    const freqs = new Float32Array(numScales);
    const labels = [];

    const fMin = 30;
    const fMax = sr / 2;

    for (let s = 0; s < numScales; s++) {
      const t = s / (numScales - 1);
      const centerFreq = fMin * Math.pow(fMax / fMin, t);
      freqs[s] = centerFreq;

      // Wavelet bandwidth proportional to frequency (constant-Q-like for CWT)
      const bandwidth = centerFreq * 0.15;
      const loFreq = Math.max(centerFreq - bandwidth, 0);
      const hiFreq = centerFreq + bandwidth;
      const loBin = Math.max(0, Math.floor(loFreq / freqRes));
      const hiBin = Math.min(binCount - 1, Math.ceil(hiFreq / freqRes));

      // Gaussian-weighted sum across bins
      let sum = 0;
      let wSum = 0;
      for (let b = loBin; b <= hiBin; b++) {
        const bFreq = b * freqRes;
        const dist = (bFreq - centerFreq) / (bandwidth || 1);
        const weight = Math.exp(-0.5 * dist * dist);
        sum += (this._freqData[b] / 255) * weight;
        wSum += weight;
      }

      data[s] = wSum > 0 ? sum / wSum : 0;
    }

    for (let i = 0; i < 8; i++) {
      const idx = Math.floor((i / 7) * (numScales - 1));
      const f = freqs[idx];
      labels.push(f < 1000 ? Math.round(f) + ' Hz' : (f / 1000).toFixed(1) + ' kHz');
    }

    return { data, freqs, labels };
  }

  /* ── DWT (Discrete Wavelet Transform approximation) ──
     Octave-band decomposition: each level represents one octave.
     Shows energy in each sub-band as a staircase-like display. */
  _dwt() {
    const sr = this.getSampleRate();
    const binCount = this.analyser.frequencyBinCount;
    const freqRes = sr / this.fftSize;
    const numLevels = 10; // ~10 octaves from ~20 Hz to ~20 kHz
    const binsPerLevel = 32; // visual resolution within each band
    const totalBins = numLevels * binsPerLevel;
    const data = new Float32Array(totalBins);
    const freqs = new Float32Array(totalBins);
    const labels = [];

    const fBase = 20;

    for (let level = 0; level < numLevels; level++) {
      const fLo = fBase * Math.pow(2, level);
      const fHi = fBase * Math.pow(2, level + 1);
      const loBin = Math.max(0, Math.floor(fLo / freqRes));
      const hiBin = Math.min(binCount - 1, Math.ceil(fHi / freqRes));

      // Average energy in this octave band
      let sum = 0;
      let count = 0;
      for (let b = loBin; b <= hiBin; b++) {
        sum += this._freqData[b] / 255;
        count++;
      }
      const avg = count > 0 ? sum / count : 0;

      // Also get detail: sub-bins within the band
      for (let j = 0; j < binsPerLevel; j++) {
        const idx = level * binsPerLevel + j;
        const subBin = loBin + Math.floor((j / binsPerLevel) * (hiBin - loBin + 1));
        const detail = subBin < binCount ? this._freqData[subBin] / 255 : 0;
        // Blend band average with detail for visual interest
        data[idx] = avg * 0.6 + detail * 0.4;
        freqs[idx] = fLo + (j / binsPerLevel) * (fHi - fLo);
      }

      const mid = fLo * Math.SQRT2;
      labels.push(mid < 1000 ? Math.round(mid) + ' Hz' : (mid / 1000).toFixed(1) + ' kHz');
    }

    return { data, freqs, labels };
  }

  /* ── Constant-Q Transform ──
     Logarithmic frequency spacing with constant Q factor.
     Each bin has the same ratio of center frequency to bandwidth. */
  _constantQ() {
    const sr = this.getSampleRate();
    const binCount = this.analyser.frequencyBinCount;
    const freqRes = sr / this.fftSize;

    const Q = 24; // quality factor
    const binsPerOctave = 36; // 3 bins per semitone
    const fMin = 27.5; // A0
    const fMax = Math.min(sr / 2, 16744); // C10 or Nyquist
    const numOctaves = Math.log2(fMax / fMin);
    const numBins = Math.round(numOctaves * binsPerOctave);

    const data = new Float32Array(numBins);
    const freqs = new Float32Array(numBins);
    const labels = [];

    const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];

    for (let k = 0; k < numBins; k++) {
      const centerFreq = fMin * Math.pow(2, k / binsPerOctave);
      freqs[k] = centerFreq;

      const bandwidth = centerFreq / Q;
      const loFreq = centerFreq - bandwidth / 2;
      const hiFreq = centerFreq + bandwidth / 2;
      const loBin = Math.max(0, Math.floor(loFreq / freqRes));
      const hiBin = Math.min(binCount - 1, Math.ceil(hiFreq / freqRes));

      if (loBin >= binCount) {
        data[k] = 0;
        continue;
      }

      // Hann-windowed sum
      let sum = 0;
      let wSum = 0;
      for (let b = loBin; b <= hiBin; b++) {
        const t = (hiBin > loBin) ? (b - loBin) / (hiBin - loBin) : 0.5;
        const win = 0.5 * (1 - Math.cos(2 * Math.PI * t));
        sum += (this._freqData[b] / 255) * win;
        wSum += win;
      }
      data[k] = wSum > 0 ? sum / wSum : 0;
    }

    // Labels at musical note boundaries
    const labelInterval = Math.floor(numBins / 8);
    for (let i = 0; i < 8; i++) {
      const idx = i * labelInterval;
      const f = freqs[idx];
      if (f !== undefined) {
        const semitone = Math.round(12 * Math.log2(f / 27.5));
        const note = noteNames[((semitone % 12) + 12) % 12];
        const octave = Math.floor((semitone + 9) / 12);
        labels.push(note + octave);
      }
    }

    return { data, freqs, labels };
  }
}
