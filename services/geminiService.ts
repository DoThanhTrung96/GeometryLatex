// FIX: This file was created to implement the Gemini API services, resolving import errors and providing core AI functionality.
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import type { AnalysisResult, GeometryData, LatexResult } from '../types';

// Initialize the Google GenAI client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes a preprocessed image of a geometric diagram using the Gemini API.
 * @param imageBase64 The base64-encoded string of the preprocessed image.
 * @param mimeType The MIME type of the image.
 * @returns A promise that resolves to an AnalysisResult object containing the bounding box, geometry data, and confidence score.
 */
export const analyzeGeometry = async (imageBase64: string, mimeType: string): Promise<AnalysisResult> => {
    // Use a powerful model for complex visual analysis and structured data extraction.
    const model = 'gemini-2.5-pro';

    const imagePart = {
        inlineData: {
            data: imageBase64,
            mimeType: mimeType,
        },
    };

    const textPart = {
        text: `Analyze the provided image of a geometric diagram. The image is preprocessed (binarized and inverted) with the geometry in white on a black background.
      Your task is to:
      1.  Identify the main geometric figure.
      2.  Determine a tight bounding box coordinates (x, y, width, height) that precisely encloses the geometric figure, ignoring any whitespace or artifacts.
      3.  Extract all geometric features (points, lines, shapes, angles, labels) and their relationships into a structured JSON object. Name this object 'geometryData'.
      4.  Provide a confidence score (a float between 0.0 and 1.0) for the accuracy of your analysis.
      
      Respond with ONLY a single, valid JSON object in the following format, with no surrounding text or markdown backticks:
      {
        "boundingBox": { "x": number, "y": number, "width": number, "height": number },
        "geometryData": { ... },
        "confidenceScore": number
      }`
    };

    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: { parts: [imagePart, textPart] },
        // Request JSON output to ensure a parsable response.
        config: {
            responseMimeType: "application/json",
        },
    });
    
    // Extract the text content from the response and parse it as JSON.
    const jsonString = response.text.trim();
    try {
        const result = JSON.parse(jsonString);
        // Validate the structure of the parsed JSON to ensure it matches expectations.
        if (
            result &&
            typeof result.boundingBox === 'object' &&
            typeof result.boundingBox.x === 'number' &&
            typeof result.boundingBox.y === 'number' &&
            typeof result.boundingBox.width === 'number' &&
            typeof result.boundingBox.height === 'number' &&
            typeof result.geometryData === 'object' &&
            typeof result.confidenceScore === 'number'
        ) {
            return result as AnalysisResult;
        } else {
            throw new Error('Invalid JSON structure in AI response.');
        }
    } catch (e) {
        console.error("Failed to parse AI response JSON:", e);
        console.error("Raw response text:", jsonString);
        throw new Error('Could not parse the JSON response from the AI.');
    }
};

/**
 * Generates TikZ LaTeX code from a structured geometric data object using the Gemini API.
 * @param geometryData The structured JSON object describing the geometry.
 * @returns A promise that resolves to a LatexResult object containing the generated LaTeX code.
 */
export const generateLatex = async (geometryData: GeometryData): Promise<LatexResult> => {
    // Use a model strong in coding and technical languages.
    const model = 'gemini-2.5-pro';

    const prompt = `Based on the following JSON object describing geometric data, generate the corresponding LaTeX code using the TikZ package.
    
    The code should be a complete, self-contained TikZ picture environment.
    Do not include the document class, package imports, or begin/end document commands. Only provide the code from \\begin{tikzpicture} to \\end{tikzpicture}.
    Ensure the generated TikZ code accurately represents the geometric relationships described in the JSON.

    JSON Data:
    ${JSON.stringify(geometryData, null, 2)}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
        model,
        contents: prompt,
    });

    // Extract the generated LaTeX code from the model's response.
    const latexCode = response.text.trim();

    return { latexCode };
};
