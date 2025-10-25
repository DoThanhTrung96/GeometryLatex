import { GoogleGenAI, GenerateContentResponse, Type } from '@google/genai';
import type { AnalysisResult, GeometryData, LatexResult } from '../types';

// Initialize the Google GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Defines the schema for the structured JSON response from the geometry analysis.
 */
const analysisSchema = {
    type: Type.OBJECT,
    properties: {
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
    required: ['boundingBox', 'geometryData', 'confidenceScore'],
};

/**
 * Analyzes a preprocessed image of a geometric diagram using the Gemini API.
 * @param imageBase64 The base64-encoded string of the preprocessed image.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to an AnalysisResult object.
 */
export const analyzeGeometry = async (imageBase64: string, mimeType: string): Promise<AnalysisResult> => {
    const model = 'gemini-2.5-pro';

    const imagePart = {
        inlineData: { data: imageBase64, mimeType: mimeType },
    };

    const textPart = {
        text: `Analyze the provided image of a geometric diagram, which has been preprocessed to show white geometry on a black background.
      Your task is to:
      1. Identify the main geometric figure.
      2. Determine a tight bounding box that precisely encloses the figure.
      3. Extract all geometric features into a structured 'geometryData' JSON object. This object must contain 'vertices' (an array of points with labels and coordinates), 'lines' (an array connecting vertices with a style like 'solid' or 'dashed'), and 'annotations' (an array for any other labels like angles or side lengths).
      4. Provide a confidence score for the accuracy of your analysis.
      Respond with a JSON object conforming to the provided schema.`
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: analysisSchema, // Use the enforced schema for reliability
        },
    });
    
    const jsonString = response.text.trim();
    try {
        const result = JSON.parse(jsonString);
        // The schema should enforce this, but a check adds robustness.
        if (result && result.boundingBox && result.geometryData && typeof result.confidenceScore === 'number') {
            return result as AnalysisResult;
        } else {
            throw new Error('AI response did not conform to the expected schema.');
        }
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
    const model = 'gemini-2.5-pro';

    const prompt = `Based on the following JSON object describing geometric data, generate a complete and compilable LaTeX document using the TikZ package.
    
    The output MUST be a full LaTeX document as a single string in the 'latexCode' field, including:
    1. The \\documentclass{standalone} command.
    2. The \\usepackage{tikz} and \\usepackage{tkz-euclide} commands for drawing and annotations.
    3. The \\begin{document} and \\end{document} environment.
    4. The TikZ picture environment (\\begin{tikzpicture} ... \\end{tikzpicture}) containing the drawing.
    
    Ensure the generated TikZ code is well-formatted with newlines for readability. It must accurately represent all geometric relationships described in the JSON and be ready for compilation without errors.

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