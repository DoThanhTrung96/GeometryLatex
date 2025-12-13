import type { AnalysisResult, GeometryData, LatexResult, RegionDetectionResult, GeometryAnalysisResult } from '../types';

// LLaVA via Ollama - runs locally, no API key needed!
const OLLAMA_BASE_URL = 'http://localhost:11434';
// Use 7b model (3.3 GB) - smaller memory footprint
const LLAVA_MODEL = 'llava:7b-v1.6-mistral-q2_K';

// ============================================================================
// OLLAMA API INTEGRATION
// ============================================================================

/**
 * Call Ollama's generate API for LLaVA vision model
 */
async function callOllama(prompt: string, imageBase64: string): Promise<string> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: LLAVA_MODEL,
                prompt: prompt,
                images: [imageBase64], // Ollama accepts array of base64 strings (no data URL prefix)
                stream: false,
                options: {
                    temperature: 0.1, // Low temperature for consistent geometric analysis
                    top_p: 0.9,
                }
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            
            // Check for out-of-memory errors
            if (errorText.includes('requires more system memory')) {
                throw new Error(
                    `Out of memory! The LLaVA model needs more RAM than available. ` +
                    `Try a smaller model: "ollama pull llava:7b" or close other applications.`
                );
            }
            
            throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('fetch')) {
                throw new Error('Cannot connect to Ollama. Is it running? Try: ollama serve');
            }
            throw error;
        }
        throw new Error('Unknown error calling Ollama');
    }
}

// ============================================================================
// POST-PROCESSING: Reuse from perplexityService
// ============================================================================
// Import the post-processing functions from perplexityService
// (These are deterministic and work for any AI provider)
import {
    postProcessGeometryData as perplexityPostProcess
} from './perplexityService';

function postProcessGeometryData(data: GeometryData): void {
    // Reuse Perplexity's robust post-processing
    perplexityPostProcess(data);
}

// ============================================================================
// REGION DETECTION (FR-1)
// ============================================================================

