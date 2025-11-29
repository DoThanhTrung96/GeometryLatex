// FR-5: LaTeX Generation Service
// Two-stage generation: Coordinate transformation + AI styling

import type { GeometryData, LatexGenerationResult, CodeMetrics } from '../types';
import { selectTemplate, fillTemplate, validateLatexCode } from './latexTemplates';
import { transformGeometryData } from './coordinateTransform';

/**
 * Calculates metrics about the generated code
 */
function calculateCodeMetrics(latexCode: string): CodeMetrics {
  const lines = latexCode.split('\n').filter(line => line.trim().length > 0);
  
  const coordinateMatches = latexCode.match(/\\coordinate\s*\(/g);
  const coordinates = coordinateMatches ? coordinateMatches.length : 0;
  
  const edgeMatches = latexCode.match(/\\draw.*--/g);
  const edges = edgeMatches ? edgeMatches.length : 0;
  
  const angleMatches = latexCode.match(/\\pic.*angle/g);
  const angles = angleMatches ? angleMatches.length : 0;
  
  return {
    lines: lines.length,
    coordinates,
    edges,
    angles
  };
}

/**
 * Generates LaTeX code with pre-transformed coordinates
 * 
 * Process:
 * 1. Transform image coordinates to TikZ coordinates (Y-inversion, scaling)
 * 2. Calculate sphere/shape dimensions from vertex positions
 * 3. Send transformed data to AI for styling and code generation
 */
export async function generateLatex(
  geometryData: GeometryData,
  aiProvider: 'perplexity' = 'perplexity'
): Promise<LatexGenerationResult> {
  try {
    // Step 1: Transform coordinates (Y-inversion, scaling)
    console.log('Transforming coordinates for TikZ...');
    const transformedData = transformGeometryData(geometryData, {
      scale: 20,
      invertY: true,
      maxCoord: 100,
      precision: 2
    });
    
    console.log('Transformed vertices:', transformedData.vertices.map(v => 
      `${v.label}: (${v.x}, ${v.y})`
    ).join(', '));
    
    // Step 2: Send to AI for styling
    const service = await import('./perplexityService');
    const result = await service.generateLatex(transformedData);
    const metrics = calculateCodeMetrics(result.latexCode);
    
    return {
      latexCode: result.latexCode,
      template: 'none',
      generationMethod: 'ai-full',
      codeMetrics: metrics,
      warnings: []
    };
    
  } catch (error) {
    console.error('LaTeX generation failed:', error);
    throw new Error(`LaTeX generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
