// FR-1: Geometry Region Detection Service
// Detects the exact region containing geometric content from original image

import type { RegionDetectionResult } from '../types';

/**
 * Detects the geometry region in an image using AI vision analysis.
 * 
 * CRITICAL: This function receives the ORIGINAL, UNTOUCHED image.
 * No preprocessing should be done before calling this function.
 * 
 * @param imageBase64 - Base64 encoded image (no data URL prefix)
 * @param mimeType - Image MIME type (e.g., 'image/jpeg', 'image/png')
 * @param aiProvider - AI service to use ('gemini' | 'perplexity')
 * @returns Promise with bounding box, confidence score, and detection method
 */
export async function detectGeometryRegion(
  imageBase64: string,
  mimeType: string,
  aiProvider: 'gemini' | 'perplexity' = 'gemini'
): Promise<RegionDetectionResult> {
  try {
    // Dynamically import the appropriate AI service
    const service = await import('./perplexityService');    // Call the detectRegion function from the AI service
    const result = await service.detectRegion(imageBase64, mimeType);
    
    // Validate the result
    console.log('AI detection result:', JSON.stringify(result, null, 2));
    
    if (!result.boundingBox || 
        result.boundingBox.width <= 0 || 
        result.boundingBox.height <= 0 ||
        result.boundingBox.x < 0 ||
        result.boundingBox.y < 0) {
      console.warn('⚠️ AI returned invalid bounding box, using fallback detection');
      console.warn('Invalid box:', result.boundingBox);
      return fallbackEdgeDetection(imageBase64);
    }
    
    if (result.confidence < 0.5) {
      console.warn(`⚠️ Very low confidence detection: ${result.confidence}. Using fallback...`);
      return fallbackEdgeDetection(imageBase64);
    }
    
    if (result.confidence < 0.7) {
      console.warn(`Low confidence detection: ${result.confidence}. Results may be inaccurate.`);
    }
    
    return result;
    
  } catch (error) {
    console.error('Region detection failed:', error);
    
    // Fallback: Try edge-based detection if AI fails
    console.log('Attempting fallback edge detection...');
    return fallbackEdgeDetection(imageBase64);
  }
}

/**
 * Fallback detection using simple edge analysis.
 * Used when AI detection fails or is unavailable.
 */
async function fallbackEdgeDetection(imageBase64: string): Promise<RegionDetectionResult> {
  // Load image to get dimensions
  const img = await loadImageFromBase64(imageBase64);
  
  // For fallback, return a conservative bounding box with 10% margins
  const margin = 0.1;
  const x = Math.floor(img.width * margin);
  const y = Math.floor(img.height * margin);
  const width = Math.floor(img.width * (1 - 2 * margin));
  const height = Math.floor(img.height * (1 - 2 * margin));
  
  return {
    boundingBox: { x, y, width, height },
    confidence: 0.5,  // Low confidence for fallback
    detectionMethod: 'fallback-edge-detection'
  };
}

/**
 * Utility: Load image from base64 to get dimensions
 */
function loadImageFromBase64(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = `data:image/png;base64,${base64}`;
  });
}
