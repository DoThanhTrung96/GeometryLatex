// Client-Side LaTeX Validation Service
// Validates LaTeX syntax without external compilation

import type { VerificationResult } from '../types';

/**
 * Validates LaTeX code using comprehensive client-side checks.
 * No external API calls - works offline and instantly.
 * 
 * Validation checks:
 * - Document structure (documentclass, begin/end document)
 * - Required packages (tikz, amsmath)
 * - TikZ libraries (angles, quotes, calc, etc.)
 * - Bracket/brace/parenthesis matching
 * - TikZ environment structure
 * - Coordinate syntax validation
 * - Common LaTeX/TikZ errors
 * 
 * @param latexCode - Complete LaTeX document string
 * @returns Validation result with success status, errors, and warnings
 */
export const validateLatex = (latexCode: string): VerificationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Document structure validation
    if (!latexCode.includes('\\documentclass')) {
        errors.push('Missing \\documentclass declaration');
    }
    
    if (!latexCode.includes('\\begin{document}')) {
        errors.push('Missing \\begin{document}');
    }
    
    if (!latexCode.includes('\\end{document}')) {
        errors.push('Missing \\end{document}');
    }

    // Check document environment order
    const docBeginPos = latexCode.indexOf('\\begin{document}');
    const docEndPos = latexCode.indexOf('\\end{document}');
    if (docBeginPos > -1 && docEndPos > -1 && docBeginPos >= docEndPos) {
        errors.push('\\end{document} appears before \\begin{document}');
    }

    // 2. Required packages
    if (!latexCode.includes('\\usepackage{tikz}') && !latexCode.includes('\\usepackage[') && !latexCode.includes('tikz')) {
        errors.push('Missing required package: tikz');
    }
    
    if (!latexCode.includes('\\usepackage{amsmath}')) {
        warnings.push('Missing recommended package: amsmath (needed for math symbols)');
    }

    // 3. TikZ libraries check
    if (latexCode.includes('\\usepackage{tikz}')) {
        if (!latexCode.includes('\\usetikzlibrary')) {
            warnings.push('No TikZ libraries loaded - may need: angles, quotes, calc, arrows.meta');
        } else {
            // Check for common required libraries
            const libs = latexCode.match(/\\usetikzlibrary\{([^}]+)\}/);
            if (libs) {
                const libList = libs[1];
                if (latexCode.includes('angle') && !libList.includes('angles')) {
                    warnings.push('Using angles but "angles" library not loaded');
                }
                if (latexCode.includes('\\draw[->') && !libList.includes('arrows')) {
                    warnings.push('Using arrows but "arrows" or "arrows.meta" library not loaded');
                }
            }
        }
    }

    // 4. TikZ environment matching
    const beginTikz = (latexCode.match(/\\begin\{tikzpicture\}/g) || []).length;
    const endTikz = (latexCode.match(/\\end\{tikzpicture\}/g) || []).length;
    
    if (beginTikz === 0 && endTikz === 0) {
        warnings.push('No tikzpicture environment found - expected for geometry diagrams');
    } else if (beginTikz !== endTikz) {
        errors.push(`Mismatched tikzpicture environments: ${beginTikz} \\begin, ${endTikz} \\end`);
    }

    // 5. Bracket/brace/parenthesis matching
    const counts = {
        '{': (latexCode.match(/\{/g) || []).length,
        '}': (latexCode.match(/\}/g) || []).length,
        '[': (latexCode.match(/\[/g) || []).length,
        ']': (latexCode.match(/\]/g) || []).length,
        '(': (latexCode.match(/\(/g) || []).length,
        ')': (latexCode.match(/\)/g) || []).length,
    };
    
    if (counts['{'] !== counts['}']) {
        errors.push(`Mismatched braces: ${counts['{']} open { vs ${counts['}']} close }`);
    }
    
    if (counts['['] !== counts[']']) {
        errors.push(`Mismatched brackets: ${counts['[']} open [ vs ${counts[']']} close ]`);
    }
    
    if (counts['('] !== counts[')']) {
        errors.push(`Mismatched parentheses: ${counts['(']} open ( vs ${counts[')']} close )`);
    }

    // 6. Common environment matching
    const envPattern = /\\begin\{(\w+)\}/g;
    const envs = new Map<string, number>();
    let match;
    
    while ((match = envPattern.exec(latexCode)) !== null) {
        envs.set(match[1], (envs.get(match[1]) || 0) + 1);
    }
    
    envs.forEach((count, env) => {
        const endPattern = new RegExp(`\\\\end\\{${env}\\}`, 'g');
        const endCount = (latexCode.match(endPattern) || []).length;
        if (count !== endCount) {
            errors.push(`Mismatched environment "${env}": ${count} begin, ${endCount} end`);
        }
    });

    // 7. TikZ command validation
    if (latexCode.includes('\\coordinate') && !latexCode.match(/\\coordinate\s*\([^)]+\)\s+at\s+\([^)]+\)/)) {
        warnings.push('Coordinate definitions may have incorrect syntax - expected: \\coordinate (Name) at (x,y)');
    }
    
    // Check \draw commands end with semicolon
    const drawMatches = latexCode.match(/\\draw[^\n]*$/gm) || [];
    drawMatches.forEach(cmd => {
        if (!cmd.trim().endsWith(';')) {
            warnings.push(`Draw command missing semicolon: "${cmd.substring(0, 50)}..."`);
        }
    });

    // Check for incomplete paths
    const drawCommands = latexCode.match(/\\draw[^;]*;/g) || [];
    drawCommands.forEach((cmd, idx) => {
        const hasPath = cmd.includes('--') || cmd.includes('circle') || cmd.includes('rectangle') || 
                       cmd.includes('arc') || cmd.includes('to') || cmd.includes('node');
        if (!hasPath) {
            warnings.push(`Draw command ${idx + 1} appears empty or incomplete`);
        }
    });

    // 8. Coordinate format validation
    const coordPattern = /\(([^)]+)\)/g;
    const coords = [...latexCode.matchAll(coordPattern)];
    coords.forEach(match => {
        const inner = match[1].trim();
        // Skip if it's a node, calc expression, or style option
        if (inner.startsWith('$') || inner.includes('calc') || inner.includes(':')) return;
        
        // Check numeric coordinates (x,y)
        const numericCoord = /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/;
        const namedCoord = /^[A-Za-z][A-Za-z0-9]*$/;
        
        if (!numericCoord.test(inner) && !namedCoord.test(inner) && !inner.includes('+') && !inner.includes('-')) {
            // Allow relative coordinates like (A)+(1,0)
            warnings.push(`Unusual coordinate format: (${inner})`);
        }
    });

    // 9. Scale parameter check
    if (latexCode.includes('tikzpicture') && !latexCode.match(/\\begin\{tikzpicture\}\[[^\]]*scale/)) {
        warnings.push('No scale parameter in tikzpicture - diagram may appear too large or small');
    }

    // 10. Check for common LaTeX errors
    if (latexCode.includes('$') && !latexCode.includes('$$')) {
        const dollarCount = (latexCode.match(/\$/g) || []).length;
        if (dollarCount % 2 !== 0) {
            errors.push('Mismatched dollar signs for math mode');
        }
    }

    // Check for undefined references
    if (latexCode.includes('??')) {
        warnings.push('Possible undefined references found (??)');
    }

    // Check for % comments that might break commands
    const lines = latexCode.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('%') && !line.trim().startsWith('%')) {
            const beforePercent = line.substring(0, line.indexOf('%'));
            if (beforePercent.includes('\\') && !beforePercent.trim().endsWith(';')) {
                warnings.push(`Line ${idx + 1}: Comment may interrupt command`);
            }
        }
    });

    // 11. Build result
    if (errors.length > 0) {
        return {
            success: false,
            errors,
            warnings,
            log: formatValidationLog('FAILED', errors, warnings)
        };
    }

    if (warnings.length > 0) {
        return {
            success: true,
            warnings,
            log: formatValidationLog('PASSED', [], warnings)
        };
    }

    return {
        success: true,
        log: '✓ LaTeX validation passed - all checks successful'
    };
};

/**
 * Format validation log for display
 */
function formatValidationLog(status: string, errors: string[], warnings: string[]): string {
    let log = `\n=== LaTeX Validation ${status} ===\n`;
    
    if (errors.length > 0) {
        log += `\n❌ ERRORS (${errors.length}):\n`;
        errors.forEach((err, i) => {
            log += `  ${i + 1}. ${err}\n`;
        });
    }
    
    if (warnings.length > 0) {
        log += `\n⚠️  WARNINGS (${warnings.length}):\n`;
        warnings.forEach((warn, i) => {
            log += `  ${i + 1}. ${warn}\n`;
        });
    }
    
    if (errors.length === 0 && warnings.length === 0) {
        log += '\n✓ No issues found\n';
    }
    
    return log;
}

/**
 * Async wrapper for compatibility with existing code
 */
export const verifyLatex = async (latexCode: string): Promise<VerificationResult> => {
    return Promise.resolve(validateLatex(latexCode));
};
