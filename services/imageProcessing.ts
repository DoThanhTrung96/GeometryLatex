import type { BoundingBox } from '../types';

const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image from data.'));
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

const binarizeAndInvert = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const threshold = 128; 

    for (let i = 0; i < data.length; i += 4) {
        const grayValue = data[i];
        const finalValue = grayValue < threshold ? 255 : 0;
        data[i] = finalValue;
        data[i + 1] = finalValue;
        data[i + 2] = finalValue;
        data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
};

const isRowDark = (imageData: ImageData, y: number, threshold = 50, tolerance = 0.95): boolean => {
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

const isColDark = (imageData: ImageData, x: number, threshold = 50, tolerance = 0.95): boolean => {
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

const autoCropFrame = (ctx: CanvasRenderingContext2D, width: number, height: number): BoundingBox => {
    const imageData = ctx.getImageData(0, 0, width, height);
    
    let top = 0;
    for (let y = 0; y < height / 2; y++) {
        if (!isRowDark(imageData, y)) {
            top = y;
            break;
        }
    }

    let bottom = height;
    for (let y = height - 1; y >= Math.floor(height / 2); y--) {
        if (!isRowDark(imageData, y)) {
            bottom = y;
            break;
        }
    }

    let left = 0;
    for (let x = 0; x < width / 2; x++) {
        if (!isColDark(imageData, x)) {
            left = x;
            break;
        }
    }

    let right = width;
    for (let x = width - 1; x >= Math.floor(width / 2); x--) {
        if (!isColDark(imageData, x)) {
            right = x;
            break;
        }
    }

    const croppedWidth = Math.max(1, right - left);
    const croppedHeight = Math.max(1, bottom - top);

    return {
        x: left,
        y: top,
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

    // Step 1: Automatically detect and calculate the crop for any dark, solid frames.
    const contentBox = autoCropFrame(originalCtx, originalCanvas.width, originalCanvas.height);
    
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

    // Step 3: Perform the standard grayscale and inversion on the frame-less, cropped image.
    toGrayscale(croppedCtx, croppedCanvas.width, croppedCanvas.height);
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