// FR-5: LaTeX Generation Service
// Two-stage generation: Template filling + AI refinement

import type { GeometryData, LatexGenerationResult, CodeMetrics } from '../types';
import { selectTemplate, fillTemplate, validateLatexCode } from './latexTemplates';

/**
 * Generates LaTeX code using template-based approach with optional AI refinement.
 * 
 * Process:
 * 1. Select appropriate template based on geometry type
 * 2. Fill template with geometry data
 * 3. Validate basic syntax
 * 4. Optional: Send to AI for refinement and optimization
 * 
 * @param geometryData - Structured geometry data from analysis
 * @param figureType - Type of geometry ('triangle', 'circle', 'polygon', 'composite')
 * @param useAI - Whether to use AI refinement (default: true)
 * @param aiProvider - Which AI service to use for refinement
 * @returns Promise with complete LaTeX document and metadata
 */
export async function generateLatex(
  geometryData: GeometryData,
  figureType: string = 'unknown',
  useAI: boolean = true,
  aiProvider: 'gemini' | 'perplexity' = 'gemini'
): Promise<LatexGenerationResult> {
  try {
    // Stage 1: Template-based generation
    const template = selectTemplate(figureType);
    let latexCode = fillTemplate(template, geometryData);
    
    // Stage 2: Pre-validation
    const validation = validateLatexCode(latexCode);
    const warnings: string[] = validation.errors;
    
    if (!validation.valid) {
      console.warn('Template generation produced invalid code:', warnings);
    }
    
    // Stage 3: AI refinement (optional)
    let generationMethod: 'template' | 'ai-assisted' | 'ai-full' = 'template';
    
    if (useAI) {
      try {
        const refinedCode = await refineWithAI(latexCode, geometryData, aiProvider);
        latexCode = refinedCode;
        generationMethod = 'ai-assisted';
      } catch (error) {
        console.warn('AI refinement failed, using template output:', error);
        warnings.push('AI refinement unavailable');
      }
    }
    
    // Calculate code metrics
    const metrics = calculateCodeMetrics(latexCode);
    
    return {
      latexCode,
      template: template.name,
      generationMethod,
      codeMetrics: metrics,
      warnings
    };
    
  } catch (error) {
    console.error('LaTeX generation failed:', error);
    throw new Error(`Failed to generate LaTeX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Refines template-generated code using AI
 */
async function refineWithAI(
  templateCode: string,
  geometryData: GeometryData,
  aiProvider: 'gemini' | 'perplexity'
): Promise<string> {
  const service = aiProvider === 'gemini' 
    ? await import('./geminiService')
    : await import('./perplexityService');
  
  // Use the existing generateLatex function as refinement
  // It receives geometry data and produces optimized code
  const result = await service.generateLatex(geometryData);
  return result.latexCode;
}

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
export async function generateLatexAIOnly(
  geometryData: GeometryData,
  aiProvider: 'gemini' | 'perplexity' = 'gemini'
): Promise<LatexGenerationResult> {
  try {
    const service = aiProvider === 'gemini' 
      ? await import('./geminiService')
      : await import('./perplexityService');
    
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
