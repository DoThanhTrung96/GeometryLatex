// FR-2: Lossless Image Cropping Service
// Performs pixel-perfect crop of detected geometry region

import type { BoundingBox } from '../types';

/**
 * Crops the image to the specified region with optional padding.
 * 
 * CRITICAL: This operates on the ORIGINAL image, not preprocessed.
 * Cropping is lossless - no quality degradation.
 * 
 * @param imageBase64 - Base64 encoded original image (no data URL prefix)
 * @param boundingBox - Region to crop (from detectGeometryRegion)
 * @param padding - Padding in pixels to add around the crop (default: 10)
 * @returns Promise with cropped image as base64 PNG (no data URL prefix)
 */
export async function cropToRegion(
  imageBase64: string,
  boundingBox: BoundingBox,
  padding: number = 10
): Promise<string> {
  try {
    // Load the original image
    const img = await loadImage(`data:image/png;base64,${imageBase64}`);
    
    // Validate and adjust bounding box with padding
    const validatedBox = validateBoundingBox(
      boundingBox,
      img.width,
      img.height,
      padding
    );
    
    // Create canvas for cropping
    const canvas = document.createElement('canvas');
    canvas.width = validatedBox.width;
    canvas.height = validatedBox.height;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get canvas context for cropping');
    }
    
    // Perform lossless crop
    ctx.drawImage(
      img,
      validatedBox.x, validatedBox.y, validatedBox.width, validatedBox.height,
      0, 0, validatedBox.width, validatedBox.height
    );
    
    // Export as PNG (lossless) and return base64 without data URL prefix
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
    
  } catch (error) {
    console.error('Image cropping failed:', error);
    throw new Error(`Failed to crop image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates and adjusts bounding box to fit within image boundaries.
 * Adds padding while ensuring the box stays within image bounds.
 */
function validateBoundingBox(
  box: BoundingBox,
  imageWidth: number,
  imageHeight: number,
  padding: number
): BoundingBox {
  // Apply padding
  let x = Math.max(0, box.x - padding);
  let y = Math.max(0, box.y - padding);
  let width = box.width + (2 * padding);
  let height = box.height + (2 * padding);
  
  // Clamp to image boundaries
  if (x + width > imageWidth) {
    width = imageWidth - x;
  }
  
  if (y + height > imageHeight) {
    height = imageHeight - y;
  }
  
  // Ensure minimum dimensions
  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid crop dimensions: ${width}x${height}`);
  }
  
  return { x, y, width, height };
}

/**
 * Loads an image from a data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for cropping'));
    img.src = dataUrl;
  });
}

/**
 * Gets actual dimensions of a base64 image without loading into DOM
 */
export async function getImageDimensions(imageBase64: string): Promise<{ width: number; height: number }> {
  const img = await loadImage(`data:image/png;base64,${imageBase64}`);
  return { width: img.width, height: img.height };
}
