# GeoLaTeX Agent - Complete Documentation

**Project Version:** 2.0 (NEW ARCHITECTURE)  
**Last Updated:** January 2025  
**Status:** ⚠️ ARCHITECTURE CHANGED - READ MIGRATION NOTES BELOW

---

## ⚠️ MIGRATION NOTICE - NEW ARCHITECTURE

**This documentation describes the OLD architecture and is DEPRECATED.**

The GeoLaTeX system has been completely redesigned with a new 8-step pipeline that delivers significantly better results. **The information in sections below about "Border Detection" and "Preprocessing" is NO LONGER ACCURATE.**

### What Changed?

**OLD PIPELINE (INCORRECT - DO NOT USE):**
```
Upload → Border Removal → Grayscale → Binarize → AI Analysis → LaTeX Generation
```
❌ **Problem:** Preprocessing destroyed image quality BEFORE AI detection

**NEW PIPELINE (CURRENT IMPLEMENTATION):**
```
Upload (original) → AI Region Detection → Lossless Crop → Multi-Stage Enhancement → Structured Analysis → Template-Driven LaTeX → Verification Loop
```
✅ **Solution:** AI sees original quality, targeted enhancement only after detection

### For Complete New Architecture Documentation:

**Read:** `REQUIREMENTS.md` in project root - Contains complete specification of FR-1 through FR-5

**Read:** `.github/copilot-instructions.md` - Contains implementation guidelines and architecture details

### Key Changes:

1. **FR-1:** AI detects geometry region on ORIGINAL untouched image
2. **FR-2:** Lossless pixel-perfect cropping to detected region
3. **FR-3:** Multi-stage enhancement (CLAHE, bilateral filter, sharpness, resolution optimization)
4. **FR-4:** Structured JSON schema for consistent AI geometry analysis
5. **FR-5:** Template-driven LaTeX generation with AI refinement

### Migration Path for Developers:

1. Read `REQUIREMENTS.md` sections 2.1-2.5 for detailed specs
2. Review `src/App.tsx` `handleStartAnalysis()` function (lines 77-246) for complete pipeline implementation
3. Study new service files in `src/services/`:
   - `regionDetection.ts` (FR-1)
   - `imageCropping.ts` (FR-2)
   - `imageEnhancement.ts` (FR-3)
   - `geometryAnalysis.ts` (FR-4)
   - `latexTemplates.ts` + `latexGenerator.ts` (FR-5)

---

## ⚠️ LEGACY DOCUMENTATION BELOW (OUTDATED)

