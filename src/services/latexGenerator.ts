// FR-5: LaTeX Generation Service
// Two-stage generation: Template filling + AI refinement

import type { GeometryData, LatexGenerationResult, CodeMetrics } from '../types';
import { selectTemplate, fillTemplate, validateLatexCode } from './latexTemplates';



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
 * Generates LaTeX code purely from AI without templates (fallback)
 */
export async function generateLatex(
  geometryData: GeometryData,
  aiProvider: 'perplexity' = 'perplexity'
): Promise<LatexGenerationResult> {
  try {
    const service = await import('./perplexityService');
    
    const result = await service.generateLatex(geometryData);
    const metrics = calculateCodeMetrics(result.latexCode);
    
    return {
      latexCode: result.latexCode,
      template: 'none',
      generationMethod: 'ai-full',
      codeMetrics: metrics,
      warnings: []
    };
    
  } catch (error) {
    console.error('AI-only generation failed:', error);
    throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