export async function detectGeometryRegion(
    imageBase64: string,
    mimeType: string
): Promise<RegionDetectionResult> {
    console.log(`[LLaVA] Starting region detection...`);

    const prompt = `Analyze this image and locate the geometry diagram.

Your task: Identify the bounding box that contains the complete geometric figure with GENEROUS MARGINS.

CRITICAL INSTRUCTIONS:
1. Include ALL parts: vertices (labeled points), edges (lines/curves), and any annotations
2. Add generous margins (20-30 pixels) around the diagram
3. Do NOT crop tightly - we need space around the geometry

Return ONLY a JSON object (no markdown, no explanation):
{
  "boundingBox": {
    "x": <left edge in pixels>,
    "y": <top edge in pixels>,
    "width": <width in pixels>,
    "height": <height in pixels>
  },
  "confidence": <0.0-1.0>,
  "notes": "<what you see>"
}`;

    try {
        const responseText = await callOllama(prompt, imageBase64);
        console.log(`[LLaVA] Raw response:`, responseText.substring(0, 200));

        // Extract JSON from response (LLaVA sometimes includes extra text)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in LLaVA response');
        }

        const result = JSON.parse(jsonMatch[0]);
        
        return {
            boundingBox: result.boundingBox,
            confidence: result.confidence || 0.8,
            detectionMethod: 'ai-vision'
        };
    } catch (error) {
        console.error('[LLaVA] Detection error:', error);
        throw new Error(`LLaVA region detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

// ============================================================================
// GEOMETRY ANALYSIS (FR-4)
// ============================================================================

export async function analyzeGeometry(
    imageBase64: string,
    mimeType: string
): Promise<AnalysisResult> {
    console.log(`[LLaVA] Starting geometry analysis...`);

    const prompt = `You are an expert in geometry. Analyze this geometric diagram and extract ALL information.

CRITICAL INSTRUCTIONS:
1. Identify EVERY vertex (labeled point) with its exact label
2. Identify EVERY edge connecting vertices (including diagonal edges in 3D figures)
3. For 3D figures like tetrahedrons: detect INTERNAL edges (dashed/dotted) vs VISIBLE edges (solid)
4. Identify angles with their measures
5. Extract all text annotations

Return ONLY valid JSON (no markdown, no explanation):
{
  "description": "<concise description of the figure>",
  "figureType": "<triangle|tetrahedron|circle|polygon|etc>",
  "dimension": "<2d or 3d>",
  "vertices": [
    {
      "label": "<letter>",
      "x": <0-100 normalized>,
      "y": <0-100 normalized>,
      "confidence": <0.0-1.0>
    }
  ],
  "edges": [
    {
      "from": "<vertex label>",
      "to": "<vertex label>",
      "color": "<red|blue|black>",
      "style": "<solid|dashed|dotted>",
      "relation": "<convex|concave|front|back|internal>",
      "confidence": <0.0-1.0>
    }
  ],
  "angles": [
    {
      "vertex": "<vertex label>",
      "measure": <degrees>,
      "markerType": "<arc|right-angle>"
    }
  ],
  "shapes": [
    {
      "type": "<sphere|circle|polygon>",
      "center": "<vertex label if applicable>"
    }
  ]
}

EXAMPLE for tetrahedron ABCD with center O:
- Front face triangle (red, solid): A-B, B-C, C-A
- Back vertex D (blue, dashed): A-D, B-D, C-D
- All 6 edges total for complete tetrahedron`;

    try {
        const responseText = await callOllama(prompt, imageBase64);
        console.log(`[LLaVA] Raw analysis:`, responseText.substring(0, 500));

        // Extract JSON (remove markdown code blocks if present)
        let jsonText = responseText.trim();
        if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?$/g, '');
        }
        
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in LLaVA analysis response');
        }

        const geometryData: GeometryData = JSON.parse(jsonMatch[0]);

        // Apply post-processing (validation, deduplication, confidence-based fixes)
        postProcessGeometryData(geometryData);

        return {
            success: true,
            data: geometryData,
        };
    } catch (error) {
        console.error('[LLaVA] Analysis error:', error);
        return {
            success: false,
            error: `LLaVA analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

// ============================================================================
// LATEX GENERATION (FR-5)
// ============================================================================

export async function generateLatex(geometryData: GeometryData): Promise<LatexResult> {
    console.log(`[LLaVA] Generating LaTeX from geometry data...`);

    // Build a description of the geometry for LLaVA
    const description = `Generate TikZ LaTeX code for this geometric figure:

Description: ${geometryData.description}
Type: ${geometryData.figureType}
Dimension: ${geometryData.dimension}

Vertices (${geometryData.vertices.length}):
${geometryData.vertices.map(v => `  ${v.label} at (${v.x}, ${v.y})`).join('\n')}

Edges (${geometryData.edges.length}):
${geometryData.edges.map(e => `  ${e.from}-${e.to}: ${e.color} ${e.style} (${e.relation})`).join('\n')}

${geometryData.angles.length > 0 ? `Angles:\n${geometryData.angles.map(a => `  ∠${a.vertex} = ${a.measure}°`).join('\n')}` : ''}

REQUIREMENTS:
1. Use \\documentclass{standalone}
2. Include all TikZ libraries: angles,quotes,calc,arrows.meta,decorations.markings
3. Transform coordinates: TikZ Y-axis is inverted (y' = 100 - y)
4. Use proper edge styles:
   - Red solid for front/visible/convex edges
   - Blue dashed for back/internal/concave edges
5. Add vertex labels at correct positions
6. Include angle markers if present
7. NO comments or explanations - just compilable LaTeX code

Return ONLY the complete LaTeX code (nothing else):`;

    try {
        const latexCode = await callOllama(description, ''); // No image needed for generation
        
        // Clean up response (remove markdown if present)
        let cleanCode = latexCode.trim();
        if (cleanCode.includes('```')) {
            cleanCode = cleanCode.replace(/```latex?\n?/g, '').replace(/```\n?$/g, '');
        }

        // Validate it starts with \documentclass
        if (!cleanCode.includes('\\documentclass')) {
            throw new Error('Generated LaTeX does not include \\documentclass');
        }

        return {
            success: true,
            code: cleanCode,
        };
    } catch (error) {
        console.error('[LLaVA] LaTeX generation error:', error);
        return {
            success: false,
            error: `LLaVA LaTeX generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

// ============================================================================
// LATEX CORRECTION (Self-correction loop)
// ============================================================================

export async function fixLatex(brokenCode: string, errorLog: string): Promise<LatexResult> {
    console.log(`[LLaVA] Attempting to fix LaTeX compilation error...`);

    const prompt = `This LaTeX code failed to compile. Fix it.

ERROR LOG:
${errorLog.substring(0, 500)}

BROKEN CODE:
${brokenCode}

REQUIREMENTS:
1. Keep the same geometric structure
2. Fix syntax errors, missing packages, or coordinate issues
3. Ensure \\documentclass{standalone} with proper TikZ setup
4. Return ONLY the corrected LaTeX code (no explanation)`;

    try {
        const correctedCode = await callOllama(prompt, '');
        
        // Clean up
        let cleanCode = correctedCode.trim();
        if (cleanCode.includes('```')) {
            cleanCode = cleanCode.replace(/```latex?\n?/g, '').replace(/```\n?$/g, '');
        }

        return {
            success: true,
            code: cleanCode,
        };
    } catch (error) {
        console.error('[LLaVA] LaTeX correction error:', error);
        return {
            success: false,
            error: `LLaVA correction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
    }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

export async function checkHealth(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
        const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            method: 'GET',
        });

        if (!response.ok) {
            return { available: false, error: 'Ollama API not responding' };
        }

        const data = await response.json();
        const llavaModel = data.models?.find((m: any) => m.name.startsWith('llava'));

        if (!llavaModel) {
            return { 
                available: false, 
                error: 'LLaVA model not found. Run: ollama pull llava:13b' 
            };
        }

        return { 
            available: true, 
            version: llavaModel.name 
        };
    } catch (error) {
        return { 
            available: false, 
            error: 'Cannot connect to Ollama. Is it running? Try: ollama serve' 
        };
    }
}
