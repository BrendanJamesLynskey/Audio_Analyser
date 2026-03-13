# Audio Analyser

Real-time audio spectral analyser running entirely in the browser. Captures microphone input and visualises it using three different frequency-analysis techniques -- STFT, CWT, and Constant-Q -- alongside a live time-domain waveform.

**[Launch Audio Analyser](https://brendanjameslynskey.github.io/Audio_Analyser/)**

---

## Features

- **Three analysis modes** -- switch between STFT, CWT, and Constant-Q in real time
- **Scrolling spectrogram** -- heat-mapped waterfall display scrolling with time
- **Time-domain waveform** -- live oscilloscope view of the raw audio signal
- **Audio-reactive particles** -- ambient particle system driven by bass, mid, and high energy bands
- **Desktop and mobile** -- separate builds optimised for each platform
- **Zero dependencies** -- pure Web Audio API, no libraries or frameworks

## Quick Start

```bash
git clone https://github.com/BrendanJamesLynskey/Audio_Analyser.git
cd Audio_Analyser
python3 -m http.server 8000
```

Open `http://localhost:8000` and grant microphone access when prompted.

## Mobile Version

The mobile build is a single self-contained HTML file with all CSS and JavaScript inline. Mobile-specific optimisations include:

- Reduced FFT size (2048 vs 4096) and particle count for smoother performance
- Larger touch targets (minimum 44px) and slider thumbs (22px)
- iOS AudioContext unlock on user gesture
- Safe area insets for Dynamic Island and home indicator
- PWA-capable -- can be added to the home screen

## Files

| File | Purpose |
|---|---|
| `index.html` | Landing page with device detection |
| `desktop.html` | Desktop application shell |
| `style.css` | Shared stylesheet (indigo/violet palette) |
| `analyser-engine.js` | Audio capture and analysis engine |
| `app.js` | UI controller and canvas visualisation |
| `mobile.html` | Self-contained mobile version |

## Controls

| Control | Description |
|---|---|
| **Listen / Stop** | Start or stop microphone capture |
| **STFT** | Short-Time Fourier Transform -- linear frequency spectrum |
| **CWT** | Continuous Wavelet Transform -- logarithmic scalogram |
| **Constant-Q** | Constant-Q Transform -- musical pitch resolution |
| **Gain** | Amplification of the visualisation |
| **Smoothing** | Temporal smoothing of frequency data (0--100%) |
| **Brightness** | Overall brightness of the visual output |

---

## A Brief History of Frequency Analysis

### The Fourier Transform (1807)

Joseph Fourier's insight that any periodic signal can be decomposed into a sum of sinusoids laid the foundation for all spectral analysis. His 1807 memoir *Th&eacute;orie analytique de la chaleur* introduced what we now call the Fourier series, and its continuous extension -- the Fourier Transform -- became the cornerstone of signal processing.

The transform maps a time-domain signal into its constituent frequencies, producing a magnitude spectrum that reveals which frequencies are present and at what amplitude. However, the classical Fourier Transform assumes a stationary signal and provides no information about *when* those frequencies occur.

### The Short-Time Fourier Transform (1946)

Dennis Gabor, the Hungarian-British physicist who later won the Nobel Prize for inventing holography, introduced the Short-Time Fourier Transform in his 1946 paper *Theory of Communication*. Gabor's key innovation was to window the signal into short overlapping segments and compute the Fourier Transform of each segment independently.

This produces a **spectrogram** -- a two-dimensional representation of frequency content evolving over time. The STFT remains the most widely used spectral analysis technique in audio, speech processing, and music information retrieval.

The fundamental trade-off of the STFT is the **uncertainty principle**: a narrow window gives good time resolution but poor frequency resolution, while a wide window gives good frequency resolution but poor time localisation. This fixed time-frequency resolution is the STFT's greatest limitation and the primary motivation for wavelet-based approaches.

### The Continuous Wavelet Transform (1980s)

The limitations of the STFT motivated the development of wavelet analysis. While the mathematical roots trace back to Alfred Haar's 1909 wavelet and the work of Paul L&eacute;vy in the 1930s, the modern Continuous Wavelet Transform emerged from the work of Jean Morlet and Alex Grossmann in the early 1980s.

Morlet, a geophysicist at Elf Aquitaine analysing seismic signals, found that the fixed-resolution STFT was inadequate for signals containing both low-frequency trends and high-frequency transients. He developed the **Morlet wavelet** -- a Gaussian-windowed complex sinusoid -- and, together with the theoretical physicist Grossmann, formalised the CWT in their landmark 1984 paper.

The CWT analyses a signal by correlating it with scaled and shifted versions of a mother wavelet. At low frequencies (large scales), the wavelet stretches, providing excellent frequency resolution; at high frequencies (small scales), it compresses, providing excellent time resolution. This **multi-resolution** property makes the CWT naturally suited to audio analysis, where bass notes are sustained and require precise frequency identification, while transients like drum hits require precise temporal localisation.

The resulting **scalogram** is a time-scale (or equivalently, time-frequency) representation with resolution that adapts to the content -- a significant advantage over the STFT's fixed grid.

### The Constant-Q Transform (1991)

Judith Brown introduced the Constant-Q Transform in her 1991 paper *Calculation of a constant Q spectral transform*, specifically designed for musical signal analysis. The key insight is that in Western music, the frequency ratio between adjacent notes is constant (the twelfth root of two for equal temperament), so a useful musical analysis should have frequency bins that are logarithmically spaced with a **constant quality factor** Q -- the ratio of each bin's centre frequency to its bandwidth.

In the STFT, each frequency bin has the same absolute bandwidth (determined by the window length), which means low-frequency bins span many musical notes while high-frequency bins may not even resolve adjacent semitones. The Constant-Q Transform solves this by using longer analysis windows for lower frequencies and shorter windows for higher frequencies, yielding bins that align precisely with musical pitch.

The original CQT was computationally expensive, but efficient algorithms developed by Brown and Puckette (1992) and later by Sch&ouml;rkhuber and Klapuri (2010) made real-time implementation feasible. Today the Constant-Q Transform is standard in music information retrieval, automatic transcription, chord recognition, and any application where pitch resolution matters more than absolute frequency precision.

---

## How It Works

1. **Microphone capture** -- `getUserMedia()` feeds a `MediaStreamSource` into the Web Audio API graph
2. **FFT analysis** -- an `AnalyserNode` (FFT size 4096 on desktop, 2048 on mobile) produces the raw magnitude spectrum
3. **Post-processing** -- depending on the selected mode, the raw FFT bins are remapped:
   - **STFT**: displayed directly as a linear frequency spectrum
   - **CWT**: Gaussian-weighted interpolation across logarithmically spaced centre frequencies, simulating Morlet wavelet behaviour
   - **Constant-Q**: Hann-windowed summation with logarithmic bin spacing and constant Q factor
4. **Visualisation** -- dual-canvas rendering: scrolling spectrogram + spectral curve (upper), time-domain oscilloscope (lower), with audio-reactive particles and ambient glow effects

## License

MIT
