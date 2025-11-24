# GeoLaTeX - Geometry to LaTeX Converter

**Version 2.0** - New Architecture with AI-First Pipeline

An intelligent web application that converts images of geometric diagrams into compilable TikZ LaTeX code using advanced AI vision models.

## 🌟 Features

- 🎯 **AI Region Detection**: Automatically detects geometry boundaries on original images
- ✂️ **Lossless Cropping**: Pixel-perfect extraction with configurable padding
- ⚡ **Quality Enhancement**: Multi-stage adaptive image optimization (CLAHE, bilateral filter, sharpness)
- 🤖 **Structured AI Analysis**: JSON schema-based geometry extraction (Perplexity Sonar Pro)
- 📐 **Template-Driven LaTeX**: Reliable TikZ generation with AI refinement
- ✅ **Self-Correction**: External compiler validation with automatic debugging
- 🔍 **Debug Mode**: Visual comparison of intermediate processing steps
- 🎨 **Modern UI**: React 19 with Tailwind CSS

## ⚡ Quick Start

### Prerequisites
- Node.js v18+
- Perplexity API key

### Installation
```bash
npm install
cp .env.example .env
# Edit .env: Add VITE_PERPLEXITY_API_KEY
npm run dev  # → http://localhost:3000
```

### Production Build
```bash
npm run build && npm run preview
```

## 🏗️ Architecture

**New 8-Step Pipeline** (v2.0):
```
Upload → AI Detect → Lossless Crop → Enhance → Structured Analysis → Template LaTeX → Verify → Self-Correct
```

**Key Improvement**: AI detection on **ORIGINAL** untouched images (not preprocessed) ensures accurate region detection.

## 📁 Project Structure

```
GeometryLatex/
├── src/
│   ├── App.tsx                      # Main orchestrator (8-step pipeline)
│   ├── types.ts                     # Type definitions (single source of truth)
│   ├── components/                  # UI components
│   └── services/
│       ├── regionDetection.ts       # FR-1: AI region detection
│       ├── imageCropping.ts         # FR-2: Lossless cropping
│       ├── imageEnhancement.ts      # FR-3: Quality enhancement
│       ├── geometryAnalysis.ts      # FR-4: Structured analysis
│       ├── latexTemplates.ts        # FR-5: Template system
│       ├── latexGenerator.ts        # FR-5: LaTeX generation
│       ├── perplexityService.ts     # Perplexity API integration
│       └── latexCompilerService.ts  # Client-side validation
├── docs/
│   └── README.md                    # Complete documentation (requirements, status, architecture)
├── scripts/
│   └── PIPELINE_VERIFICATION.js     # Logic verification script
└── public/images/                   # Test images
```

## 🚀 How It Works

### Pipeline Flow
1. **DETECTING** - AI identifies geometry region on original image
2. **CROPPING** - Lossless extraction with padding
3. **ENHANCING** - Adaptive multi-stage optimization
4. **ANALYZING** - Structured JSON extraction (vertices, edges, angles)
5. **GENERATING** - Template-based TikZ with AI refinement
6. **VERIFYING** - External compiler validation
7. **CORRECTING** - AI self-debugging (if needed)
8. **DONE** - Display results with debug images

### Tech Stack
- **Frontend**: React 19 + TypeScript + Vite 6
- **AI**: Perplexity Sonar Pro
- **Styling**: Tailwind CSS
- **Image**: HTML5 Canvas API (CLAHE, bilateral filter, unsharp mask)
- **LaTeX**: External compiler (rtex.probablya.dev)

## 📖 Documentation

**Complete docs**: [`docs/README.md`](docs/README.md)
- Full requirements specification (FR-1 to FR-5)
- Implementation status & checklist
- Architecture details & pipeline verification
- Test cases & acceptance criteria

**Quick debug**: `node scripts/PIPELINE_VERIFICATION.js`

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
VITE_PERPLEXITY_API_KEY=your_perplexity_api_key_here
```

## Documentation

See the `docs/` directory for detailed documentation:
- Implementation guides
- Testing procedures
- Troubleshooting tips
- Feature enhancements

## License

This project is for educational and research purposes.
