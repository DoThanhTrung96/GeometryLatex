import type { VerificationResult } from '../types';

interface CompilerResponse {
    status: 'success' | 'error';
    log: string;
}

/**
 * Verifies LaTeX code by sending it to a real online compiler.
 * @param latexCode The string of LaTeX code to be verified.
 * @returns A promise that resolves to an object indicating success or failure,
 *          along with a compilation log on failure.
 */
export const verifyLatex = async (latexCode: string): Promise<VerificationResult> => {
  // Switched to a more reliable public CORS proxy to fix "Failed to fetch" errors.
  const targetUrl = 'https://rtex.probablya.dev/api/v2/compile';
  const endpoint = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;

  const body = JSON.stringify({
      code: latexCode,
      compiler: 'pdflatex',
  });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
      },
      body: body,
    });

    if (!response.ok) {
      throw new Error(`The compilation service returned an error: ${response.status} ${response.statusText}`);
    }

    const textResponse = await response.text();

    // Safeguard: Check if the response is an HTML error page from the proxy/service
    if (textResponse.trim().startsWith('<!DOCTYPE html>') || textResponse.trim().startsWith('<html')) {
        console.error("Received an HTML page instead of a JSON response from the LaTeX compiler.", textResponse.substring(0, 500));
        throw new Error("The LaTeX verification service is currently unavailable or blocked by a security check.");
    }
    
    const result: CompilerResponse = JSON.parse(textResponse);

    if (result.status === 'success') {
      console.log('LaTeX code successfully compiled.');
      return { success: true };
    } else {
      console.warn('LaTeX compilation failed. See log for details.');
      return { success: false, log: result.log };
    }

  } catch (error) {
    console.error("Error during LaTeX verification:", error);
    if (error instanceof Error && error.message.toLowerCase().includes('failed to fetch')) {
         throw new Error('Failed to connect to the LaTeX compilation service: ' + error.message);
    }
    throw error;
  }
};