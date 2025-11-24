// Client-Side LaTeX Validation Service
// Validates LaTeX syntax without external API calls (eliminates CORS issues)

import { validateLatex } from './latexValidator';
import type { VerificationResult } from '../types';

/**
 * Validates LaTeX code using comprehensive client-side checks.
 * No external API calls - works offline and instantly.
 * 
 * This replaces the previous external compiler API approach to eliminate CORS issues
 * while maintaining robust validation of LaTeX syntax, structure, and common errors.
 * 
 * Validation includes:
 * - Document structure (documentclass, begin/end document)
 * - Required packages (tikz, amsmath)
 * - TikZ libraries (angles, quotes, calc, etc.)
 * - Bracket/brace/parenthesis matching
 * - Environment matching (tikzpicture, etc.)
 * - Coordinate syntax validation
 * - Draw command completeness
 * - Common LaTeX/TikZ errors
 * 
 * @param latexCode - Complete LaTeX document string
 * @returns Promise resolving to validation result with success status, errors, and warnings
 */
export const verifyLatex = async (latexCode: string): Promise<VerificationResult> => {
    console.log('Validating LaTeX (client-side)...');
    
    try {
        const result = validateLatex(latexCode);
        
        if (result.success) {
            console.log('✓ LaTeX validation passed');
            if (result.warnings && result.warnings.length > 0) {
                console.warn('LaTeX validation warnings:', result.warnings);
            }
        } else {
            console.log('✗ LaTeX validation failed:', result.errors);
            if (result.warnings && result.warnings.length > 0) {
                console.warn('Additional warnings:', result.warnings);
            }
        }
        
        return result;
    } catch (error) {
        console.error('LaTeX validation error:', error);
        return {
            success: false,
            errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`],
            log: `Unexpected error during LaTeX validation: ${error instanceof Error ? error.message : String(error)}`
        };
    }
};
