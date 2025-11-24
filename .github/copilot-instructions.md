# GeoLaTeX – AI Coding Agent Instructions

## Project Purpose & Big Picture
- **Goal:** Convert uploaded geometric diagram images into **compilable TikZ LaTeX** via a precision AI-driven pipeline with quality enhancement and self-correction.
- **Frontend-only app:** React + TypeScript + Vite; all logic lives in `src/` (no backend).
- **Core flow (NEW ARCHITECTURE):** 
  1. Upload original image (untouched, full quality)
  2. AI detects geometry region → returns bounding box
  3. Lossless crop to exact geometry region
  4. Multi-stage quality enhancement (contrast, sharpness, resolution optimization)
  5. AI structured analysis → extracts vertices, edges, angles, annotations (JSON schema)
  6. Template-driven LaTeX generation → AI refinement
  7. External compilation verification → self-correction loop
  8. Display results with confidence scores

## Key Files & Architecture

### Core Orchestration
- `src/App.tsx`: Orchestrates the **entire pipeline** and UI state:
  - Tracks `ProcessingStep` (`IDLE` → `READY` → `DETECTING` → `CROPPING` → `ENHANCING` → `ANALYZING` → `GENERATING` → `VERIFYING` → `CORRECTING` → `DONE` / `ERROR`).
  - Handles image upload, provider selection (`AIProvider = 'gemini' | 'perplexity'`), and calls all services **in correct order**.
  - Implements the **verification + correction loop** around LaTeX generation.
  - **CRITICAL:** Must call services in sequence: `detectRegion` → `cropImage` → `enhanceImage` → `analyzeGeometry` → `generateLatex` → `verifyLatex`.

### Type System (Single Source of Truth)
- `src/types.ts`:
  - **Domain types**: `BoundingBox`, `GeometryData`, `AnalysisResult`, `LatexResult`, `VerificationResult`, `ProcessingStep`.
  - **NEW types for requirements**: `RegionDetectionResult`, `EnhancementResult`, `GeometryAnalysisResult`, `LatexGenerationResult`.
  - Any cross-file contract changes (services/components) must be updated here first.
  - All services import types from here; never duplicate type definitions.

### Image Processing Services (NEW ARCHITECTURE)
- `src/services/regionDetection.ts` **(NEW - FR-1)**:
  - `detectGeometryRegion(originalBase64, mimeType): Promise<RegionDetectionResult>`
  - Sends **original untouched image** to AI for bounding box detection.
  - Returns `{ boundingBox, confidence, detectionMethod }`.
  - **Never preprocess before detection** - AI needs original quality.
  
- `src/services/imageCropping.ts` **(NEW - FR-2)**:
  - `cropToRegion(originalBase64, boundingBox, padding?): Promise<string>`
  - Performs **lossless pixel-perfect crop** using Canvas API.
  - Adds configurable padding (default 10px) to prevent clipping.
  - Returns base64 PNG (no data URL prefix).
  
- `src/services/imageEnhancement.ts` **(NEW - FR-3)**:
  - `enhanceImage(croppedBase64): Promise<EnhancementResult>`
  - Multi-stage pipeline: contrast (CLAHE) → noise reduction → sharpness → resolution optimization.
  - Adaptive processing based on image metrics (contrast ratio, sharpness score, noise level).
  - Returns `{ enhancedBase64, metrics, appliedFilters }`.
  - Target output: 800-1200px optimal dimension, contrast ratio ≥2.5, sharpness ≥0.75.

- `src/services/imageProcessing.ts` **(DEPRECATED/REFACTOR)**:
  - Old `preprocessImage()` function is **incorrect** - it processes before AI detection.
  - `cropImage()` and `getValidatedBoundingBox()` should move to `imageCropping.ts`.
  - Keep utility functions (`loadImage`, `calculateAverageBrightness`) but refactor border detection logic.

### AI Analysis Services (ENHANCED)
- `src/services/geometryAnalysis.ts` **(NEW - FR-4)**:
  - `analyzeGeometry(enhancedBase64, mimeType): Promise<GeometryAnalysisResult>`
  - Sends enhanced image to AI with **structured JSON schema prompt**.
  - Extracts: vertices, edges (with styles), angles (with markers), annotations, measurements.
  - Returns detailed `GeometryAnalysisResult` with per-element confidence scores.
  - Schema validation to ensure AI output matches expected structure.

