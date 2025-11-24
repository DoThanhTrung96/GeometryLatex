import type { AnalysisResult, GeometryData, LatexResult, RegionDetectionResult, GeometryAnalysisResult } from '../types';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// ============================================================================
// FR-1: REGION DETECTION
// ============================================================================

/**
 * Detects geometry region in ORIGINAL untouched image using Perplexity.
 */
export const detectRegion = async (imageBase64: string, mimeType: string): Promise<RegionDetectionResult> => {
    if (!PERPLEXITY_API_KEY) {
        throw new Error("Perplexity API key is not configured.");
    }

    const prompt = `
Analyze this image and identify the EXACT region containing the geometric figure.

TASK: Find the bounding box that tightly encompasses ALL geometric content, including:
- All vertices and lines
- All labels and annotations  
- All angle markers and measurements
- EXCLUDE: Document borders, background, watermarks, unrelated text

COORDINATE SYSTEM:
- Top-left corner of image = (0, 0)
- X increases right
- Y increases down
- Provide pixel coordinates (integers)

Return ONLY valid JSON (no markdown, no explanation):
{
  "boundingBox": {
    "x": number,
    "y": number,
    "width": number,
    "height": number
  },
  "confidence": number (0-1),
  "detectionMethod": "ai-vision"
}

Confidence: 1.0=perfect, 0.9=very clear, 0.8=clear, 0.7=detectable, <0.7=poor
`;

    try {
        const response = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.3,
                top_p: 0.9,
                return_citations: false,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("No content returned from Perplexity API");
        }

        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        const result = JSON.parse(jsonStr) as RegionDetectionResult;
        return result;

    } catch (error) {
        console.error("Error detecting region with Perplexity:", error);
        throw new Error("Perplexity failed to detect geometry region.");
    }
};

