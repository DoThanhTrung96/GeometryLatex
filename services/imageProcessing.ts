
const loadImage = (base64: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:image/jpeg;base64,${base64}`; // Assume a common format, browser will handle it
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

const convolve = (ctx: CanvasRenderingContext2D, width: number, height: number, kernel: number[][]) => {
    const src = ctx.getImageData(0, 0, width, height);
    const srcData = src.data;
    const dst = ctx.createImageData(width, height);
    const dstData = dst.data;
    
    const kernelSize = kernel.length;
    const halfKernel = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dstOff = (y * width + x) * 4;
            let r = 0, g = 0, b = 0;
            
            for (let ky = 0; ky < kernelSize; ky++) {
                for (let kx = 0; kx < kernelSize; kx++) {
                    const sy = Math.min(height - 1, Math.max(0, y + ky - halfKernel));
                    const sx = Math.min(width - 1, Math.max(0, x + kx - halfKernel));
                    const srcOff = (sy * width + sx) * 4;
                    const wt = kernel[ky][kx];
                    r += srcData[srcOff] * wt;
                    g += srcData[srcOff + 1] * wt;
                    b += srcData[srcOff + 2] * wt;
                }
            }
            dstData[dstOff] = r;
            dstData[dstOff + 1] = g;
            dstData[dstOff + 2] = b;
            dstData[dstOff + 3] = 255; // alpha
        }
    }
    ctx.putImageData(dst, 0, 0);
}

const sobelFilter = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const grayscale = ctx.getImageData(0, 0, width, height);
    const sobelData = ctx.createImageData(width, height);
    const sobelPixels = sobelData.data;
    const data = grayscale.data;

    const kernelX = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ];
    const kernelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
    ];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            let pixelX = 0;
            let pixelY = 0;

            for (let ky = 0; ky < 3; ky++) {
                for (let kx = 0; kx < 3; kx++) {
                    const sy = Math.min(height - 1, Math.max(0, y + ky - 1));
                    const sx = Math.min(width - 1, Math.max(0, x + kx - 1));
                    const srcOff = (sy * width + sx) * 4;
                    const weightX = kernelX[ky][kx];
                    const weightY = kernelY[ky][kx];
                    pixelX += data[srcOff] * weightX;
                    pixelY += data[srcOff] * weightY;
                }
            }
            const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY) >>> 0;
            sobelPixels[i] = magnitude;
            sobelPixels[i + 1] = magnitude;
            sobelPixels[i + 2] = magnitude;
            sobelPixels[i + 3] = 255;
        }
    }
    ctx.putImageData(sobelData, 0, 0);
};

const binarize = (ctx: CanvasRenderingContext2D, width: number, height: number, threshold: number) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const val = data[i] > threshold ? 255 : 0;
        data[i] = val;
        data[i+1] = val;
        data[i+2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
};


/**
 * Applies a series of filters to an image to prepare it for geometry analysis.
 * The pipeline is: Grayscale -> Gaussian Blur -> Sobel Edge Detection -> Binarization
 * @param imageBase64 The base64 encoded source image.
 * @returns A promise that resolves with the base64 encoded, preprocessed PNG image.
 */
export const preprocessImage = async (imageBase64: string): Promise<string> => {
    const img = await loadImage(imageBase64);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
        throw new Error('Could not get canvas context');
    }
    ctx.drawImage(img, 0, 0);

    // 1. Grayscale
    toGrayscale(ctx, canvas.width, canvas.height);

    // 2. Gaussian Blur for noise reduction
    const gaussianKernel = [
      [1/16, 2/16, 1/16],
      [2/16, 4/16, 2/16],
      [1/16, 2/16, 1/16]
    ];
    convolve(ctx, canvas.width, canvas.height, gaussianKernel);
    
    // 3. Sobel Filter for edge enhancement
    sobelFilter(ctx, canvas.width, canvas.height);

    // 4. Binarize the result for a clean black & white edge map
    binarize(ctx, canvas.width, canvas.height, 50); // Threshold of 50

    // Invert colors for better visibility for the AI (black lines on white background)
    ctx.globalCompositeOperation = 'difference';
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Return as a PNG base64 string
    return canvas.toDataURL('image/png').split(',')[1];
};