- `src/services/geminiService.ts` / `src/services/perplexityService.ts` **(REFACTOR)**:
  - Split into two functions:
    1. `detectRegion(imageBase64, mimeType): Promise<RegionDetectionResult>` - For FR-1
    2. `analyzeGeometry(imageBase64, mimeType): Promise<GeometryAnalysisResult>` - For FR-4 (structured schema)
  - Old `analyzeGeometry()` becomes `analyzeGeometry()` with new structured output.
  - Keep: `generateLatex(geometryData)` and `fixLatex(brokenCode, errorLog)`.
  - **Never change function signatures** without updating `App.tsx` and types.
  - For LaTeX: always return **complete standalone document** starting with `\documentclass{standalone}` and using TikZ + required libraries (`angles,quotes,calc,arrows.meta,decorations.markings`).

### LaTeX Generation Services (ENHANCED)
- `src/services/latexTemplates.ts` **(NEW - FR-5)**:
  - Template definitions for different geometry types (triangle, circle, polygon, composite).
  - Template structure: `\documentclass` → packages → `tikzpicture` with sections (coordinates, edges, angles, annotations).
  - `selectTemplate(figureType): LatexTemplate` - Choose appropriate template.
  - `fillTemplate(template, geometryData): string` - Map JSON data to TikZ commands.

- `src/services/latexGenerator.ts` **(NEW - FR-5)**:
  - `generateLatex(geometryData): Promise<LatexGenerationResult>`
  - Two-stage generation:
    1. Template filling with geometry data
    2. AI refinement (optimize syntax, positioning, comments)
  - Pre-validation before AI refinement (check coordinate definitions, syntax).
  - Returns `{ latexCode, template, generationMethod, codeMetrics, warnings }`.

- `src/services/latexCompilerService.ts` **(KEEP)**:
  - `verifyLatex(latexCode): Promise<VerificationResult>` - unchanged.
  - Sends LaTeX to external HTTP compilation service via CORS proxy.
  - Returns `{ success: true }` on compile; `{ success: false, log }` on failure.
- `src/services/latexCompilerService.ts`:
  - `verifyLatex(latexCode): Promise<VerificationResult>` sends LaTeX to an **external HTTP compilation service** via a CORS proxy.
  - Returns `{ success: true }` on compile; `{ success: false, log }` on failure. `App.tsx`’s correction loop depends on this contract.
- `src/services/errorService.ts`:
  - `getFriendlyErrorMessage(error)` maps raw errors (network, API key, unknown) into **user-facing messages**, used in `App.tsx` and `StepDisplay`.
- Components:
  - `components/ImageUploader.tsx`: File input + drag-and-drop + preview. Calls `onImageUpload(file)`; must stay **side-effect free** except setting preview.
  - `components/StepDisplay.tsx`: Pure visualization of `ProcessingStep`/`ERROR` state.
  - `components/ResultCard.tsx`, `components/CodeBlock.tsx`, `components/icons.tsx`: Presentation-only; keep them stateless and reusable.

## Environment, Build & Run
- Dev server:
  - `npm install`
  - `npm run dev` → Vite dev server on `http://localhost:3000` (see `vite.config.ts`).
- Build & preview:
  - `npm run build`
  - `npm run preview`
- Environment variables (Vite):
  - Use **Vite-prefixed** vars; they are wired in `vite.config.ts` as:
    - `process.env.API_KEY` ← `VITE_GEMINI_API_KEY`
    - `process.env.PERPLEXITY_API_KEY` ← `VITE_PERPLEXITY_API_KEY`
  - When generating docs or code, prefer `.env` entries like:
    - `VITE_GEMINI_API_KEY=...`
    - `VITE_PERPLEXITY_API_KEY=...`

## Behavioral Conventions

### Pipeline Order (CRITICAL - DO NOT REORDER)
The new architecture requires **strict ordering**:
```
1. Upload original image (full quality, no processing)
2. detectGeometryRegion(original) → BoundingBox
3. cropToRegion(original, box) → Cropped PNG
4. enhanceImage(cropped) → Enhanced PNG
5. analyzeGeometry(enhanced) → GeometryAnalysisResult (structured JSON)
6. generateLatex(geometryData) → LaTeX code (template + AI refinement)
7. verifyLatex(code) → Success or error log
8. If fail: fixLatex(code, log) → Corrected code (repeat step 7, max 2 attempts)
```
**Never preprocess before step 2** - AI detection needs original image quality.

### Single Source of Truth
- `App.tsx` is the **only** place that coordinates multiple services; do not reimplement the pipeline in other components.
- All domain data contracts live in `src/types.ts`; services must import types from there instead of duplicating.
- `REQUIREMENTS.md` defines the contract for each requirement (FR-1 to FR-5); implementation must match.