export const analyzeGeometry = async (imageBase64: string, mimeType: string): Promise<AnalysisResult> => {
    if (!PERPLEXITY_API_KEY) {
        throw new Error("Perplexity API key is not configured. Set PERPLEXITY_API_KEY environment variable.");
    }

    const prompt = `
Analyze this geometric diagram image in COMPREHENSIVE DETAIL. Extract ALL visible elements with precise descriptions.

CRITICAL: Be extremely thorough - capture EVERY text annotation, EVERY visual property, EVERY geometric relationship.

Your analysis must include:

1. VERTICES - For each point:
   - label (A, B, C, D, O, etc.)
   - x, y coordinates (0-100 normalized)
   - fillColor (black, red, blue, white, none)
   - size (small, medium, large, or specific like "3pt")
   - shape (circle, square, dot, none)
   - spatialRelation (e.g., "on sphere surface", "center of sphere", "above plane", "on circle")
   - confidence (0.0-1.0)

2. EDGES/LINES - For each connection:
   - from, to (vertex labels)
   - style (solid, dashed, dotted, thick, double)
   - thickness (very thin, thin, thick, very thick)
   - color (if not black)
   - geometricRelation (e.g., "radius", "diameter", "edge of tetrahedron", "tangent", "chord")
   - isVisible (false for hidden edges in 3D, true by default)
   - confidence (0.0-1.0)

3. ANNOTATIONS - For ALL text in the image:
   - type (text, description, label-group, side-label, angle, etc.)
   - content (short form: "O", "A, B, C, D")
   - fullText (EXACT text as shown: "Center of sphere", "Vertices A, B, C, D on sphere surface")
   - position (near which vertex/edge, or "center", "top", etc.)
   - placement (above, below, left, right, center)
   - refersTo (array of vertex/edge labels this describes)
   - textStyle (italic, bold, normal)
   - fontSize (tiny, small, normal, large)
   - confidence (0.0-1.0)

4. SHAPES - For circles, spheres, polyhedra:
   - type (circle, sphere, ellipse, polyhedron, tetrahedron)
   - center (vertex label)
   - radius (if measurable or labeled)
   - vertices (for polyhedra: ["A", "B", "C", "D"])
   - style (dashed, solid, dotted)
   - geometricDescription ("circumscribed sphere", "inscribed circle", "regular tetrahedron")

5. GEOMETRIC CONTEXT:
   - geometricDescription (overall: "Regular tetrahedron ABCD inscribed in sphere with center O")
   - dimension (2d or 3d)
   - spatialRelationships (array of statements: ["O is the center of the sphere", "Vertices A, B, C, D lie on the sphere surface"])

6. VISUAL CONTEXT:
   - emphasisColors (map vertex labels to colors: {"O": "red", "A": "black"})
   - textAnnotations (all visible text strings)
   - drawingStyle (geometric, technical, sketch, hand-drawn)

Return ONLY this JSON structure (no markdown, no extra text):
{
  "geometryFound": true,
  "boundingBox": {"x": 0, "y": 0, "width": 100, "height": 100},
  "geometryData": {
    "dimension": "2d|3d",
    "geometricDescription": "Complete description of the figure",
    "vertices": [
      {
        "label": "A",
        "x": 50,
        "y": 50,
        "fillColor": "black",
        "size": "medium",
        "shape": "circle",
        "spatialRelation": "on sphere surface",
        "confidence": 0.95
      }
    ],
    "edges": [
      {
        "from": "A",
        "to": "B",
        "style": "dashed",
        "thickness": "thin",
        "geometricRelation": "edge of tetrahedron",
        "isVisible": true,
        "confidence": 0.95
      }
    ],
    "annotations": [
      {
        "type": "description",
        "content": "O",
        "fullText": "Center of sphere",
        "position": "center",
        "placement": "below",
        "refersTo": ["O"],
        "textStyle": "normal",
        "confidence": 0.95
      }
    ],
    "shapes": [
      {
        "type": "sphere",
        "center": "O",
        "vertices": ["A", "B", "C", "D"],
        "style": "dashed",
        "geometricDescription": "Circumscribed sphere around tetrahedron"
      }
    ],
    "spatialRelationships": [
      "O is the center of the sphere",
      "Vertices A, B, C, D lie on the sphere surface"
    ],
    "visualContext": {
      "emphasisColors": {"O": "red"},
      "textAnnotations": ["Center of sphere", "Vertices A, B, C, D on sphere surface"],
      "drawingStyle": "geometric"
    }
  },
  "confidenceScore": 0.95
}
`;

    try {
        const response = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${imageBase64}`
                                }
                            }
                        ]
                    }
                ],
                temperature: 0.3,
                top_p: 0.9,
                return_citations: false,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            throw new Error("No content returned from Perplexity API");
        }

        // Extract JSON from the response (handle markdown code blocks)
        let jsonStr = content;
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
            jsonStr = jsonMatch[1];
        }

        const result = JSON.parse(jsonStr) as AnalysisResult;
        
        // 🔍 DETAILED LOGGING: Show full AI response for inspection
        console.log('=== PERPLEXITY AI RESPONSE (FULL) ===');
        console.log(JSON.stringify(result, null, 2));
        console.log('=== END AI RESPONSE ===');
        
        return result;

    } catch (error) {
        console.error("Error analyzing geometry with Perplexity:", error);
        throw new Error("The Perplexity AI service failed to analyze the image's geometry.");
    }
};

export const generateLatex = async (geometryData: GeometryData): Promise<LatexResult> => {
    if (!PERPLEXITY_API_KEY) {
        throw new Error("Perplexity API key is not configured. Set PERPLEXITY_API_KEY environment variable.");
    }

    const is3D = geometryData.dimension === '3d';
    const hasShapes = geometryData.shapes && geometryData.shapes.length > 0;
    
    const prompt = `
Generate a COMPLETE and COMPILABLE LaTeX document from this ENHANCED geometry data.

GEOMETRY DATA:
\`\`\`json
${JSON.stringify(geometryData, null, 2)}
\`\`\`

=== CRITICAL REQUIREMENTS ===

1. DOCUMENT STRUCTURE (MANDATORY):
   - Start with: \\documentclass{standalone}
   - Include: \\usepackage{tikz}, \\usepackage{amsmath}
   - ${is3D ? 'FOR 3D: \\usepackage{tikz-3dplot}' : ''}
   - Libraries: \\usetikzlibrary{angles,quotes,calc,arrows.meta,decorations.markings}
   - Wrap in: \\begin{document} ... \\end{document}

2. COORDINATE HANDLING:
   - Input coords are 0-100 normalized
   - Transform to TikZ: Divide by 20 (makes 0-5 range)
   - Example: (87, 52) → (87/20, 52/20) = (4.35, 2.6)
   - ${is3D ? 'For 3D: Use \\tdplotsetmaincoords{70}{110} before tikzpicture' : ''}

3. USE ALL ENHANCED DATA:
   - geometricDescription → Add as LaTeX comment at top
   - spatialRelationships → Add as comments near relevant elements
   - vertices[].spatialRelation → Use in coordinate comments
   - vertices[].fillColor, size, shape → Apply to vertex drawing
   - edges[].color, thickness, geometricRelation → Apply to edge drawing
   - edges[].geometricRelation: if "geodesic", use curved paths (to[bend left=15])
   - annotations[].fullText → Use actual text, not just labels
   - annotations[].placement, textStyle, fontSize → Apply to node positioning
   - shapes[] → Draw explicitly (circles, spheres as dashed circles)

4. VISUAL QUALITY:
   - Use colors from edges[].color (blue, red, etc.)
   - Apply opacity to background elements
   - Use proper node positioning from annotations[].placement
   - Add descriptive comments from spatialRelationships[]

5. EXAMPLE VERTEX:
   If vertex has fillColor="black", size="medium", spatialRelation="on sphere surface":
   % Vertex A (on sphere surface)
   \\fill[black] (A) circle (2pt);

6. EXAMPLE EDGE:
   If edge has color="blue", geometricRelation="edge of tetrahedron":
   % Edge AB (edge of tetrahedron)
   \\draw[dashed, thin, blue] (A) to[bend left=15] (B);

7. EXAMPLE ANNOTATION:
   If annotation has fullText="Center of sphere", placement="below":
   \\node[below, font=\\large\\itshape] at (O) {Center of sphere};

OUTPUT: Return ONLY the LaTeX code. No markdown fences, no explanations, no extra text.
`;

    try {
        const response = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                top_p: 0.9,
                return_citations: false,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        let latexCode = data.choices?.[0]?.message?.content;

        if (!latexCode) {
            throw new Error("No content returned from Perplexity API");
        }

        // Clean up markdown fences if present
        latexCode = latexCode.replace(/^```(?:latex)?\n?/i, '').replace(/\n?```$/i, '').trim();

        return { latexCode };

    } catch (error) {
        console.error("Error generating LaTeX with Perplexity:", error);
        throw new Error("The Perplexity AI service failed to generate the LaTeX code.");
    }
};

export const fixLatex = async (brokenCode: string, errorLog: string): Promise<LatexResult> => {
    if (!PERPLEXITY_API_KEY) {
        throw new Error("Perplexity API key is not configured. Set PERPLEXITY_API_KEY environment variable.");
    }

    const prompt = `
The following LaTeX code, intended to render a geometric figure with TikZ, has failed to compile. Your task is to act as an expert LaTeX debugger and fix it.

**Broken LaTeX Code:**
\`\`\`latex
${brokenCode}
\`\`\`

**Compilation Error Log:**
\`\`\`
${errorLog}
\`\`\`

**Instructions for Correction:**

1.  **Analyze the Errors:** Carefully read the compilation error log. Identify the root cause of each error. The errors indicate problems like:
    *   A missing \\documentclass{...} or missing \\begin{document}.
    *   Missing packages like \\usepackage{tikz}.
    *   Missing critical TikZ libraries, especially \\usetikzlibrary{angles,quotes,calc}. This is a very common cause of failure for angle-related commands.
    *   Syntax errors within the tikzpicture environment.

2.  **Rewrite the Code:** Rewrite the entire LaTeX document to fix all identified errors.

3.  **Ensure Completeness:** The corrected code MUST be a complete, standalone, and compilable document with \\documentclass, all necessary packages, and the full \\begin{document}...\\end{document} structure.

4.  **Final Output:** Return ONLY the corrected raw LaTeX code. No explanations, apologies, or Markdown fences.

Return ONLY the LaTeX code, no other text.
`;

    try {
        const response = await fetch(PERPLEXITY_API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                top_p: 0.9,
                return_citations: false,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Perplexity API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        let latexCode = data.choices?.[0]?.message?.content;

        if (!latexCode) {
            throw new Error("No content returned from Perplexity API");
        }

        // Clean up markdown fences if present
        latexCode = latexCode.replace(/^```(?:latex)?\n?/i, '').replace(/\n?```$/i, '').trim();

        return { latexCode };

    } catch (error) {
        console.error("Error fixing LaTeX with Perplexity:", error);
        throw new Error("The Perplexity AI service failed to correct the LaTeX code.");
    }
};
