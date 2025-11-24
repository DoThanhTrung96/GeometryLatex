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
}

export interface Edge {
  from: string;
  to: string;
  style: 'solid' | 'dashed' | 'dotted' | 'thick' | 'double';
  label?: string;
  confidence?: number;
}

export interface Angle {
  vertex: string;
  arms: [string, string];
  measure?: string;
  marker: 'right-angle' | 'arc' | 'double-arc' | 'none';
  confidence?: number;
}

export interface Annotation {
  type: 'perpendicular' | 'parallel' | 'congruent' | 'midpoint' | 'text' | 'angle' | 'side-label' | 'relationship';
  position: [number, number] | string;  // Support both formats
  content: string;
  label?: string;  // Backward compatibility
  confidence?: number;
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
}

// FR-4: Structured Geometry Analysis Result
export interface GeometryAnalysisResult {
  figureType: 'triangle' | 'circle' | 'polygon' | 'composite' | '3d-shape' | 'unknown';
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
