// FR-4: Structured Geometry Analysis Service
// Wrapper for AI-based geometry analysis with schema validation

import type { GeometryAnalysisResult, GeometryData } from '../types';

/**
 * Analyzes enhanced image to extract structured geometry data.
 * 
 * CRITICAL: This receives the ENHANCED image (after cropping and quality optimization).
 * The AI analysis uses structured JSON schema for consistent output.
 * 
 * @param enhancedBase64 - Base64 encoded enhanced image (no data URL prefix)
 * @param mimeType - Image MIME type
 * @param aiProvider - AI service to use ('gemini' | 'perplexity')
 * @returns Promise with structured geometry analysis
 */
export async function analyzeGeometry(
  enhancedBase64: string,
  mimeType: string,
  aiProvider: 'perplexity' = 'perplexity'
): Promise<GeometryAnalysisResult> {
  try {
    // Use Perplexity AI service for enhanced structured output
    const service = await import('./perplexityService');
    
    // Call the existing analyzeGeometry which should return AnalysisResult
    const result = await service.analyzeGeometry(enhancedBase64, mimeType);
    
    console.log('AI Analysis Result:', JSON.stringify(result, null, 2));
    
    // Convert legacy AnalysisResult to new GeometryAnalysisResult format
    if (!result.geometryFound) {
      console.error('AI did not detect geometry. Full result:', result);
      throw new Error('No geometry detected in enhanced image. The AI may need a clearer image or the image may not contain recognizable geometric figures.');
    }
    
    // Determine figure type from geometry data
    const figureType = determineFigureType(result.geometryData);
    
    // Calculate overall confidence
    const overallConfidence = calculateOverallConfidence(result.geometryData, result.confidenceScore);
    
    // Add confidence scores to elements if missing
    const enhancedData = addConfidenceScores(result.geometryData, result.confidenceScore);
    
    return {
      figureType,
      geometryData: enhancedData,
      overallConfidence
    };
    
  } catch (error) {
    console.error('Geometry analysis failed:', error);
    throw new Error(`Failed to analyze geometry: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Determines figure type from geometry data
 */
function determineFigureType(data: GeometryData): 'triangle' | 'circle' | 'polygon' | 'composite' | '3d-shape' | 'unknown' {
  const vertexCount = data.vertices?.length || 0;
  const hasCircle = data.specialFeatures?.hasCircle || false;
  
  if (hasCircle) {
    return 'circle';
  }
  
  if (vertexCount === 3) {
    return 'triangle';
  }
  
  if (vertexCount > 3 && vertexCount <= 8) {
    return 'polygon';
  }
  
  if (vertexCount > 8) {
    return 'composite';
  }
  
  return 'unknown';
}

/**
 * Calculates overall confidence from element confidences
 */
function calculateOverallConfidence(data: GeometryData, defaultConfidence: number): number {
  const confidences: number[] = [];
  
  // Collect all confidence scores
  data.vertices?.forEach(v => {
    if (v.confidence !== undefined) {
      confidences.push(v.confidence);
    }
  });
  
  if (data.edges) {
    data.edges.forEach(e => {
      if (e.confidence !== undefined) {
        confidences.push(e.confidence);
      }
    });
  }
  
  if (data.angles) {
    data.angles.forEach(a => {
      if (a.confidence !== undefined) {
        confidences.push(a.confidence);
      }
    });
  }
  
  data.annotations?.forEach(a => {
    if (a.confidence !== undefined) {
      confidences.push(a.confidence);
    }
  });
  
  // Return minimum confidence (weakest link) or default
  if (confidences.length > 0) {
    return Math.min(...confidences);
  }
  
  return defaultConfidence || 0.75;
}

/**
 * Adds default confidence scores to elements that don't have them
 */
function addConfidenceScores(data: GeometryData, defaultConfidence: number): GeometryData {
  const enhanced = { ...data };
  
  // Add confidence to vertices
  if (enhanced.vertices) {
    enhanced.vertices = enhanced.vertices.map(v => ({
      ...v,
      confidence: v.confidence ?? defaultConfidence
    }));
  }
  
  // Add confidence to edges
  if (enhanced.edges) {
    enhanced.edges = enhanced.edges.map(e => ({
      ...e,
      confidence: e.confidence ?? defaultConfidence
    }));
  }
  
  // Add confidence to angles
  if (enhanced.angles) {
    enhanced.angles = enhanced.angles.map(a => ({
      ...a,
      confidence: a.confidence ?? defaultConfidence
    }));
  }
  
  // Add confidence to annotations
  if (enhanced.annotations) {
    enhanced.annotations = enhanced.annotations.map(a => ({
      ...a,
      confidence: a.confidence ?? defaultConfidence
    }));
  }
  
  return enhanced;
}

/**
 * Validates geometry data structure
 */
export function validateGeometryData(data: GeometryData): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check vertices
  if (!data.vertices || data.vertices.length === 0) {
    errors.push('No vertices defined');
  } else {
    data.vertices.forEach((v, i) => {
      if (!v.label) {
        errors.push(`Vertex ${i} missing label`);
      }
      if (v.x < 0 || v.x > 100 || v.y < 0 || v.y > 100) {
        errors.push(`Vertex ${v.label} coordinates out of range (0-100)`);
      }
    });
  }
  
  // Check edges reference existing vertices
  const vertexLabels = new Set(data.vertices?.map(v => v.label) || []);
  
  if (data.edges) {
    data.edges.forEach((e, i) => {
      if (!vertexLabels.has(e.from)) {
        errors.push(`Edge ${i} references undefined vertex: ${e.from}`);
      }
      if (!vertexLabels.has(e.to)) {
        errors.push(`Edge ${i} references undefined vertex: ${e.to}`);
      }
    });
  }
  
  if (data.lines) {
    data.lines.forEach((l, i) => {
      if (!vertexLabels.has(l.from)) {
        errors.push(`Line ${i} references undefined vertex: ${l.from}`);
      }
      if (!vertexLabels.has(l.to)) {
        errors.push(`Line ${i} references undefined vertex: ${l.to}`);
      }
    });
  }
  
  // Check angles reference existing vertices
  if (data.angles) {
    data.angles.forEach((a, i) => {
      if (!vertexLabels.has(a.vertex)) {
        errors.push(`Angle ${i} references undefined vertex: ${a.vertex}`);
      }
      a.arms.forEach(arm => {
        if (!vertexLabels.has(arm)) {
          errors.push(`Angle ${i} arm references undefined vertex: ${arm}`);
        }
      });
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
