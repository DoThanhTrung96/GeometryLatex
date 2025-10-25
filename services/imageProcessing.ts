import type { BoundingBox } from '../types';

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image from data.')); // Pass a proper Error object
        img.src = src;
    });
};

const toGrayscale = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg; // red
        data[i + 1] = avg; // green
        data[i + 2] = avg; // blue
    }
    ctx.putImageData(imageData, 0, 0);
};

/**
 * Binarizes the image based on a threshold, inverts the colors, and ensures it is opaque.
 * Assumes a grayscale image is on the canvas.
 * This turns dark lines on a light background into bright white lines on a black background.
 * @param ctx The canvas rendering context.
 * @param width The width of the canvas.
 * @param height The height of the canvas.
 */
const binarizeAndInvert = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const threshold = 128; // Pixels darker than this are considered part of a line.

    for (let i = 0; i < data.length; i += 4) {
        // data[i] is the grayscale value because toGrayscale was called first.
        const grayValue = data[i];

        // If the pixel is darker than the threshold, it's part of the geometry (make it white).
        // If it's lighter, it's part of the background (make it black).
        const finalValue = grayValue < threshold ? 255 : 0;

        data[i] = finalValue;     // red
        data[i + 1] = finalValue; // green
        data[i + 2] = finalValue; // blue
        data[i + 3] = 255;        // Force alpha to be fully opaque.
    }
    ctx.putImageData(imageData, 0, 0);
};


/**
 * Applies a robust series of filters to an image to prepare it for geometry analysis.
 * The new pipeline is: Grayscale -> Binarize & Invert.
 * This creates a high-contrast, clean, opaque image with solid white features on a solid black background,
 * which is much more reliable for AI analysis than edge detection.
 * @param imageBase64 The base64 encoded source image.
 * @returns A promise that resolves with the base64 encoded, preprocessed PNG image.
 */
export const preprocessImage = async (imageBase64: string): Promise<string> => {
    const img = await loadImage(`data:image/unknown;base64,${imageBase64}`);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }
    ctx.drawImage(img, 0, 0);

    // 1. Convert to grayscale to work with a single channel for thresholding.
    toGrayscale(ctx, canvas.width, canvas.height);

    // 2. Binarize and Invert the image. This makes the geometry lines solid white and
    // the background solid black, providing a very clear input for the AI model to analyze.
    // This new method is far more effective than the previous edge detection filter.
    binarizeAndInvert(ctx, canvas.width, canvas.height);
    
    // Return as a PNG base64 string for lossless transmission to the AI.
    return canvas.toDataURL('image/png').split(',')[1];
};

/**
 * Crops an image using the provided bounding box.
 * @param imageBase64 The base64 encoded source image to crop.
 * @param box The bounding box with x, y, width, and height.
 * @returns A promise that resolves with the base64 encoded, cropped PNG image.
 */
export const cropImage = async (imageBase64: string, box: BoundingBox): Promise<string> => {
    // We load the preprocessed image, which is guaranteed to be a PNG from our pipeline
    const img = await loadImage(`data:image/png;base64,${imageBase64}`);
    const canvas = document.createElement('canvas');
    canvas.width = box.width;
    canvas.height = box.height;
    const ctx = canvas.getContext('2d');
     if (!ctx) {
        throw new Error('Could not get canvas context for cropping');
    }
    // Draw the relevant part of the source image onto the new, smaller canvas
    ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);

    // Using image/png for lossless cropping
    return canvas.toDataURL('image/png').split(',')[1];
}