import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import type { AnalysisResult, GeometryData, LatexResult } from '../types';

// Initialize the Google GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Defines the schema for the structured JSON response from the geometry analysis.
 * It now includes a mandatory 'geometryFound' flag to handle cases with no geometry.
 */
const analysisSchema = {
    type: Type.OBJECT,
    properties: {
        geometryFound: {
            type: Type.BOOLEAN,
            description: "Set to true if a geometric figure was found, otherwise false."
        },
        boundingBox: {
            type: Type.OBJECT,
            properties: {
                x: { type: Type.NUMBER, description: "The x-coordinate of the top-left corner." },
                y: { type: Type.NUMBER, description: "The y-coordinate of the top-left corner." },
                width: { type: Type.NUMBER, description: "The width of the bounding box." },
                height: { type: Type.NUMBER, description: "The height of the bounding box." },
            },
            required: ['x', 'y', 'width', 'height'],
        },
        geometryData: {
            type: Type.OBJECT,
            description: "A detailed JSON object describing all geometric features.",
            properties: {
                vertices: {
                    type: Type.ARRAY,
                    description: "List of all vertices with their labels and coordinates.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label: { type: Type.STRING },
                            x: { type: Type.NUMBER },
                            y: { type: Type.NUMBER }
                        },
                        required: ['label', 'x', 'y']
                    }
                },
                lines: {
                    type: Type.ARRAY,
                    description: "List of all lines connecting vertices, including their style.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            from: { type: Type.STRING, description: "Label of the starting vertex." },
                            to: { type: Type.STRING, description: "Label of the ending vertex." },
                            style: { type: Type.STRING, description: "'solid' or 'dashed'." }
                        },
                        required: ['from', 'to', 'style']
                    }
                },
                annotations: {
                    type: Type.ARRAY,
                    description: "List of any annotations like angles or side labels. Can be empty.",
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            label: { type: Type.STRING, description: "The text of the annotation (e.g., 'a', '45°')." },
                            type: { type: Type.STRING, description: "'angle' or 'side-label'." },
                            position: { type: Type.STRING, description: "A semantic description of where the annotation is located (e.g., 'midpoint of BC', 'angle at vertex A')."}
                        },
                        required: ['label', 'type', 'position']
                    }
                }
            },
            required: ['vertices', 'lines', 'annotations']
        },
        confidenceScore: {
            type: Type.NUMBER,
            description: "A float between 0.0 and 1.0 indicating the model's confidence in the analysis."
        },
    },
    required: ['geometryFound'], // Only geometryFound is always required.
};

/**
 * Analyzes a preprocessed image of a geometric diagram using the Gemini API.
 * @param imageBase64 The base64-encoded string of the preprocessed image.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to an AnalysisResult object, which indicates success or failure.
 */
export const analyzeGeometry = async (imageBase64: string, mimeType: string): Promise<AnalysisResult> => {
    const model = 'gemini-2.5-pro';

    const imagePart = {
        inlineData: { data: imageBase64, mimeType: mimeType },
    };

    const textPart = {
        text: `Analyze the provided image of a geometric diagram, which has been preprocessed to show white geometry on a black background.
      Your task is to:
      1. Analyze the image to find a main geometric figure. A solid-color image (e.g., all white or all black) does not count as a discernible figure.
      2. If a figure is found, set 'geometryFound' to true and provide a tight 'boundingBox', the extracted 'geometryData', and a 'confidenceScore'.
      3. If no discernible geometric figure is present (e.g., the image is blank, solid-colored, or contains only text), you MUST set 'geometryFound' to false and omit the 'boundingBox', 'geometryData', and 'confidenceScore' fields.
      Respond with a JSON object conforming to the provided schema.`
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema,
            thinkingConfig: { thinkingBudget: 32768 },
        },
    });
    
    const jsonString = response.text.trim();
    try {
        const result = JSON.parse(jsonString);
        return result as AnalysisResult;
    } catch (e) {
        console.error("Failed to parse AI response JSON:", e);
        console.error("Raw response text:", jsonString);
        throw new Error('Could not parse the JSON response from the AI.');
    }
};

