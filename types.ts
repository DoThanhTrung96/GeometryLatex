// FIX: This file was created to define shared types for the application, resolving import errors in other components.

/**
 * Represents the different states of the image processing pipeline.
 */
export type ProcessingStep = 'IDLE' | 'READY' | 'ANALYZING' | 'VERIFYING' | 'DONE' | 'ERROR';

/**
 * Defines the structure for a bounding box with coordinates and dimensions.
 */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A flexible type for the structured geometric data extracted by the AI.
 */
export interface GeometryData {
  [key: string]: any;
}

/**
 * The structured result from the geometry analysis API call.
 */
export interface AnalysisResult {
  boundingBox: BoundingBox;
  geometryData: GeometryData;
  confidenceScore: number;
}

/**
 * The structured result from the LaTeX generation API call.
 */
export interface LatexResult {
  latexCode: string;
}
