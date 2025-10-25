
export type ProcessingStep = 'IDLE' | 'READY' | 'ANALYZING' | 'VERIFYING' | 'DONE' | 'ERROR';

export interface Vertex {
  label: string;
  coords: [number, number];
}

export interface Line {
  from: string;
  to: string;
  style: 'solid' | 'dashed';
}

export interface GeometryData {
  vertices: Vertex[];
  lines: Line[];
  labels: { label: string; coords: [number, number] }[];
}

export interface AnalysisResult {
  isolatedGeometrySVG: string;
  geometryData: GeometryData;
}

export interface LatexResult {
  latexCode: string;
}