**Everything below this line describes the OLD ARCHITECTURE and may be incorrect.**

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Overview](#project-overview)
3. [Installation & Setup](#installation--setup)
4. [How It Works](#how-it-works)
5. [Architecture](#architecture)
6. [Development Guide](#development-guide)
7. [Testing Guide](#testing-guide)
8. [Troubleshooting](#troubleshooting)
9. [API Reference](#api-reference)

---

## Quick Start

### Step 1: Navigate to Project
```bash
cd d:\Workspace\GeometryLatex
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start Development Server
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Step 4: Upload Image & Test
1. Drag & drop or click to select a geometric diagram image
2. Click "Analyze Image"
3. Wait for results (analysis → generation → verification → correction)
4. Copy the generated LaTeX code

### Test Images
Pre-made test images are available in `public/images/`:
- `test.jpg` - Simple geometric shapes (good for quick testing)
- `test2.jpg` - Intermediate complexity
- `test3.jpg` - Complex 3D geometry (sphere + cone)

Expected Results for test3.jpg:
- ✅ Confidence score: 75-85%
- ✅ Detects both cone AND sphere
- ✅ LaTeX code compiles successfully

---

## Project Overview

GeoLaTeX Agent is a sophisticated web application that converts images of geometric diagrams into compilable LaTeX code using the TikZ library. It leverages Google Gemini API with advanced self-correction capabilities.

### Core Purpose

Automate the tedious process of writing LaTeX code for geometric figures. Users upload a diagram image, and the application:
1. Analyzes the geometry structure
2. Generates TikZ LaTeX code
3. Verifies compilation
4. Self-corrects any errors

### Key Features

- **AI Self-Correction**: Validates and debugs its own code
- **Intelligent Image Preprocessing**: Adaptive border detection and contrast enhancement
- **Multi-Step Verification**: External LaTeX compiler validation
- **Confidence Scoring**: AI confidence rating for analysis quality
- **Progress Feedback**: Clear step-by-step status updates
- **Developer-Friendly**: One-click copy for generated code

### Technologies

- **Frontend**: React 19.2 + TypeScript
- **Build**: Vite 6.2
- **AI**: Google Gemini API (@google/genai 1.27)
- **Styling**: Tailwind CSS
- **Image Processing**: HTML5 Canvas API
- **Verification**: External LaTeX compiler service

---

## Installation & Setup

### Prerequisites

- Node.js v18 or higher
- npm or yarn
- Google Gemini API key (free tier available)

### Environment Setup

1. Clone the repository
2. Navigate to project directory
3. Create `.env` file:
```env
GEMINI_API_KEY=your_api_key_here
```

4. Install dependencies:
```bash
npm install
```

### Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3000` with hot reload enabled.

### Production Build

```bash
npm run build
```

Output: `dist/` folder with optimized bundle (439KB gzipped)

### Preview Build

```bash
npm run preview
```

Test production build locally.

---

## How It Works

### 1. Image Upload & Preprocessing

The user uploads an image. The application performs intelligent preprocessing:

- **Border Detection**: Adaptively detects and crops dark borders (both solid and dashed)
- **Dynamic Thresholding**: Calculates optimal threshold for binarization
- **Contrast Enhancement**: Stretches histogram for better detail preservation
- **Fallback Logic**: If smart preprocessing fails, automatically retries with aggressive binarization

### 2. AI Geometry Analysis

The preprocessed image is sent to Gemini 2.5 Pro:

- Identifies geometric figure type
- Extracts all vertices (with labels and coordinates)
- Detects all lines (solid/dashed styles)
- Identifies annotations (angles, labels, relationships)
- Calculates confidence score (0.0-1.0)
- Returns bounding box for cropping

**Expected Confidence Scores:**
- `>0.9`: Excellent - clear, simple geometry
- `0.7-0.9`: Good - detectable but with some complexity
- `<0.7`: Risky - ambiguous or low quality image

### 3. Client-Side Cropping

Uses the AI-provided bounding box to perform pixel-perfect crop of the processed image for display.

### 4. AI LaTeX Generation

Gemini 2.5 Pro generates complete LaTeX document:

- Uses TikZ for rendering
- Includes all necessary packages
- Proper coordinate scaling (100x100 grid → visual output)
- Human-readable formatting with newlines and indentation

### 5. Verification & Self-Correction Loop

```
Generate LaTeX Code
        ↓
Send to External Compiler
        ↓
    ✅ Compiles?
    /           \
  YES            NO
   ↓              ↓
Success      Extract Errors
              ↓
           Send to AI with Errors
              ↓
         AI Debugs & Rewrites
              ↓
         Retry Compilation
              (up to 2 attempts)
```

If compilation fails after max attempts, shows error to user.

### 6. Display Results

Shows in organized cards:
- Isolated geometric figure (cropped)
- Confidence score with visual bar
- Raw JSON geometry analysis
- Final LaTeX code with copy button

---

## Architecture

### Directory Structure

```
src/
├── App.tsx                  # Main application component
├── index.tsx               # React entry point
├── types.ts                # TypeScript type definitions
├── components/             # React components
│   ├── CodeBlock.tsx       # Syntax-highlighted code display
│   ├── ImageUploader.tsx   # Drag-drop image input
│   ├── ResultCard.tsx      # Result container component
│   ├── StepDisplay.tsx     # Multi-step progress indicator
│   └── icons.tsx           # SVG icons
└── services/               # Business logic
    ├── geminiService.ts    # Gemini API integration
    ├── imageProcessing.ts  # Image manipulation & preprocessing
    ├── latexCompilerService.ts  # LaTeX verification
    └── errorService.ts     # Error message formatting
```

### Data Flow

```
User Upload
    ↓
ImageUploader Component
    ↓
fileToBase64()
    ↓
preprocessImage() → Canvas operations
    ↓
geminiService.analyzeGeometry()
    ↓
AnalysisResult (JSON)
    ↓
cropImage() → Crop to bounding box
    ↓
geminiService.generateLatex()
    ↓
verifyLatex() → External compiler
    ↓
✅ Success → Display Results
❌ Fail → geminiService.fixLatex() → Retry

Result displayed in ResultCard component
```

### Type Definitions

```typescript
// Processing stages
type ProcessingStep = 
  'IDLE' | 'READY' | 'ANALYZING' | 'GENERATING' 
  | 'VERIFYING' | 'CORRECTING' | 'DONE' | 'ERROR'

// Geometry data structure
interface GeometryData {
  vertices: Vertex[]    // List of labeled points
  lines: Line[]         // Connections between vertices
  annotations: Annotation[]  // Labels and markers
}

// Analysis result (success or failure)
type AnalysisResult = AnalysisSuccessResult | AnalysisFailureResult

// LaTeX code wrapper
interface LatexResult {
  latexCode: string
}

// Compilation verification
interface VerificationResult {
  success: boolean
  log?: string  // Error details if failed
}
```

---

## Development Guide

### Adding New Components

1. Create file in `src/components/NewComponent.tsx`
2. Define React component with TypeScript
3. Import in `App.tsx`
4. Add to render tree

Example:
```typescript
import React from 'react';

interface Props {
  data: string;
}

export const NewComponent: React.FC<Props> = ({ data }) => {
  return <div>{data}</div>;
};
```

### Modifying Services

1. Edit file in `src/services/`
2. Update type signatures in `src/types.ts` if needed
3. Update imports in components that use the service
4. Test with `npm run build`

### Adding AI Provider

To add a new AI provider (e.g., Claude, GPT):

1. Create `src/services/newProviderService.ts`
2. Implement interface: `analyzeGeometry()`, `generateLatex()`, `fixLatex()`
3. Import in `App.tsx`
4. Update provider selection logic

---

## Testing Guide

### Unit Testing

Run tests with:
```bash
npm test
```

Test files location: `src/tests/`

### Manual Testing - Simple Shapes

```bash
npm run dev
```

1. Open `http://localhost:3000`
2. Upload `public/images/test.jpg`
3. Expected: 85-95% confidence, clean LaTeX output

### Manual Testing - Complex Geometry

1. Upload `public/images/test3.jpg`
2. Expected: 75-85% confidence, detects cone AND sphere
3. LaTeX should compile without errors

### Testing with Custom Images

Good test images:
- Simple geometric shapes (triangles, squares)
- Labeled diagrams
- Different lighting conditions
- Various image qualities

Avoid:
- Blurry images
- Heavy borders
- Mixed content
- Poor contrast

### Console Messages

Expected during successful run:
```
✓ LaTeX code successfully compiled.
✓ Image preprocessed
✓ Geometry analyzed with confidence: 0.78
✓ LaTeX generated and verified
```

Watch for warnings:
```
⚠️ Low confidence score: 0.65
⚠️ Verification service failed
⚠️ LaTeX compilation failed (retry attempt 1/2)
```

---

## Troubleshooting

### Build Issues

**Error: Cannot find module '@google/genai'**
- Solution: `npm install`
- Verify: Check `node_modules/@google/` exists

**Error: vite build fails**
- Solution: Delete `dist/` folder, run `npm run build` again
- Check: All TypeScript files compile without errors

### Runtime Issues

**App crashes when uploading image**
- Check: Browser console for error messages
- Verify: Image file is valid (JPG/PNG)
- Try: Smaller image size

**"No geometric figure could be identified"**
- Cause: Image doesn't contain clear geometry
- Solution: Try different image or clearer diagram
- Tip: Increase contrast in image editor first

**LaTeX compilation keeps failing**
- Cause: Complex geometry generation limitations
- Solution: Try simpler image
- Check: Console for error details

**Gemini API errors**
- Error: "API key not valid"
  - Solution: Check `.env` file, verify API key
  - Verify: Key has appropriate permissions in Google Cloud
- Error: "Rate limit exceeded"
  - Solution: Wait a minute, try again
  - Note: Free tier has limited requests

### Network Issues

**"Failed to connect to LaTeX compiler"**
- Cause: External service unavailable or network issue
- Solution: Check internet connection
- Workaround: Could implement local LaTeX compilation

**CORS errors**
- Cause: Browser blocking cross-origin request
- Solution: Using CORS proxy (already configured)

### Performance Issues

**App slow or freezing**
- Cause: Large image processing
- Solution: Use smaller images (<5MB)
- Tip: Preprocess in image editor

**Memory issues**
- Cause: Multiple large uploads
- Solution: Refresh page between tests

---

## API Reference

### ImageUploader Component

```typescript
interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
  disabled?: boolean;
  isProcessing?: boolean;
}
```

### geminiService

```typescript
// Analyze image geometry
analyzeGeometry(imageBase64: string, mimeType: string)
  → Promise<AnalysisResult>

// Generate LaTeX from geometry data
generateLatex(geometryData: GeometryData)
  → Promise<LatexResult>

// Fix broken LaTeX code
fixLatex(brokenCode: string, errorLog: string)
  → Promise<LatexResult>
```

### imageProcessing

```typescript
// Preprocess image for AI analysis
preprocessImage(imageBase64: string)
  → Promise<string>

// Crop image to specific region
cropImage(imageBase64: string, box: BoundingBox)
  → Promise<string>

// Validate and clamp bounding box
getValidatedBoundingBox(imageBase64: string, box: BoundingBox)
  → Promise<BoundingBox>
```

### latexCompilerService

```typescript
// Verify LaTeX compilation
verifyLatex(latexCode: string)
  → Promise<VerificationResult>
```

### errorService

```typescript
// Convert errors to user-friendly messages
getFriendlyErrorMessage(error: unknown)
  → string
```

---

## Performance Metrics

### Build Output

```
dist/index.html              0.82 kB │ gzip:   0.45 kB
dist/assets/index-*.js       439.23 kB │ gzip: 108.76 kB
Build time: ~1.3 seconds
```

### Runtime Performance

- Image preprocessing: ~500ms
- AI analysis: ~3-5 seconds
- LaTeX generation: ~2-3 seconds
- Compilation verification: ~1-2 seconds
- Total pipeline: ~7-12 seconds

### Optimization Tips

1. Use smaller images (512x512 optimal)
2. Ensure good lighting/contrast
3. Simple geometry processes faster than complex
4. Reuse browser tab for multiple uploads

---

## Contributing

To contribute improvements:

1. Create feature branch
2. Make changes in `src/` directory
3. Test thoroughly
4. Build: `npm run build`
5. Commit and push
6. Submit PR

---

## License & Attribution

This project uses:
- React by Facebook
- Vite by Evan You
- Google Gemini API
- Tailwind CSS

---

## Contact & Support

For issues, questions, or suggestions, refer to project repository issues page.

**Status**: ✅ Active Development  
**Last Updated**: November 22, 2025  
**Version**: 1.0.0
