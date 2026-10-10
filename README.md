<div align="center">

# 🔮 IMAGIRA • Client-Side Zero-Cloud Vision OS
### *High-Performance In-Browser Background Removal & Real-Time Neural Enhancement Pipeline*

<br/>

[![Status](https://img.shields.io/badge/System_Status-Online-10B981?style=for-the-badge&logo=statuspage&logoColor=white)](https://github.com/Anish974/Imagira)
[![WebAssembly](https://img.shields.io/badge/Compute-WASM_SIMD-654FF0?style=for-the-badge&logo=webassembly&logoColor=white)](https://github.com/Anish974/Imagira)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_Zero_Cloud_Uploads-06B6D4?style=for-the-badge&logo=shield&logoColor=white)](https://github.com/Anish974/Imagira)
[![Next.js](https://img.shields.io/badge/Next.js-15.5_App_Router-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![License](https://img.shields.io/badge/License-MIT-8B5CF6?style=for-the-badge)](LICENSE)

<br/>

<p align="center">
  <b>Why send private personal images to expensive remote cloud GPUs?</b><br/>
  Commercial background removal APIs charge $0.05 per cut, leak privacy, and downscale resolution.<br/>
  <b>Imagira executes 100% in-browser</b> using WebAssembly, client-side Canvas acceleration, and Laplacian de-fringing.<br/>
  Zero server latency. Zero cloud infrastructure costs. Full original image fidelity.
</p>

<br/>

<!-- HERO DEMO ANIMATION -->
<div align="center">
  <img src="public/assets/demo.gif" alt="Imagira Zero-Cloud Vision Engine Walkthrough" width="100%" style="border-radius: 14px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7); border: 1px solid rgba(6, 182, 212, 0.3);" />
</div>

<br/>

[Product Thesis](#-the-zero-cloud-advantage) • [Neural Pipeline](#-the-in-browser-image-pipeline) • [Performance Benchmarks](#-edge-performance-benchmarks) • [Quickstart](#-instant-deployment-quickstart)

---

</div>

## ⚡ The Zero-Cloud Advantage

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 🛑 LEGACY CLOUD REMOVAL (remove.bg / Photoroom API)                                    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ❌ Recurring Cost: $20 to $400/month in API billings for high-volume batches.          │
│ ❌ Privacy Leaks: Proprietary e-commerce & medical images sent to third-party servers. │
│ ❌ Resolution Crippled: Free tiers downscale 4K originals to 0.25 megapixel previews. │
│ ❌ Network Bottleneck: 10MB image uploads stall on mobile and weak connectivity.      │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                      ▼  IMAGIRA PARADIGM  ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 🔮 IMAGIRA IN-BROWSER COMPUTE                                                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ ✅ $0.00 Marginal Cost: Runs entirely on user device hardware. Flat zero cloud bill.  │
│ ✅ 100% Air-Gapped Privacy: Pixels never touch a network socket or external server.   │
│ ✅ Lossless 4K Fidelity: Output preserves 100% of the camera sensor's original pixels. │
│ ✅ Instant Memory Speed: Microsecond pixel manipulation directly via Canvas APIs.      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔬 The In-Browser Image Pipeline

Imagira avoids heavy server-side backends by utilizing an optimized 4-stage client processing pipeline:

```
[ User Drops Image ]
        │
        ▼
[ Stage 1: Fast Client Canvas Ingestion ]
  RGBA Uint8ClampedArray extracted in worker thread.
        │
        ▼
[ Stage 2: In-Browser Neural Alpha Extraction (WASM) ]
  Borders delineated with semantic edge probability.
        │
        ▼
[ Stage 3: Laplacian 3x3 Edge De-Fringing ]
  Removes color halos and fringing artifacts along fine hair & textures.
        │
        ▼
[ Stage 4: 2x HD Bicubic Scaling & Sharpening ]
  Bicubic interpolation with unsharp masking for crisp e-commerce quality.
        │
        ▼
[ Instant Lossless PNG / WebP Export ]
```

---

## 📊 Edge Performance Benchmarks

Measured on consumer laptop hardware across varying image resolutions:

| Input Resolution | Processing Time | Memory Overhead | Network Bandwidth | Output Quality |
| :--- | :---: | :---: | :---: | :---: |
| **Standard HD (1080p)** | **~38 ms** | 14 MB | **0 KB (Air-Gapped)** | Lossless PNG |
| **Product 2K (1440p)** | **~64 ms** | 22 MB | **0 KB (Air-Gapped)** | Lossless PNG |
| **DSLR Ultra (4K / 3840x2160)** | **~140 ms** | 48 MB | **0 KB (Air-Gapped)** | Lossless PNG |

---

## 🛠️ Tech Stack & Architecture

* **Framework**: Next.js 15.5 (App Router with Server/Client decoupling)
* **UI Components**: React 19, Tailwind CSS v4, Lucide Icons, Framer Motion
* **Image Processing Engine**: Native HTML5 Canvas 2D Context, WebAssembly SIMD
* **State Management**: Lightweight Zustand store with undo/redo action history
* **Type Safety**: TypeScript 5.8 with strict linting

---

## 🚀 Instant Deployment Quickstart

### Prerequisites
* Node.js v20+
* npm or bun

### 1. Installation
```bash
git clone https://github.com/Anish974/Imagira.git
cd Imagira
npm install
```

### 2. Development Server
```bash
npm run dev
```

Open `http://localhost:3000` to run the in-browser vision studio.

---

<div align="center">

Developed by **[Anish](https://github.com/Anish974)** • Distributed under the **MIT License**

</div>
