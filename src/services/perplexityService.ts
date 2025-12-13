import type { AnalysisResult, GeometryData, LatexResult, RegionDetectionResult, GeometryAnalysisResult, Edge, Vertex } from '../types';

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';

// ============================================================================
// POST-PROCESSING: Validate and fix common AI mistakes
// ============================================================================

/**
 * Post-process geometry data to fix common AI analysis mistakes.
 * This provides STABILITY by applying deterministic rules after AI analysis.
 * 
 * TWO-TIER APPROACH:
 * TIER 1 (Always): Safe fixes - deduplication, validation, defaults
 * TIER 2 (Conditional): Structural fixes - only when confidence >= threshold
 */
function postProcessGeometryData(data: GeometryData): void {
    if (!data.edges || !data.vertices) return;
    
    const vertices = data.vertices;
    const hasSphere = data.shapes?.some(s => s.type === 'sphere');
    const is3D = data.dimension === '3d' || hasSphere;
    
    console.log(`\n[PostProcess] ========== STARTING VALIDATION ==========`);
    console.log(`[PostProcess] Vertices: ${vertices.length}, Edges: ${data.edges.length}, 3D: ${is3D}`);
    
    // ===== TIER 1: SAFE FIXES (Always run) =====
    console.log(`[PostProcess] TIER 1: Safe fixes...`);
    
    // 1. Deduplicate edges
    const deduplicatedEdges = deduplicateEdges(data.edges);
    console.log(`[PostProcess] ✓ Deduplication: ${deduplicatedEdges.length} edges (removed ${data.edges.length - deduplicatedEdges.length} duplicates)`);
    data.edges = deduplicatedEdges;
    
    // 2. General fixes for any geometry
    data.edges.forEach(edge => {
        // Default curveDirection to 'straight' if not set and curvature is low
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
    console.log(`[PostProcess] ✓ Field validation complete`);
    
    // 3. Fix inverted annotation placements
    if (data.annotations && data.annotations.length > 0) {
        const fixedCount = fixAnnotationPlacements(data);
        console.log(`[PostProcess] ✓ Fixed ${fixedCount} inverted label placements`);
    }
    
    // ===== TIER 2: STRUCTURAL FIXES (Confidence-based) =====
    if (is3D && hasSphere) {
        console.log(`[PostProcess] TIER 2: Pattern detection...`);
        
        const centerVertex = vertices.find(v => 
            v.spatialRelation?.toLowerCase().includes('center') || v.label === 'O'
        );
        
        const surfaceVertices = vertices.filter(v => 
            v.spatialRelation?.toLowerCase().includes('surface') || 
            (v.label !== centerVertex?.label && v.label !== 'O')
        );
        
        console.log(`[PostProcess] Sphere detected. Center: ${centerVertex?.label}, Surface: ${surfaceVertices.map(v => v.label).join(', ')}`);
        
        // Check if this looks like a tetrahedron
        if (surfaceVertices.length === 4) {
            const confidence = calculateTetrahedronConfidence(data, surfaceVertices);
            console.log(`[PostProcess] Tetrahedron confidence: ${(confidence * 100).toFixed(1)}%`);
            
            if (confidence >= 0.70) {
                console.log(`[PostProcess] ✓ High confidence - applying tetrahedron structure`);
                enforceTetrahedronStructure(data, surfaceVertices, centerVertex);
            } else {
                console.log(`[PostProcess] ⚠ Low confidence - skipping structural fixes`);
                console.log(`[PostProcess] → Trusting AI output (may be spherical quadrilateral or other shape)`);
            }
        }
    }
    
    console.log(`[PostProcess] Final edge count: ${data.edges.length}`);
    console.log(`[PostProcess] ========== VALIDATION COMPLETE ==========\n`);
}

/**
 * Calculate confidence that this is a tetrahedron (not spherical quadrilateral or other shape).
 * Uses multiple independent signals to avoid false positives.
 * 
 * @returns 0.0-1.0 confidence score (>= 0.70 recommended for enforcement)
 */
function calculateTetrahedronConfidence(data: GeometryData, surfaceVertices: Vertex[]): number {
    let score = 0;
    const signals: string[] = [];
    
    // Signal 1: Explicit "tetrahedron" in description (30% weight - strongest signal)
    const desc = (data.geometricDescription || '').toLowerCase();
    if (desc.includes('tetrahedron')) {
        score += 0.30;
        signals.push('description mentions tetrahedron (+30%)');
    } else if (desc.includes('quadrilateral')) {
        score -= 0.20; // Penalty if explicitly called quadrilateral
        signals.push('description says quadrilateral (-20%)');
    }
    
    // Signal 2: Shape type explicitly listed as tetrahedron (20% weight)
    const hasTetrahedronShape = data.shapes?.some(s => 
        s.type === 'tetrahedron' || s.type === 'polyhedron'
    );
    if (hasTetrahedronShape) {
        score += 0.20;
        signals.push('shape type is tetrahedron/polyhedron (+20%)');
    }
    
    // Signal 3: Two color groups (15% weight - common pattern)
    const colorGroups = new Map<string, Edge[]>();
    data.edges.forEach(e => {
        const color = e.color || 'black';
        if (!colorGroups.has(color)) colorGroups.set(color, []);
        colorGroups.get(color)!.push(e);
    });
    if (colorGroups.size === 2) {
        const sizes = [...colorGroups.values()].map(g => g.length);
        // Check if roughly equal groups (3-3 or 4-2 split)
        if (Math.abs(sizes[0] - sizes[1]) <= 1) {
            score += 0.15;
            signals.push(`two color groups (${sizes.join('-')} split) (+15%)`);
        }
    }
    
    // Signal 4: Edge count suggests complete graph (15% weight)
    const edgeCount = data.edges.length;
    if (edgeCount === 6) {
        score += 0.15;
        signals.push('exactly 6 edges (K4 complete graph) (+15%)');
    } else if (edgeCount === 4) {
        score += 0.05; // Weak signal - might be incomplete tetrahedron
        signals.push('4 edges (possibly incomplete) (+5%)');
    } else if (edgeCount > 6) {
        score -= 0.10; // Too many edges for tetrahedron
        signals.push(`${edgeCount} edges (too many for tetrahedron) (-10%)`);
    }
    
    // Signal 5: "tetrahedron" or "internal/diagonal" in edge relations (10% weight)
    const edgeRelations = data.edges.map(e => (e.geometricRelation || '').toLowerCase()).join(' ');
    if (edgeRelations.includes('tetrahedron')) {
        score += 0.10;
        signals.push('edge relations mention tetrahedron (+10%)');
    } else if (edgeRelations.includes('diagonal') || edgeRelations.includes('internal')) {
        score += 0.05;
        signals.push('edge relations suggest 3D structure (+5%)');
    }
    
    // Signal 6: Vertex degree distribution (10% weight)
    const vertexDegrees = new Map<string, number>();
    data.edges.forEach(e => {
        vertexDegrees.set(e.from, (vertexDegrees.get(e.from) || 0) + 1);
        vertexDegrees.set(e.to, (vertexDegrees.get(e.to) || 0) + 1);
    });
    const degrees = [...vertexDegrees.values()];
    const allDegree3 = degrees.every(d => d === 3);
    if (allDegree3 && degrees.length === 4) {
        score += 0.10;
        signals.push('all vertices have degree 3 (K4 property) (+10%)');
    }
    
    // Log all signals
    console.log(`[PostProcess] Confidence signals:`);
    signals.forEach(s => console.log(`  - ${s}`));
    
    return Math.max(0, Math.min(1, score)); // Clamp to 0-1
}

/**
 * Fix inverted annotation placements based on actual vertex positions.
 * AI sometimes confuses coordinate systems and gives opposite placements.
 * 
 * @returns number of annotations fixed
 */
function fixAnnotationPlacements(data: GeometryData): number {
    let fixedCount = 0;
    
    data.annotations.forEach(annotation => {
        // Only fix label-type annotations that refer to a single vertex
        if (!annotation.refersTo || annotation.refersTo.length !== 1) return;
        if (!annotation.placement) return;
        
        const vertexLabel = annotation.refersTo[0];
        const vertex = data.vertices.find(v => v.label === vertexLabel);
        if (!vertex) return;
        
        // Determine correct placement based on vertex position (0-100 coordinate system)
        const correctPlacement = determineCorrectPlacement(vertex, data.vertices);
        
        // Check if AI placement is inverted
        const aiPlacement = annotation.placement.toLowerCase();
        const isInverted = isPlacementInverted(aiPlacement, correctPlacement);
        
        if (isInverted) {
            console.log(`[PostProcess]   ${vertexLabel}: "${aiPlacement}" → "${correctPlacement}" (vertex at x=${vertex.x}, y=${vertex.y})`);
            annotation.placement = correctPlacement;
            fixedCount++;
        }
    });
    
    return fixedCount;
}

/**
 * Determine correct label placement based on vertex position relative to center
 */
function determineCorrectPlacement(vertex: Vertex, allVertices: Vertex[]): string {
    // Find center (average position of all vertices)
    const centerX = allVertices.reduce((sum, v) => sum + v.x, 0) / allVertices.length;
    const centerY = allVertices.reduce((sum, v) => sum + v.y, 0) / allVertices.length;
    
    const dx = vertex.x - centerX;
    const dy = vertex.y - centerY;
    
    // Use larger displacement to determine primary direction
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'right' : 'left';
    } else {
        return dy > 0 ? 'below' : 'above';
    }
}

/**
 * Check if AI placement is inverted from correct placement
 */
function isPlacementInverted(aiPlacement: string, correctPlacement: string): boolean {
    const inversions: Record<string, string> = {
        'left': 'right',
        'right': 'left',
        'above': 'below',
        'below': 'above',
        'top': 'bottom',
        'bottom': 'top'
    };
    
    const normalizedAi = aiPlacement.toLowerCase();
    const normalizedCorrect = correctPlacement.toLowerCase();
    
    // Check if they're opposites
    return inversions[normalizedAi] === normalizedCorrect || inversions[normalizedCorrect] === normalizedAi;
}

/**
 * Deduplicate edges - merge edges with same endpoints
 */
function deduplicateEdges(edges: Edge[]): Edge[] {
    const edgeMap = new Map<string, Edge[]>();
    
    edges.forEach(edge => {
        // Create normalized key (A-B and B-A are the same edge)
        const key = [edge.from, edge.to].sort().join('-');
        if (!edgeMap.has(key)) {
            edgeMap.set(key, []);
        }
        edgeMap.get(key)!.push(edge);
    });
    
    const result: Edge[] = [];
    
    edgeMap.forEach((duplicates, key) => {
        if (duplicates.length === 1) {
            result.push(duplicates[0]);
        } else {
            // Merge duplicate edges - prefer most common color and curveDirection
            console.log(`[PostProcess] Merging ${duplicates.length} duplicates for edge ${key}`);
            const merged = mergeDuplicateEdges(duplicates);
            result.push(merged);
        }
    });
    
    return result;
}

/**
 * Merge multiple edge definitions into one, preferring most reliable values
 */
function mergeDuplicateEdges(edges: Edge[]): Edge {
    const base = edges[0];
    
    // Count occurrences of each color and curveDirection
    const colorCounts = new Map<string, number>();
    const directionCounts = new Map<string, number>();
    
    edges.forEach(e => {
        const color = e.color || 'black';
        colorCounts.set(color, (colorCounts.get(color) || 0) + 1);
        
        if (e.curveDirection) {
            directionCounts.set(e.curveDirection, (directionCounts.get(e.curveDirection) || 0) + 1);
        }
    });
    
    // Pick most common values
    const mostCommonColor = [...colorCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || base.color;
    const mostCommonDirection = [...directionCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] as Edge['curveDirection'];
    
    // Average curvature
    const avgCurvature = edges.reduce((sum, e) => sum + (e.curvature || 0), 0) / edges.length;
    
    return {
        ...base,
        color: mostCommonColor,
        curveDirection: mostCommonDirection || base.curveDirection,
        curvature: avgCurvature
    };
}

/**
 * Enforce correct tetrahedron structure:
 * - Must have exactly 6 edges (all pairs of 4 vertices)
 * - Detect back vertex (leftmost = furthest from camera)
 * - 3 edges to back vertex = concave (blue)
 * - 3 edges forming front face = convex (red)
 */
function enforceTetrahedronStructure(data: GeometryData, surfaceVertices: Vertex[], centerVertex?: Vertex): void {
    const labels = surfaceVertices.map(v => v.label);
    console.log(`[PostProcess] Enforcing tetrahedron structure for vertices: ${labels.join(', ')}`);
    
    // Generate all required edges (complete graph K4 = 6 edges)
    const requiredEdges = new Set<string>();
    for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
            const key = [labels[i], labels[j]].sort().join('-');
            requiredEdges.add(key);
        }
    }
    
    console.log(`[PostProcess] Required edges: ${[...requiredEdges].join(', ')}`);
    
    // Check existing edges
    const existingEdges = new Map<string, Edge>();
    data.edges.forEach(edge => {
        const key = [edge.from, edge.to].sort().join('-');
        if (requiredEdges.has(key)) {
            existingEdges.set(key, edge);
        }
    });
    
    console.log(`[PostProcess] Existing edges: ${existingEdges.size}/${requiredEdges.size}`);
    
    // Add missing edges
    const missingEdges: string[] = [];
    requiredEdges.forEach(key => {
        if (!existingEdges.has(key)) {
            const [from, to] = key.split('-');
            missingEdges.push(key);
            
            // Create edge with reasonable defaults
            const newEdge: Edge = {
                from,
                to,
                style: 'dashed',
                thickness: 'thin',
                color: 'black', // Will be determined below
                geometricRelation: 'tetrahedron edge',
                isVisible: true,
                confidence: 0.8
            };
            existingEdges.set(key, newEdge);
        }
    });
    
    if (missingEdges.length > 0) {
        console.log(`[PostProcess] Added ${missingEdges.length} missing edges: ${missingEdges.join(', ')}`);
    }
    
    // Detect back vertex (leftmost point = furthest from camera in typical projection)
    const backVertex = surfaceVertices.reduce((leftmost, v) => 
        v.x < leftmost.x ? v : leftmost
    , surfaceVertices[0]);
    
    console.log(`[PostProcess] Back vertex detected: ${backVertex.label} (x=${backVertex.x})`);
    
    // Determine edge colors and curve directions
    const frontVertices = surfaceVertices.filter(v => v.label !== backVertex.label).map(v => v.label);
    
    let correctedCount = 0;
    existingEdges.forEach((edge, key) => {
        const connectsToBack = edge.from === backVertex.label || edge.to === backVertex.label;
        
        if (connectsToBack) {
            // Edge to back vertex = internal diagonal = concave = blue
            const oldColor = edge.color;
            edge.color = 'blue';  // FORCE correct color
            edge.curveDirection = 'concave';
            edge.curvature = edge.curvature || 0.25;
            edge.geometricRelation = `internal edge to back vertex ${backVertex.label}`;
            
            if (oldColor && oldColor !== 'blue') {
                console.log(`[PostProcess]   Corrected ${edge.from}-${edge.to}: ${oldColor} → blue (internal edge)`);
                correctedCount++;
            }
        } else {
            // Edge on front face = convex = red
            const oldColor = edge.color;
            edge.color = 'red';  // FORCE correct color
            edge.curveDirection = 'convex';
            edge.curvature = edge.curvature || 0.35;
            edge.geometricRelation = 'front face edge';
            
            if (oldColor && oldColor !== 'red') {
                console.log(`[PostProcess]   Corrected ${edge.from}-${edge.to}: ${oldColor} → red (front face)`);
                correctedCount++;
            }
        }
    });
    
    if (correctedCount > 0) {
        console.log(`[PostProcess] ✓ Corrected ${correctedCount} edge colors`);
    }
    
    // Update data.edges with complete set
    data.edges = [...existingEdges.values()];
    
    // Update geometric description
    data.geometricDescription = `Tetrahedron ${labels.join('')} inscribed in sphere. Front face: ${frontVertices.join('-')}, back vertex: ${backVertex.label}`;
    
    console.log(`[PostProcess] Tetrahedron structure enforced: ${data.edges.length} edges total`);
    data.edges.forEach(e => {
        console.log(`  ${e.from}-${e.to}: ${e.color}, ${e.curveDirection}, curvature=${e.curvature}`);
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
Analyze this image and identify the region containing the geometric figure.

TASK: Find a bounding box that encompasses ALL geometric content WITH GENEROUS MARGINS:
- All vertices and lines
- All labels and annotations (include space for label text fully visible)
- All angle markers and measurements
- Add margin around the figure (at least 20-30 pixels on all sides)
- EXCLUDE: Document borders, large empty background, watermarks, unrelated text

IMPORTANT: The box should have breathing room - don't crop too tightly!

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

⚠️ POLYHEDRON DETECTION RULES - READ CAREFULLY ⚠️

IF you see 4 vertices on a sphere surface:
  → This is a TETRAHEDRON inscribed in the sphere
  → A tetrahedron has EXACTLY 6 EDGES (complete graph of 4 vertices)
  → List ALL 6 edges: A-B, A-C, A-D, B-C, B-D, C-D
  → DO NOT DUPLICATE edges (each edge appears ONCE with ONE color)
  → DO NOT describe it as a "quadrilateral" - it's a 3D tetrahedron!

Edge classification for tetrahedron:
  → Identify the BACK VERTEX (usually leftmost = furthest from camera)
  → 3 edges connecting TO back vertex = internal (typically blue, concave)
  → 3 edges forming FRONT FACE = surface edges (typically red, convex)

Your analysis must include:

1. VERTICES - For each point:
   - label (A, B, C, D, O, etc.)
   - x, y coordinates (0-100 normalized)
   - fillColor (black, red, blue, white, none)
   - size (small, medium, large, or specific like "3pt")
   - shape (circle, square, dot, none)
   - spatialRelation (e.g., "on sphere surface", "center of sphere", "above plane", "on circle")
   - confidence (0.0-1.0)

2. EDGES/LINES - For each connection (⚠️ CRITICAL: Each edge ONCE only, NO DUPLICATES):
   - from, to (vertex labels)
   - style (solid, dashed, dotted, thick, double)
   - thickness (very thin, thin, thick, very thick)
   - color (if not black - IMPORTANT: different colors often indicate different edge types!)
   - geometricRelation: Be SPECIFIC about the edge type:
     * "tetrahedron face edge" = edge on outer front face (connects vertices of front triangle)
     * "internal edge to back vertex" = edge going to the back/hidden vertex (passes through sphere)
     * "radius", "diameter", "chord", "tangent" for circle-related edges
   - isVisible (false for hidden edges in 3D, true by default)
   
   - curveDirection: CRITICAL! Determine from VISUAL APPEARANCE in the image:
     * Look at how the edge VISUALLY curves in the image
     * "convex" = edge bulges OUTWARD (follows the sphere surface on the OUTSIDE/visible side)
     * "concave" = edge curves INWARD (goes THROUGH the sphere interior to back vertex)
     * "straight" = no visible curve
     
   - DETECTION RULES for tetrahedron-in-sphere:
     * Front face edges (forming visible triangle) = "convex" (wrap around sphere exterior)
     * Edges to back vertex (leftmost point) = "concave" (pass through interior)
     * If two colors present: typically one color = front face (convex), other = to back vertex (concave)
     
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
