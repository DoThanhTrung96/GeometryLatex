
import type { BoundingBox } from '../types';

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image from data.'));
        img.src = src;
    });
};

const calculateAverageBrightness = (imageData: ImageData): number => {
    const data = imageData.data;
    let totalBrightness = 0;
    const pixelCount = data.length / 4;

    for (let i = 0; i < data.length; i += 4) {
        // Standard luminance calculation
        totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    }
    
    return totalBrightness / pixelCount;
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

const binarizeAndInvert = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Step 1: Calculate the average brightness of the (already grayscaled) image.
    let totalGrayValue = 0;
    for (let i = 0; i < data.length; i += 4) {
        totalGrayValue += data[i];
    }
    const adaptiveThreshold = totalGrayValue / (data.length / 4);

    // Step 2: Binarize based on the adaptive threshold.
    // Pixels darker than average are part of the figure (turn white), others are background (turn black).
    for (let i = 0; i < data.length; i += 4) {
        const grayValue = data[i];
        const finalValue = grayValue < adaptiveThreshold ? 255 : 0;
        data[i] = finalValue;
        data[i + 1] = finalValue;
        data[i + 2] = finalValue;
        data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
};

const isRowDark = (imageData: ImageData, y: number, threshold: number, tolerance = 0.95): boolean => {
    const { width, data } = imageData;
    let darkPixels = 0;
    for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const avg = (data[i] + data[i+1] + data[i+2]) / 3;
        if (avg < threshold) {
            darkPixels++;
        }
    }
    return (darkPixels / width) > tolerance;
};

const isColDark = (imageData: ImageData, x: number, threshold: number, tolerance = 0.95): boolean => {
    const { height, width, data } = imageData;
    let darkPixels = 0;
    for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4;
        const avg = (data[i] + data[i+1] + data[i+2]) / 3;
        if (avg < threshold) {
            darkPixels++;
        }
    }
    return (darkPixels / height) > tolerance;
}

const detectAndCropBorder = (ctx: CanvasRenderingContext2D, width: number, height: number): BoundingBox => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const FRAME_SCAN_TOLERANCE = 15; // Max gap size in pixels to tolerate for a dashed line.

    // Calculate a dynamic threshold for what is considered a "dark" border pixel.
    // This makes the detection robust against images with different overall brightness levels.
    const averageBrightness = calculateAverageBrightness(imageData);
    const darknessThreshold = Math.max(20, averageBrightness * 0.5); // A pixel is part of the border if it's 50% darker than average, with a floor of 20.


    let top = 0;
    let consecutiveNonDarkRows = 0;
    for (let y = 0; y < height; y++) {
        if (isRowDark(imageData, y, darknessThreshold)) {
            consecutiveNonDarkRows = 0; // Reset counter, this is part of the frame
        } else {
            consecutiveNonDarkRows++;
        }
        if (consecutiveNonDarkRows > FRAME_SCAN_TOLERANCE) {
            top = y - FRAME_SCAN_TOLERANCE;
            break;
        }
    }

    let bottom = height;
    consecutiveNonDarkRows = 0;
    for (let y = height - 1; y >= 0; y--) {
        if (isRowDark(imageData, y, darknessThreshold)) {
            consecutiveNonDarkRows = 0;
        } else {
            consecutiveNonDarkRows++;
        }
        if (consecutiveNonDarkRows > FRAME_SCAN_TOLERANCE) {
            bottom = y + FRAME_SCAN_TOLERANCE;
            break;
        }
    }

    let left = 0;
    let consecutiveNonDarkCols = 0;
    for (let x = 0; x < width; x++) {
        if (isColDark(imageData, x, darknessThreshold)) {
            consecutiveNonDarkCols = 0;
        } else {
            consecutiveNonDarkCols++;
        }
        if (consecutiveNonDarkCols > FRAME_SCAN_TOLERANCE) {
            left = x - FRAME_SCAN_TOLERANCE;
            break;
        }
    }

    let right = width;
    consecutiveNonDarkCols = 0;
    for (let x = width - 1; x >= 0; x--) {
        if (isColDark(imageData, x, darknessThreshold)) {
            consecutiveNonDarkCols = 0;
        } else {
            consecutiveNonDarkCols++;
        }
        if (consecutiveNonDarkCols > FRAME_SCAN_TOLERANCE) {
            right = x + FRAME_SCAN_TOLERANCE;
            break;
        }
    }
    
    // Add a safety margin to prevent clipping geometry that touches the edge.
    const PADDING = 10; 

    const paddedLeft = Math.max(0, left - PADDING);
    const paddedTop = Math.max(0, top - PADDING);
    const paddedRight = Math.min(width, right + PADDING);
    const paddedBottom = Math.min(height, bottom + PADDING);

    const croppedWidth = Math.max(1, paddedRight - paddedLeft);
    const croppedHeight = Math.max(1, paddedBottom - paddedTop);

    return {
        x: paddedLeft,
        y: paddedTop,
        width: croppedWidth,
        height: croppedHeight,
    };
};

