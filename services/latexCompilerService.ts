interface VerificationResult {
    success: boolean;
    log: string | null;
}

/**
 * Verifies LaTeX code by sending it to an online compilation service.
 * @param latexCode The LaTeX code to verify.
 * @returns A promise that resolves to an object indicating success and providing an error log if applicable.
 */
export const verifyLatex = async (latexCode: string): Promise<VerificationResult> => {
    const formData = new FormData();
    formData.append('code', latexCode);
    formData.append('command', 'pdflatex');

    try {
        // NOTE: In a real-world production app, this functionality should be handled by a dedicated backend
        // service that you control. This backend would make the request to the LaTeX compiler, bypassing
        // browser CORS restrictions. Using a public CORS proxy is a workaround for this demo environment.
        const response = await fetch('https://cors-proxy.pyli.workers.dev/?https://latexonline.cc/compile', {
            method: 'POST',
            body: formData,
        });

        const contentType = response.headers.get('content-type');
        
        // A successful compilation returns a PDF.
        if (response.ok && contentType?.includes('application/pdf')) {
            return { success: true, log: null };
        } else {
            // A failed compilation returns a text log with error details.
            const logText = await response.text();
            return { success: false, log: logText };
        }
    } catch (e) {
        console.error("Error during LaTeX verification:", e);
        const errorMessage = e instanceof Error ? e.message : 'An unknown network error occurred.';
        // This error is a network failure, not a compilation failure.
        throw new Error(`Failed to connect to the LaTeX compilation service: ${errorMessage}`);
    }
};