### Error Handling
- Throw regular `Error` objects from services.
- Let `App.tsx` catch and convert via `getFriendlyErrorMessage`, then set `step='ERROR'` and `error` message.
- Each service should have specific error types for better debugging (e.g., "RegionDetectionError", "EnhancementError").

### AI Providers
- When adding a new provider, mirror the **exact interface** of `geminiService`/`perplexityService` and update the `AIProvider` union & selection logic in `App.tsx`.
- Provider-specific prompts live **inside their service file**, not in components.
- **NEW:** Each provider must implement both `detectRegion()` and `analyzeGeometry()` with structured schemas.

### Verification Loop in `App.tsx`
Do not break the sequence:
1. `generateLatex` → `currentLatexCode`.
2. Loop: `verifyLatex` → if fail, `fixLatex(currentLatexCode, log)` → update `currentLatexCode`.
3. Hard cap on correction attempts (currently `MAX_CORRECTION_ATTEMPTS = 2`).

### Image Data Handling
- Work with **base64 strings without data URL prefix** at the service layer.
- Add/remove the `data:image/...;base64,` prefix only at the browser integration boundaries.
- **NEW:** Original image is passed through pipeline unchanged until cropping step.
- Cache intermediate results (cropped, enhanced) to avoid reprocessing on retry.

## When Modifying or Adding Code

### Service Layer Guidelines
- Each new service (FR-1 to FR-5) should be in its own file with clear, single responsibility.
- If you touch anything in `services/`, check all usages in `App.tsx` and update `types.ts` if contracts change.
- **NEW services must include**:
  - TypeScript interfaces for inputs/outputs (defined in `types.ts` first)
  - Error handling with descriptive error messages
  - JSDoc comments explaining purpose and behavior
  - Unit tests in `src/tests/` (when testing is set up)

### Component Guidelines
- Keep UI components **presentational**; push orchestration and side effects into `App.tsx` or dedicated services.
- Components should receive data as props and call callbacks for actions (no direct service imports).
- **NEW:** Add progress indicators for each pipeline step (detecting, cropping, enhancing, analyzing, generating).

### Image Processing Patterns
- Work with **base64 strings without data URL prefix** at the service layer.
- Add/remove the `data:image/...;base64,` prefix only at the browser integration boundaries.
- **CRITICAL:** Never modify the original image before AI detection - create copies for processing.
- Use Canvas API with `willReadFrequently: true` context option for image data operations.

### File Organization
- New services go in `src/services/` with descriptive names matching their requirement (e.g., `regionDetection.ts` for FR-1).
- Shared utilities stay in existing files or new `src/utils/` folder if needed.
- Templates and prompts go in `src/services/latexTemplates.ts` (not scattered across files).
- Prefer small, focused functions and keep new files under existing folders (`components/`, `services/`, `docs/`) following current naming patterns.

## Helpful Entry Points for Agents

### Understanding the System
- **Start here:** Read `REQUIREMENTS.md` for complete specification (FR-1 to FR-5, success criteria, test cases).
- **Architecture:** Read `.github/copilot-instructions.md` (this file) for pipeline flow and conventions.
- **Current implementation:** Read `src/App.tsx` to see existing pipeline (needs refactor to match new architecture).
- **Legacy docs:** `docs/DOCUMENTATION.md` describes OLD architecture (border removal first) - will be updated.

### For Specific Tasks
- **Image processing logic:** `src/services/imageProcessing.ts` (legacy), new services will be `regionDetection.ts`, `imageCropping.ts`, `imageEnhancement.ts`.
- **AI integration:** `src/services/geminiService.ts`, `src/services/perplexityService.ts` (need refactor to split detection vs analysis).
- **LaTeX generation:** `src/services/geminiService.ts` (will move to `latexGenerator.ts` + `latexTemplates.ts`).
- **Type definitions:** `src/types.ts` (update here FIRST before implementing new services).
- **Error handling:** `src/services/errorService.ts` and `components/StepDisplay.tsx`.
- **UI components:** `src/components/` - all are presentational, no business logic.

### For Implementation (Phase 1)
1. Read `REQUIREMENTS.md` sections 2.1 (FR-1), 2.2 (FR-2), 2.3 (FR-3)
2. Update `src/types.ts` with new interfaces (`RegionDetectionResult`, `EnhancementResult`, etc.)
3. Create `src/services/regionDetection.ts` (FR-1)
4. Create `src/services/imageCropping.ts` (FR-2)
5. Create `src/services/imageEnhancement.ts` (FR-3)
6. Refactor `src/App.tsx` to use new pipeline order
7. Update `components/StepDisplay.tsx` with new steps (DETECTING, CROPPING, ENHANCING)
8. Test with images from `public/images/test*.jpg`