export const preprocessImage = async (imageBase64: string): Promise<string> => {
    const img = await loadImage(`data:image/unknown;base64,${imageBase64}`);
    const originalCanvas = document.createElement('canvas');
    originalCanvas.width = img.width;
    originalCanvas.height = img.height;
    const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
    if (!originalCtx) {
        throw new Error('Could not get canvas context');
    }
    originalCtx.drawImage(img, 0, 0);

    // Step 1: Detect and crop any dark border around the geometry.
    // This now uses an adaptive threshold to reliably find the border in images of varying brightness.
    const contentBox = detectAndCropBorder(originalCtx, originalCanvas.width, originalCanvas.height);
    
    // Step 2: Create a new canvas with the cropped dimensions and draw the content.
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = contentBox.width;
    croppedCanvas.height = contentBox.height;
    const croppedCtx = croppedCanvas.getContext('2d', { willReadFrequently: true });
    if (!croppedCtx) {
        throw new Error('Could not get canvas context for cropping');
    }
    croppedCtx.drawImage(
        originalCanvas, 
        contentBox.x, contentBox.y, contentBox.width, contentBox.height,
        0, 0, contentBox.width, contentBox.height
    );

    // Step 3: Convert the border-less image to grayscale.
    toGrayscale(croppedCtx, croppedCanvas.width, croppedCanvas.height);

    // Step 4: Binarize and invert the image using an adaptive threshold
    // calculated from the cropped image's average brightness. This isolates the geometry.
    binarizeAndInvert(croppedCtx, croppedCanvas.width, croppedCanvas.height);
    
    return croppedCanvas.toDataURL('image/png').split(',')[1];
};

export const cropImage = async (imageBase64: string, box: BoundingBox): Promise<string> => {
    const img = await loadImage(`data:image/png;base64,${imageBase64}`);
    const canvas = document.createElement('canvas');
    canvas.width = box.width;
    canvas.height = box.height;
    const ctx = canvas.getContext('2d');
     if (!ctx) {
        throw new Error('Could not get canvas context for cropping');
    }
    ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);

    return canvas.toDataURL('image/png').split(',')[1];
}

export const getValidatedBoundingBox = async (imageBase64: string, box: BoundingBox): Promise<BoundingBox> => {
    const img = await loadImage(`data:image/png;base64,${imageBase64}`);
    const imgWidth = img.width;
    const imgHeight = img.height;

    const clampedX = Math.max(0, box.x);
    const clampedY = Math.max(0, box.y);

    const clampedWidth = Math.min(box.width, imgWidth - clampedX);
    const clampedHeight = Math.min(box.height, imgHeight - clampedY);

    if (clampedWidth <= 0 || clampedHeight <= 0) {
        console.error("AI returned an invalid bounding box:", box, "for image dimensions:", { imgWidth, imgHeight });
        throw new Error("The AI failed to provide a valid crop area for the detected geometry.");
    }

    return {
        x: clampedX,
        y: clampedY,
        width: clampedWidth,
        height: clampedHeight,
    };
};
