// FR-3: Image Quality Enhancement Service
// Multi-stage enhancement pipeline for optimal AI comprehension

import type { EnhancementResult, EnhancementMetrics } from '../types';

/**
 * Enhances cropped image through multi-stage pipeline:
 * 1. Analyze current quality metrics
 * 2. Apply adaptive contrast enhancement (CLAHE if needed)
 * 3. Conditional noise reduction
 * 4. Sharpness enhancement
 * 5. Resolution optimization
 * 
 * @param croppedBase64 - Base64 encoded cropped image (no data URL prefix)
 * @returns Promise with enhanced image and metrics
 */
export async function enhanceImage(croppedBase64: string): Promise<EnhancementResult> {
  const appliedFilters: string[] = [];
  
  try {
    // Load image
    const img = await loadImage(`data:image/png;base64,${croppedBase64}`);
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      throw new Error('Failed to get canvas context for enhancement');
    }
    
    ctx.drawImage(img, 0, 0);
    
    // Stage 1: Analyze metrics
    const originalMetrics = analyzeImageQuality(ctx, canvas.width, canvas.height);
    
    // Stage 2: Contrast Enhancement
    if (originalMetrics.originalContrast < 2.0) {
      applyCLAHE(ctx, canvas.width, canvas.height);
      appliedFilters.push('clahe');
    } else {
      applyHistogramStretching(ctx, canvas.width, canvas.height);
      appliedFilters.push('histogram_stretch');
    }
    
    // Stage 3: Noise Reduction (conditional)
    if (originalMetrics.noiseLevel > 0.3) {
      applyBilateralFilter(ctx, canvas.width, canvas.height);
      appliedFilters.push('bilateral_filter');
    }
    
    // Stage 4: Sharpness Enhancement
    applyUnsharpMask(ctx, canvas.width, canvas.height, 1.0);
    appliedFilters.push('unsharp_mask');
    
    // Stage 5: Resolution Optimization
    const targetDimension = 1000;
    const maxDimension = Math.max(canvas.width, canvas.height);
    
    let finalCanvas = canvas;
    if (maxDimension < 800) {
      finalCanvas = upscaleImage(canvas, targetDimension);
      appliedFilters.push('upscale_bicubic');
    } else if (maxDimension > 2000) {
      finalCanvas = downscaleImage(canvas, 1200);
      appliedFilters.push('downscale_lanczos');
    }
    
    // Final metrics
    const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true })!;
    const enhancedMetrics = analyzeImageQuality(finalCtx, finalCanvas.width, finalCanvas.height);
    
    // Export enhanced image
    const enhancedBase64 = finalCanvas.toDataURL('image/png').split(',')[1];
    
    return {
      enhancedBase64,
      metrics: {
        originalContrast: originalMetrics.originalContrast,
        enhancedContrast: enhancedMetrics.originalContrast,
        sharpness: enhancedMetrics.sharpness,
        noiseLevel: enhancedMetrics.noiseLevel
      },
      appliedFilters,
      finalResolution: {
        width: finalCanvas.width,
        height: finalCanvas.height
      }
    };
    
  } catch (error) {
    console.error('Image enhancement failed:', error);
    throw new Error(`Enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Analyzes image quality metrics
 */
function analyzeImageQuality(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): EnhancementMetrics {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Calculate histogram
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[gray]++;
  }
  
  // Contrast ratio (simplified)
  let min = 255, max = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > 0) {
      if (i < min) min = i;
      if (i > max) max = i;
    }
  }
  const contrastRatio = max > 0 ? (max - min) / 255 * 4 : 0;
  
  // Sharpness (edge detection approximation)
  const sharpness = calculateSharpness(data, width, height);
  
  // Noise level (variance in local regions)
  const noiseLevel = calculateNoiseLevel(data, width, height);
  
  return {
    originalContrast: contrastRatio,
    enhancedContrast: contrastRatio,
    sharpness,
    noiseLevel
  };
}

/**
 * CLAHE: Contrast Limited Adaptive Histogram Equalization
 */
function applyCLAHE(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Simplified CLAHE implementation
  const tileSize = 8;
  const clipLimit = 2.0;
  
  for (let ty = 0; ty < height; ty += tileSize) {
    for (let tx = 0; tx < width; tx += tileSize) {
      const tileWidth = Math.min(tileSize, width - tx);
      const tileHeight = Math.min(tileSize, height - ty);
      
      // Build histogram for this tile
      const hist = new Array(256).fill(0);
      for (let y = ty; y < ty + tileHeight; y++) {
        for (let x = tx; x < tx + tileWidth; x++) {
          const i = (y * width + x) * 4;
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          hist[gray]++;
        }
      }
      
      // Clip histogram
      const totalPixels = tileWidth * tileHeight;
      const clipValue = Math.floor(clipLimit * totalPixels / 256);
      let clipped = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipValue) {
          clipped += hist[i] - clipValue;
          hist[i] = clipValue;
        }
      }
      
      // Redistribute clipped
      const redistribution = Math.floor(clipped / 256);
      for (let i = 0; i < 256; i++) {
        hist[i] += redistribution;
      }
      
      // Create CDF
      const cdf = new Array(256);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + hist[i];
      }
      
      // Normalize and apply
      const cdfMin = cdf.find(v => v > 0) || 0;
      for (let y = ty; y < ty + tileHeight; y++) {
        for (let x = tx; x < tx + tileWidth; x++) {
          const i = (y * width + x) * 4;
          const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          const newGray = Math.round(((cdf[gray] - cdfMin) / (totalPixels - cdfMin)) * 255);
          
          const ratio = newGray / (gray || 1);
          data[i] = Math.min(255, data[i] * ratio);
          data[i + 1] = Math.min(255, data[i + 1] * ratio);
          data[i + 2] = Math.min(255, data[i + 2] * ratio);
        }
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Simple histogram stretching
 */
function applyHistogramStretching(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  let min = 255, max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (avg < min) min = avg;
    if (avg > max) max = avg;
  }
  
  const range = max - min;
  if (range > 0) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(((data[i] - min) / range) * 255);
      data[i + 1] = Math.round(((data[i + 1] - min) / range) * 255);
      data[i + 2] = Math.round(((data[i + 2] - min) / range) * 255);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Bilateral filter for noise reduction (simplified approximation)
 */
function applyBilateralFilter(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const output = new Uint8ClampedArray(data);
  
  const radius = 2;
  const sigmaColor = 50;
  const sigmaSpace = 50;
  
  for (let y = radius; y < height - radius; y++) {
    for (let x = radius; x < width - radius; x++) {
      const idx = (y * width + x) * 4;
      const centerR = data[idx];
      const centerG = data[idx + 1];
      const centerB = data[idx + 2];
      
      let sumR = 0, sumG = 0, sumB = 0, sumWeight = 0;
      
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          const nidx = (ny * width + nx) * 4;
          
          const nR = data[nidx];
          const nG = data[nidx + 1];
          const nB = data[nidx + 2];
          
          const colorDist = Math.sqrt(
            Math.pow(centerR - nR, 2) +
            Math.pow(centerG - nG, 2) +
            Math.pow(centerB - nB, 2)
          );
          
          const spaceDist = Math.sqrt(dx * dx + dy * dy);
          
          const weight = Math.exp(
            -(colorDist * colorDist) / (2 * sigmaColor * sigmaColor) -
            (spaceDist * spaceDist) / (2 * sigmaSpace * sigmaSpace)
          );
          
          sumR += nR * weight;
          sumG += nG * weight;
          sumB += nB * weight;
          sumWeight += weight;
        }
      }
      
      output[idx] = sumR / sumWeight;
      output[idx + 1] = sumG / sumWeight;
      output[idx + 2] = sumB / sumWeight;
    }
  }
  
  for (let i = 0; i < data.length; i++) {
    data[i] = output[i];
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Unsharp mask for sharpness enhancement
 */
function applyUnsharpMask(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const blurred = new Uint8ClampedArray(data);
  
  // Gaussian blur (radius 1)
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const kernelSum = 16;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const idx = ((y + dy) * width + (x + dx)) * 4 + c;
            sum += data[idx] * kernel[ki++];
          }
        }
        blurred[(y * width + x) * 4 + c] = sum / kernelSum;
      }
    }
  }
  
  // Apply unsharp mask
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const original = data[i + c];
      const blur = blurred[i + c];
      data[i + c] = Math.min(255, Math.max(0, original + amount * (original - blur)));
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Upscale image using bicubic interpolation
 */
function upscaleImage(sourceCanvas: HTMLCanvasElement, targetDimension: number): HTMLCanvasElement {
  const scale = targetDimension / Math.max(sourceCanvas.width, sourceCanvas.height);
  const newWidth = Math.round(sourceCanvas.width * scale);
  const newHeight = Math.round(sourceCanvas.height * scale);
  
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);
  
  return canvas;
}

/**
 * Downscale image using Lanczos-like filter
 */
function downscaleImage(sourceCanvas: HTMLCanvasElement, targetDimension: number): HTMLCanvasElement {
  const scale = targetDimension / Math.max(sourceCanvas.width, sourceCanvas.height);
  const newWidth = Math.round(sourceCanvas.width * scale);
  const newHeight = Math.round(sourceCanvas.height * scale);
  
  const canvas = document.createElement('canvas');
  canvas.width = newWidth;
  canvas.height = newHeight;
  
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, newWidth, newHeight);
  
  return canvas;
}

/**
 * Calculate sharpness score
 */
function calculateSharpness(data: Uint8ClampedArray, width: number, height: number): number {
  let sum = 0;
  let count = 0;
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const center = data[idx];
      const right = data[idx + 4];
      const bottom = data[(y + 1) * width * 4 + x * 4];
      
      const dx = Math.abs(center - right);
      const dy = Math.abs(center - bottom);
      sum += dx + dy;
      count += 2;
    }
  }
  
  return sum / count / 255;  // Normalized 0-1
}

/**
 * Calculate noise level
 */
function calculateNoiseLevel(data: Uint8ClampedArray, width: number, height: number): number {
  let variance = 0;
  let count = 0;
  const blockSize = 8;
  
  for (let y = 0; y < height - blockSize; y += blockSize) {
    for (let x = 0; x < width - blockSize; x += blockSize) {
      let mean = 0;
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          mean += data[idx];
        }
      }
      mean /= (blockSize * blockSize);
      
      let blockVar = 0;
      for (let dy = 0; dy < blockSize; dy++) {
        for (let dx = 0; dx < blockSize; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          blockVar += Math.pow(data[idx] - mean, 2);
        }
      }
      variance += blockVar / (blockSize * blockSize);
      count++;
    }
  }
  
  return Math.sqrt(variance / count) / 255;  // Normalized 0-1
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}
