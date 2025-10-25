export type ProcessingStep = 'IDLE' | 'READY' | 'ANALYZING' | 'VERIFYING' | 'DONE' | 'ERROR';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Vertex {
  label: string;
  x: number;
  y: number;
}

export interface Line {
  from: string;
  to: string;
  style: 'solid' | 'dashed';
}

export interface Annotation {
  label: string;
  type: 'angle' | 'side-label';
  position: string;
}

export interface GeometryData {
  vertices: Vertex[];
  lines: Line[];
  annotations: Annotation[];
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


export interface LatexResult {
  latexCode: string;
}
