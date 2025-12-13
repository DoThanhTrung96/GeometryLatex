// Processing pipeline steps (NEW: added DETECTING, CROPPING, ENHANCING)
export type ProcessingStep = 
  | 'IDLE' 
  | 'READY' 
  | 'DETECTING'    // NEW: FR-1 - Region detection
  | 'CROPPING'     // NEW: FR-2 - Lossless crop
  | 'ENHANCING'    // NEW: FR-3 - Quality enhancement
  | 'ANALYZING'    // FR-4 - Structured geometry analysis
  | 'GENERATING'   // FR-5 - LaTeX generation
  | 'VERIFYING' 
  | 'CORRECTING' 
  | 'DONE' 
  | 'ERROR';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// FR-1: Region Detection Result
export interface RegionDetectionResult {
  boundingBox: BoundingBox;
  confidence: number;
  detectionMethod: 'ai-vision' | 'fallback-edge-detection';
}

// FR-3: Image Enhancement Result
export interface EnhancementMetrics {
  originalContrast: number;
  enhancedContrast: number;
  sharpness: number;
  noiseLevel: number;
}

export interface EnhancementResult {
  enhancedBase64: string;
  metrics: EnhancementMetrics;
  appliedFilters: string[];
  finalResolution: { width: number; height: number };
}

// FR-4: Enhanced Geometry Types (with confidence scores)
export interface Vertex {
  label: string;
  x: number;        // 0-100 normalized
  y: number;        // 0-100 normalized
  confidence?: number;
  // Visual properties
  fillColor?: string;          // e.g., 'black', 'red', 'none'
  size?: string;               // e.g., 'small', 'medium', 'large', '2pt', '3pt'
  shape?: string;              // e.g., 'circle', 'square', 'none'
  // Spatial properties
  z?: number;                  // For 3D coordinates
  spatialRelation?: string;    // e.g., 'on sphere surface', 'at center', 'above plane'
}

export interface Edge {
  from: string;
  to: string;
  style: 'solid' | 'dashed' | 'dotted' | 'thick' | 'double';
  label?: string;
  confidence?: number;
  // Additional properties
  thickness?: string;          // e.g., 'very thin', 'thin', 'thick', 'very thick', '0.5pt'
  color?: string;              // e.g., 'black', 'blue', 'red'
  opacity?: number;            // 0.0 to 1.0
  geometricRelation?: string;  // e.g., 'radius', 'diameter', 'edge of tetrahedron face', 'diagonal', 'tangent'
  isVisible?: boolean;         // For hidden edges in 3D (default true)
  // Curve properties - CRITICAL for proper rendering
  curveDirection?: 'convex' | 'concave' | 'straight';  // convex=outward curve, concave=inward curve
  curvature?: number;          // 0.0-1.0 scale: 0=straight, 0.3=slight, 0.5=moderate, 1.0=maximum
}

export interface Angle {
  vertex: string;
  arms: [string, string];
  measure?: string;
  marker: 'right-angle' | 'arc' | 'double-arc' | 'none';
  confidence?: number;
}

export interface Annotation {
  type: 'perpendicular' | 'parallel' | 'congruent' | 'midpoint' | 'text' | 'angle' | 'side-label' | 'relationship' | 'description' | 'label-group';
  position: [number, number] | string;  // Support both formats
  content: string;
  label?: string;  // Backward compatibility
  confidence?: number;
  // Enhanced properties
  fullText?: string;           // Complete annotation text as it appears in image
  textStyle?: string;          // e.g., 'italic', 'bold', 'small', 'normal'
  placement?: string;          // e.g., 'above', 'below', 'left', 'right', 'center'
  refersTo?: string[];         // References to vertices/edges this annotates
  fontSize?: string;           // e.g., 'tiny', 'small', 'normal', 'large'
  color?: string;              // Text color
}

export interface Measurement {
  element: string;
  value: string;
  unit: string;
}

export interface SpecialFeatures {
  hasRightAngle: boolean;
  hasCircle: boolean;
  hasArc: boolean;
  hasMidpoint: boolean;
  isIsosceles?: boolean;
  isEquilateral?: boolean;
}

// Legacy compatibility (keep for old code)
export interface Line {
  from: string;
  to: string;
  style: 'solid' | 'dashed';
}

export interface GeometryData {
  vertices: Vertex[];
  lines?: Line[];          // Legacy
  edges?: Edge[];          // NEW
  angles?: Angle[];        // NEW
  annotations: Annotation[];
  measurements?: Measurement[];
  specialFeatures?: SpecialFeatures;
  // Enhanced geometric context
  geometricDescription?: string;     // Overall description: "Tetrahedron inscribed in sphere"
  dimension?: '2d' | '3d';           // Is this 2D or 3D geometry?
  shapes?: ShapeElement[];           // Circles, spheres, polyhedra
  spatialRelationships?: string[];   // ["O is center of sphere", "A,B,C,D on sphere surface"]
  visualContext?: VisualContext;     // Colors, styles, emphasis
}

// Additional shape elements (circles, spheres, polyhedra)
export interface ShapeElement {
  type: 'circle' | 'sphere' | 'ellipse' | 'arc' | 'polygon' | 'polyhedron' | 'tetrahedron';
  center?: string;              // Vertex label for center
  radius?: string;              // Radius value or reference
  vertices?: string[];          // Vertices forming this shape
  style?: string;               // 'dashed', 'solid', 'dotted'
  fillColor?: string;           // Fill color if applicable
  opacity?: number;
  geometricDescription?: string; // "Circumscribed sphere", "Incircle", etc.
}

export interface VisualContext {
  emphasisColors?: { [key: string]: string };  // e.g., {"O": "red"}
  textAnnotations?: string[];                   // All visible text
  drawingStyle?: string;                        // "geometric", "technical", "sketch"
  hasLabels?: boolean;
  hasGrid?: boolean;
}

// FR-4: Structured Geometry Analysis Result
export interface GeometryAnalysisResult {
  figureType: 'triangle' | 'circle' | 'polygon' | 'composite' | '3d-shape' | 'tetrahedron' | 'sphere' | 'unknown';
  geometryData: GeometryData;
  overallConfidence: number;
}

/**
 * Represents a successful analysis where geometry was found.
 */
export interface AnalysisSuccessResult {
  geometryFound: true;
  boundingBox: BoundingBox;
  geometryData: GeometryData;
  confidenceScore: number;
}

/**
 * Represents a failed analysis where no geometry could be identified.
 */
export interface AnalysisFailureResult {
  geometryFound: false;
}

/**
 * A union type representing the possible outcomes of the geometry analysis.
 */
export type AnalysisResult = AnalysisSuccessResult | AnalysisFailureResult;


// FR-5: LaTeX Generation Result
export interface CodeMetrics {
  lines: number;
  coordinates: number;
  edges: number;
  angles: number;
}

export interface LatexGenerationResult {
  latexCode: string;
  template: string;
  generationMethod: 'template' | 'ai-assisted' | 'ai-full';
  codeMetrics: CodeMetrics;
  warnings: string[];
}

// Legacy compatibility
export interface LatexResult {
  latexCode: string;
}

// Verification
export interface VerificationResult {
  success: boolean;
  log?: string;
  errors?: string[];
  warnings?: string[];
}

// Legacy Analysis Result (for backward compatibility)
// Already defined above - no need to duplicate
