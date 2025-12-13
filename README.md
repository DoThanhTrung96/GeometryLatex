# GeoLaTeX - Geometry to LaTeX Converter

**Version 2.5** - Enhanced with Confidence-Based Post-Processing

An intelligent web application that converts images of geometric diagrams into compilable TikZ LaTeX code using AI vision with deterministic validation.

## 🌟 Features

### Core Pipeline
- 🎯 **AI Region Detection**: Automatically detects geometry boundaries with generous margins
- ✂️ **Lossless Cropping**: Pixel-perfect extraction with 30px padding
- ⚡ **Quality Enhancement**: Multi-stage adaptive image optimization (CLAHE, bilateral filter, sharpness)
- 🤖 **Structured AI Analysis**: JSON schema-based geometry extraction (Perplexity Sonar Pro)
- 🔧 **Two-Tier Post-Processing**: Intelligent validation and correction system
- 📐 **Template-Driven LaTeX**: Reliable TikZ generation with AI refinement
- ✅ **Self-Correction**: External compiler validation with automatic debugging
- 🎨 **Modern UI**: React 19 with TypeScript 5.8 and Vite 6.2

### Advanced Post-Processing ⭐ NEW
**TIER 1 - Safe Fixes (Always):**
- Edge deduplication with intelligent merging
- Field validation and range checking
- Automatic label placement correction

**TIER 2 - Structural Fixes (Confidence >= 70%):**
- Pattern-based geometry recognition (tetrahedron, etc.)
- Auto-completion of missing edges
- Geometric color correction (convex/concave)
- Multi-signal confidence scoring

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

**Enhanced Pipeline** (v2.5):
```
Upload → AI Detect → Crop (30px) → Enhance → AI Analysis → Post-Process → Transform → LaTeX → Verify → Correct
         (generous margins)                    (JSON)      (2-tier validation)  (Y-flip)
```

**Key Features:**
- ✅ Original images sent to AI (no preprocessing before detection)
- ✅ Confidence-based structural enforcement (prevents forcing wrong patterns)
- ✅ Geometric validation (deduplication, label fixing, edge completion)
- ✅ Deterministic coordinate transformation (Y-axis inversion for TikZ)

## 📁 Project Structure

```
GeometryLatex/
├── src/
│   ├── App.tsx                      # Main orchestrator (8-step pipeline)
│   ├── types.ts                     # Type definitions (single source of truth)
│   ├── components/                  # UI components
│   └── services/
│       ├── regionDetection.ts       # FR-1: AI region detection
│       ├── imageCropping.ts         # FR-2: Lossless cropping (30px padding)
│       ├── imageEnhancement.ts      # FR-3: Quality enhancement
│       ├── coordinateTransform.ts   # Y-axis inversion + scaling
│       ├── latexGenerator.ts        # FR-5: LaTeX generation
│       ├── perplexityService.ts     # AI + post-processing (2-tier validation)
│       └── latexCompilerService.ts  # External compilation verification
├── docs/
│   ├── IMPLEMENTATION_STATUS.md     # ⭐ Current status & what works
│   ├── ROADMAP.md                   # ⭐ Next steps & AI model options
│   └── DOCUMENTATION.md             # Technical architecture details
└── public/images/                   # Test images (test.jpg)
```

## 🚀 How It Works

### Pipeline Flow
1. **DETECTING** - AI identifies geometry region with generous margins
2. **CROPPING** - Lossless extraction with 30px padding
3. **ENHANCING** - Adaptive multi-stage optimization
4. **ANALYZING** - Structured JSON extraction (vertices, edges, curves)
5. **POST-PROCESSING** ⭐ - Two-tier validation:
   - TIER 1: Deduplication, field validation, label correction (always)
   - TIER 2: Structural fixes, edge completion, color correction (if confidence >= 70%)
6. **TRANSFORMING** - Y-axis inversion + coordinate scaling for TikZ
7. **GENERATING** - Template-based TikZ with AI refinement
8. **VERIFYING** - External compiler validation
9. **CORRECTING** - AI self-debugging (max 2 attempts)
10. **DONE** - Display results with debug images

### Post-Processing Intelligence ⭐
**Multi-Signal Confidence Scoring:**
- Description mentions "tetrahedron" (+30%)
- Shape type explicitly listed (+20%)
- Two color groups detected (+15%)
- Edge count matches pattern (+15%)
- Edge relations consistent (+10%)
- Vertex degrees match (+10%)

**Only enforces structure when confidence >= 70%** - prevents forcing wrong patterns!

### Tech Stack
- **Frontend**: React 19.2 + TypeScript 5.8 + Vite 6.2
- **AI**: Perplexity Sonar Pro (with post-processing validation)
- **Styling**: Tailwind CSS
- **Image**: HTML5 Canvas API (lossless processing)
- **LaTeX**: External compiler (rtex.probablya.dev)

## 📖 Documentation

**Implementation Status**: [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md)
- ✅ What's working now
- ⚠️ Known limitations
- 🎯 Success metrics
- 📊 Test results

**Roadmap & Next Steps**: [`docs/ROADMAP.md`](docs/ROADMAP.md)
- 🚀 AI model improvements (GPT-4, Mathpix)
- 📈 Accuracy enhancement plan
- 💰 Cost/benefit analysis
- 🎯 Recommended action items

**Technical Details**: [`docs/DOCUMENTATION.md`](docs/DOCUMENTATION.md)
- Architecture deep-dive
- Service layer documentation

## 🎯 Current Status

**Working:** ✅
- Full pipeline (crop → enhance → analyze → generate → verify)
- Two-tier post-processing with confidence scoring
- Label placement correction
- Edge deduplication
- Coordinate transformation

**Limitations:** ⚠️
- AI vision accuracy: ~60% for complex 3D (Perplexity)
- Post-processor brings it to ~85%
- See ROADMAP.md for improvement plans (GPT-4, Mathpix)

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