/**
 * Defines the schema for the structured JSON response for LaTeX generation.
 */
const latexSchema = {
    type: Type.OBJECT,
    properties: {
        latexCode: {
            type: Type.STRING,
            description: "A complete, standalone, and compilable LaTeX document as a single string."
        }
    },
    required: ['latexCode']
};

/**
 * Generates TikZ LaTeX code from a structured geometric data object using the Gemini API.
 * @param geometryData The structured JSON object describing the geometry.
 * @returns A promise that resolves to a LatexResult object.
 */
export const generateLatex = async (geometryData: GeometryData): Promise<LatexResult> => {
    const model = 'gemini-2.5-flash';

    const prompt = `Based on the following JSON object describing geometric data, generate a complete and compilable LaTeX document using the TikZ package.
    
    The output MUST be a full LaTeX document as a single string in the 'latexCode' field.
    
    CRITICAL INSTRUCTIONS FOR FORMATTING:
    - The 'latexCode' string value itself MUST contain newline characters (\\n) to ensure it is formatted for readability across multiple lines.
    - DO NOT output a single-line string. The output must be human-readable when displayed.

    The document must include:
    1. The \\documentclass{standalone} command.
    2. The \\usepackage{tikz} command for drawing.
    3. The \\begin{document} and \\end{document} environment.
    4. The TikZ picture environment (\\begin{tikzpicture} ... \\end{tikzpicture}) containing the drawing.
    
    The generated TikZ code must accurately represent all geometric relationships described in the JSON and be ready for compilation without errors.

    JSON Data:
    ${JSON.stringify(geometryData, null, 2)}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: latexSchema, // Enforce a structured JSON response
        }
    });

    const jsonString = response.text.trim();
    try {
        const result = JSON.parse(jsonString);
        if (result && typeof result.latexCode === 'string') {
            return result as LatexResult;
        } else {
            throw new Error('Invalid JSON structure for LaTeX response.');
        }
    } catch (e) {
        console.error("Failed to parse LaTeX AI response JSON:", e);
        console.error("Raw LaTeX response text:", jsonString);
        throw new Error('Could not parse the JSON response for LaTeX from the AI.');
    }
};

/**
 * Attempts to fix a broken LaTeX code snippet based on a compilation error log.
 * This version uses Google Search grounding to find solutions for the error.
 * @param brokenCode The LaTeX code that failed to compile.
 * @param errorLog The error log from the compiler.
 * @returns A promise that resolves to a LatexResult object with the corrected code.
 */
export const fixLatexCode = async (brokenCode: string, errorLog: string): Promise<LatexResult> => {
    const model = 'gemini-2.5-flash';

    const prompt = `The following LaTeX code failed to compile. Below is the code and the error log from the compiler.
    Your task is to:
    1. Use Google Search to understand the error and find a solution. Common errors involve missing packages, incorrect syntax, or TikZ coordinate issues.
    2. Fix the LaTeX code.
    3. Return ONLY the complete, corrected, and compilable LaTeX document as a single block of text.

    CRITICAL: Your entire response must be only the LaTeX code, starting with \\documentclass and ending with \\end{document}. Do not include any other text, explanations, markdown code fences, or JSON formatting.

    --- BROKEN LATEX CODE ---
    ${brokenCode}
    --- END BROKEN LATEX CODE ---

    --- COMPILER ERROR LOG ---
    ${errorLog}
    --- END COMPILER ERROR LOG ---
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
            tools: [{googleSearch: {}}], // Use Google Search for grounding
        }
    });

    const fixedCode = response.text.trim();
    
    // The model is prompted to return only the code, so we can directly use the response text.
    if (fixedCode.startsWith('\\documentclass')) {
        return { latexCode: fixedCode };
    } else {
        // This is a fallback in case the model doesn't follow instructions perfectly.
        console.error("Failed to get valid LaTeX code from the fix attempt. Raw response:", fixedCode);
        throw new Error('The AI failed to return a valid LaTeX document during the fix attempt.');
    }
};