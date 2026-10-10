<div align="center">

# ⚡ Imagira

**Next-Gen Browser-Only Background Remover & HD Image Quality Enhancer**

*Zero Server Uploads • Zero Infrastructure Costs • 100% Privacy-Preserving • Full-Resolution Output*

[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?style=for-the-badge&logo=nextdotjs)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<br/>
<img src="public/assets/demo.gif" alt="Imagira Launch Demo" width="100%" />
<br/>


---

</div>

## 📌 Architecture & Product Thesis

**Imagira** is a high-performance, privacy-first image background removal and quality enhancement platform built entirely on client-side web technologies.

Unlike commercial background removal services that stream your high-resolution images to remote cloud GPUs—incurring bandwidth latency, recurring API costs, and privacy vulnerabilities—**Imagira processes 100% of image data within the user's local browser instance**.

| Feature | Commercial SaaS APIs | **Imagira** |
| :--- | :--- | :--- |
| **Cost Per Image** | $0.02 – $0.09 / execution | **$0.00 (Flat Static Hosting)** |
| **Data Privacy** | Image uploaded to remote cloud | **Never leaves client device** |
| **Free Tier Resolution** | Downscaled / Watermarked | **Full Original Resolution** |
| **Processing Latency** | Network RTT + Queue Time | **~5ms – 50ms (In-Memory)** |
| **Infrastructure Overhead** | Linear with active user count | **Zero (Serverless Static Edge)** |

---

## 🏗️ Technical Architecture

Imagira employs a hybrid **Two-Path Algorithmic Routing Engine** to maximize speed and accuracy:

```
                          [ Input Image (File/Canvas) ]
                                        │
                                        ▼
                      [ Plain Background Detection Engine ]
                        - Border Sample Extraction (Step N)
                        - RGB -> CIE L*a*b* Perceptual Conversion
                        - Delta E Euclidean Variance Check (Threshold: 12)
                                        │
                      ┌─────────────────┴─────────────────┐
                      │ (≥ 92% Border Uniformity)         │ (< 92% Non-Uniform)
                      ▼                                   ▼
          ┌────────────────────────┐         ┌────────────────────────┐
          │  Path A: Fast Flood    │         │  Path B: Neural AI     │
          │  BFS Inward Spread     │         │  ONNX WebGPU / WASM    │
          │  - CIE L*a*b* Queue    │         │  BiRefNet Matting      │
          │  - Alpha Erode & Blur  │         │  (1024x1024 Tensor)    │
          └───────────┬────────────┘         └───────────┬────────────┘
                      │                                   │
                      └─────────────────┬─────────────────┘
                                        │
                                        ▼
                  [ Client-Side Image Enhancement Pipeline ]
                    - 3x3 Laplacian Unsharp Mask (Sharpening)
                    - Edge De-Fringing & Halo Suppression
                    - Micro-Contrast & Luminance Equalization
                    - Bi-Cubic 2x HD Resolution Upscaling
                                        │
                                        ▼
                [ Rendered Canvas Preview & Lossless Export ]
```

---

## 💡 Core Features & Technical Deep Dive

### 1. Perceptually Uniform Flood Fill (Path A)
- **CIE L\*a\*b\* Color Space**: Standard RGB Euclidean distance fails under varying human visual perception. Imagira converts border pixels into the **CIE L\*a\*b\*** color space to measure true perceptual difference ($\Delta E$).
- **Iterative BFS (Non-Recursive)**: Prevents call-stack overflows on 4K+ images by running an in-memory queue over `Uint8ClampedArray` pixel arrays.
- **Interior Preservation**: Unlike global color keying, Path A seeds fill queues **only from outer boundaries**. White objects or garments enclosed within the subject remain untouched.
- **Selective Alpha Softening**: Mask edges undergo single-pass 1.5px Gaussian blurring **strictly applied to the Alpha channel**, ensuring zero RGB color bleeding.

### 2. Built-in Client-Side Image Enhancement Engine
After background extraction, Imagira provides interactive real-time quality sharpening and enhancement:
- **✨ 3x3 Laplacian Unsharp Masking**:
  $$\text{Pixel}_{\text{sharpened}} = \text{Pixel}_{\text{center}} + \left(4 \cdot \text{Pixel}_{\text{center}} - \sum \text{Neighbors}\right) \cdot \lambda$$
  Restores crisp detail along fine edges without introducing noise.
- **🛡️ Edge De-Fringing (Spill Suppression)**:
  Scans boundary transition pixels ($0 < \alpha < 250$) and interpolates their RGB values toward interior subject pixels to erase background halos.
- **🔍 2x Super-Resolution Upscaling**:
  Resamples canvas dimensions at 200% using high-quality bi-cubic smoothing coupled with edge contrast recovery.

---

## 🛠️ Tech Stack & Dependencies

- **Framework**: Next.js 15.5 (App Router, Client Components)
- **UI & State**: React 19, TypeScript 5.8
- **Styling**: Tailwind CSS v4.0 (Custom design system, glassmorphism UI)
- **Execution Runtime**: Canvas 2D Context API, Web Workers, WebGPU / WASM ONNX Runtime
- **Build & Check**: Custom Node.js self-testing suite (`scripts/selfcheck.ts`)

---

## 🚀 Quickstart & Development Setup

### Prerequisites
- Node.js `≥ 18.0.0`
- npm `≥ 9.0.0`

### 1. Clone Repository
```bash
git clone https://github.com/Anish974/Imagira.git
cd Imagira
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Run Self-Verification & Algorithm Checks
```bash
npm run check
```

---

## 📜 Repository Structure

```
Imagira/
├── app/
│   ├── globals.css          # Core CSS tokens & checkerboard patterns
│   ├── layout.tsx           # Main application shell
│   └── page.tsx             # State orchestration & execution pipeline
├── components/
│   ├── Controls.tsx         # Background color switcher & download triggers
│   ├── Dropzone.tsx         # Drag-and-drop, paste buffer, & file loader
│   ├── EnhanceControls.tsx  # Sliders for sharpening, de-fringing, & 2x upscale
│   └── Preview.tsx          # Dual before/after canvas viewer with status badges
├── lib/
│   ├── colour.ts            # RGB <-> CIE L*a*b* conversion & Delta E math
│   ├── config.ts            # Tunable algorithmic thresholds
│   ├── detectPlainBg.ts     # Border sampling & background uniformity detector
│   ├── enhance.ts           # Laplacian sharpening, de-fringing, & upscaling logic
│   ├── floodFill.ts         # BFS flood fill, mask erosion, & alpha gaussian blur
│   └── imageUtils.ts        # Canvas decoding, compositing, & Blob exports
└── scripts/
    └── selfcheck.ts         # Automated correctness test suite
```

---

## 🤝 Contributing

Contributions, bug reports, and feature proposals are welcome!
1. Fork the project repository.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git checkout -b feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

<div align="center">

Crafted with ❤️ by <a href="https://anishpatankar.vercel.app" target="_blank" rel="noopener noreferrer">Anish</a> & <a href="https://ayuslabs.com" target="_blank" rel="noopener noreferrer">AYUS Labs</a>

</div>
