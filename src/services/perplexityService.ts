import type { AnalysisResult, GeometryData, LatexResult, RegionDetectionResult, GeometryAnalysisResult, Edge, Vertex } from '../types';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// ============================================================================
// POST-PROCESSING: Validate and fix common AI mistakes
// ============================================================================

/**
 * Post-process geometry data to fix common AI analysis mistakes.
 * This provides STABILITY by applying deterministic rules after AI analysis.
 */
function postProcessGeometryData(data: GeometryData): void {
    if (!data.edges) return;
    
    const vertices = data.vertices || [];
    const edges = data.edges;
    
    // Detect if this is a 3D inscribed polyhedron (like tetrahedron in sphere)
    const hasSphere = data.shapes?.some(s => s.type === 'sphere');
    const is3D = data.dimension === '3d' || hasSphere;
    
    if (is3D && hasSphere) {
        // Find center vertex (usually labeled O)
        const centerVertex = vertices.find(v => 
            v.spatialRelation?.toLowerCase().includes('center') ||
            v.label === 'O'
        );
        
        // Find surface vertices (on sphere)
        const surfaceVertices = vertices.filter(v => 
            v.spatialRelation?.toLowerCase().includes('surface') ||
            v.label !== 'O'
        ).map(v => v.label);
        
        console.log(`[PostProcess] 3D sphere detected. Center: ${centerVertex?.label}, Surface vertices: ${surfaceVertices.join(', ')}`);
        
        // Analyze edge colors to determine edge types
        const edgeColors = new Map<string, Edge[]>();
        edges.forEach(e => {
            const color = e.color || 'black';
            if (!edgeColors.has(color)) edgeColors.set(color, []);
            edgeColors.get(color)!.push(e);
        });
        
        console.log(`[PostProcess] Edge colors found: ${[...edgeColors.keys()].join(', ')}`);
        
        // If we have exactly 2 colors and this looks like a tetrahedron (6 edges, 4 surface vertices)
        if (edgeColors.size === 2 && edges.length === 6 && surfaceVertices.length === 4) {
            const colors = [...edgeColors.keys()];
            const group1 = edgeColors.get(colors[0])!;
            const group2 = edgeColors.get(colors[1])!;
            
            // In tetrahedron: 3 edges form one triangular face (outer), 3 edges go to back vertex (inner)
            // Heuristic: Find the back vertex (one that appears in 3 edges of same color = inner edges)
            const vertexCountByColor = new Map<string, Map<string, number>>();
            
            for (const [color, edgeGroup] of edgeColors) {
                const counts = new Map<string, number>();
                edgeGroup.forEach(e => {
                    counts.set(e.from, (counts.get(e.from) || 0) + 1);
                    counts.set(e.to, (counts.get(e.to) || 0) + 1);
                });
                vertexCountByColor.set(color, counts);
            }
            
            // Find if one color has a vertex that appears 3 times (back vertex for inner edges)
            let innerColor: string | null = null;
            let outerColor: string | null = null;
            let backVertex: string | null = null;
            
            for (const [color, counts] of vertexCountByColor) {
                for (const [vertex, count] of counts) {
                    if (count === 3) {
                        // This vertex appears in all 3 edges of this color = likely back vertex
                        innerColor = color;
                        backVertex = vertex;
                        break;
                    }
                }
                if (innerColor) break;
            }
            
            if (innerColor) {
                outerColor = colors.find(c => c !== innerColor) || null;
                console.log(`[PostProcess] Detected: Back vertex=${backVertex}, Inner edges=${innerColor}, Outer edges=${outerColor}`);
            }
            
            // Apply curve directions based on detection
            edges.forEach(edge => {
                const edgeColor = edge.color || 'black';
                
                if (innerColor && outerColor) {
                    // We detected the pattern
                    if (edgeColor === innerColor) {
                        edge.curveDirection = 'concave';
                        edge.curvature = edge.curvature || 0.25;
                        edge.geometricRelation = edge.geometricRelation || 'internal edge to back vertex';
                    } else if (edgeColor === outerColor) {
                        edge.curveDirection = 'convex';
                        edge.curvature = edge.curvature || 0.35;
                        edge.geometricRelation = edge.geometricRelation || 'tetrahedron face edge';
                    }
                } else {
                    // Fallback: use geometricRelation keywords
                    const relation = (edge.geometricRelation || '').toLowerCase();
                    if (relation.includes('diagonal') || relation.includes('internal') || relation.includes('interior') || relation.includes('back')) {
                        edge.curveDirection = 'concave';
                    } else if (relation.includes('face') || relation.includes('surface') || relation.includes('outer')) {
                        edge.curveDirection = 'convex';
                    }
                }
                
                // Ensure curvature has a reasonable default if curveDirection is set
                if (edge.curveDirection && edge.curveDirection !== 'straight' && !edge.curvature) {
                    edge.curvature = edge.curveDirection === 'convex' ? 0.35 : 0.25;
                }
            });
            
            console.log(`[PostProcess] Applied curve directions to ${edges.length} edges`);
        }
    }
    
    // General fixes for any geometry
    edges.forEach(edge => {
        // Default curveDirection to 'straight' if not set and curvature is 0 or very low
        if (!edge.curveDirection) {
            if (!edge.curvature || edge.curvature < 0.1) {
                edge.curveDirection = 'straight';
            }
        }
        
        // Ensure curvature is in valid range
        if (edge.curvature !== undefined) {
            edge.curvature = Math.max(0, Math.min(1, edge.curvature));
        }
    });
}

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
   - color (if not black - IMPORTANT: different colors often indicate different edge types!)
   - geometricRelation: Be SPECIFIC about the edge type:
     * "tetrahedron face edge" = edge on outer face of tetrahedron (connects adjacent vertices)
     * "diagonal" or "internal edge" = edge that cuts through interior (connects non-adjacent vertices)
     * "radius", "diameter", "chord", "tangent" for circle-related edges
   - isVisible (false for hidden edges in 3D, true by default)
   
   - curveDirection: CRITICAL! Determine from VISUAL APPEARANCE in the image:
     * Look at how the edge VISUALLY curves in the image
     * "convex" = edge bulges OUTWARD (like following the sphere surface on the OUTSIDE)
     * "concave" = edge curves INWARD (like going THROUGH the sphere interior)
     * "straight" = no visible curve
     
   - DETECTION RULES for tetrahedron-in-sphere:
     * Edges along the VISIBLE outer silhouette = "convex" (they wrap around the sphere)
     * Edges going TO/FROM a back vertex (through the sphere) = "concave" (they pass inside)
     * If colors differ: one color is likely surface edges (convex), other is internal (concave)
     
   - curvature (0.0-1.0): magnitude of curve. 0=straight, 0.2-0.4=slight, 0.5+=pronounced
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
        "color": "red",
        "geometricRelation": "tetrahedron face edge",
        "curveDirection": "convex",
        "curvature": 0.35,
        "isVisible": true,
        "confidence": 0.95
      },
      {
        "from": "A",
        "to": "C",
        "style": "dashed",
        "thickness": "thin",
        "color": "blue",
        "geometricRelation": "internal diagonal to back vertex",
        "curveDirection": "concave",
        "curvature": 0.25,
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
        console.log('=== PERPLEXITY AI RESPONSE (RAW) ===');
        console.log(JSON.stringify(result, null, 2));
        
        // 🔧 POST-PROCESSING: Validate and fix common AI mistakes
        if (result.geometryFound && result.geometryData) {
            postProcessGeometryData(result.geometryData);
            console.log('=== AFTER POST-PROCESSING ===');
            console.log(JSON.stringify(result.geometryData, null, 2));
        }
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

    // Check if coordinates are pre-transformed
    const isTransformed = (geometryData as any)._coordinatesTransformed === true;
    
    // Extract sphere dimensions if calculated
    const sphereShape = geometryData.shapes?.find(s => s.type === 'sphere') as any;
    const sphereRx = sphereShape?._ellipseRx || 2.5;
    const sphereRy = sphereShape?._ellipseRy || 2.5;
    const sphereRadius = sphereShape?.radius || '2.5';
    
    const prompt = `
Generate a COMPLETE and COMPILABLE LaTeX document from this geometry data.

GEOMETRY DATA:
\`\`\`json
${JSON.stringify(geometryData, null, 2)}
\`\`\`

=== CRITICAL: COORDINATES ARE PRE-TRANSFORMED ===
${isTransformed ? `
✅ Coordinates have ALREADY been transformed to TikZ format!
✅ Y-axis has been INVERTED (image Y-down → TikZ Y-up)
✅ Values are ALREADY SCALED (divided by 20)
✅ USE THE VERTEX COORDINATES EXACTLY AS PROVIDED - DO NOT MODIFY THEM!

Example: If vertex A has x=4.6, y=2.3, use exactly:
  \\coordinate (A) at (4.6, 2.3);
` : `
⚠️ Coordinates are in image format (0-100, Y-down)
Transform: x_tikz = x/20, y_tikz = (100-y)/20
`}

=== SPHERE DIMENSIONS (PRE-CALCULATED) ===
${sphereShape ? `
Sphere center: ${sphereShape.center || 'O'}
Ellipse horizontal radius: ${sphereRx} cm
Ellipse vertical radius: ${sphereRy} cm
Use these EXACT dimensions for the sphere ellipse.
` : 'No sphere detected.'}

=== DOCUMENT STRUCTURE (MANDATORY) ===
\\documentclass{standalone}
\\usepackage{tikz}
\\usepackage{amsmath}
\\usetikzlibrary{angles,quotes,calc,arrows.meta,decorations.markings}

\\begin{document}
\\begin{tikzpicture}[scale=1.2]
  % ... drawing commands ...
\\end{tikzpicture}
\\end{document}

=== DRAWING INSTRUCTIONS ===

1. COORDINATES - Use vertex values EXACTLY as given:
   \\coordinate (A) at (x, y);  % spatialRelation as comment

2. SPHERE - Draw with pre-calculated dimensions:
   \\shade[ball color=orange!70, opacity=0.6] (${sphereShape?.center || 'O'}) ellipse (${sphereRx}cm and ${sphereRy}cm);
   \\draw[orange!80!brown, opacity=0.7, line width=0.8pt] (${sphereShape?.center || 'O'}) ellipse (${sphereRx}cm and ${sphereRy}cm);

3. EDGES - CRITICAL: Use curveDirection to determine bend direction!
   - curveDirection="convex" → curves OUTWARD: use "to[bend left=X]" (positive bend)
   - curveDirection="concave" → curves INWARD: use "to[bend right=X]" (negative/opposite bend)
   - curveDirection="straight" → no curve: use "--" instead of "to[bend]"
   - curvature value (0-1) determines bend amount: curvature * 20 = bend degrees
     Example: curvature=0.3 → bend=6, curvature=0.5 → bend=10
   
   Examples:
   % Convex edge (curves outward on sphere surface)
   \\draw[dashed, thin, red] (A) to[bend left=8] (B);
   
   % Concave edge (curves inward, like diagonal through interior)
   \\draw[dashed, thin, blue] (A) to[bend right=6] (C);
   
   % Straight edge
   \\draw[solid, thin, black] (A) -- (B);

4. VERTICES - Draw as filled circles:
   \\fill[black] (A) circle (2pt);

5. LABELS - Use placement from annotations:
   - placement="above" → \\node[above=3pt, font=\\large\\itshape] at (D) {D};
   - placement="below" → \\node[below=3pt, font=\\large\\itshape] at (B) {B};
   - placement="left" → \\node[left=3pt, font=\\large\\itshape] at (C) {C};
   - placement="right" → \\node[right=3pt, font=\\large\\itshape] at (A) {A};

6. ADD COMMENTS from geometricDescription and spatialRelationships

OUTPUT: Return ONLY the raw LaTeX code. No markdown, no explanations.
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
