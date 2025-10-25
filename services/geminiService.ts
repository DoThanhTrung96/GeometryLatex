
import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, GeometryData, LatexResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    isolatedGeometrySVG: {
      type: Type.STRING,
      description: "An SVG string representation of the isolated primary geometric figure from the image."
    },
    geometryData: {
      type: Type.OBJECT,
      properties: {
        vertices: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              coords: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            },
            required: ["label", "coords"]
          }
        },
        lines: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              from: { type: Type.STRING },
              to: { type: Type.STRING },
              style: { type: Type.STRING, enum: ["solid", "dashed"] }
            },
            required: ["from", "to", "style"]
          }
        },
        labels: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              label: { type: Type.STRING },
              coords: { type: Type.ARRAY, items: { type: Type.NUMBER } }
            },
            required: ["label", "coords"]
          }
        }
      },
      required: ["vertices", "lines"]
    }
  },
  required: ["isolatedGeometrySVG", "geometryData"]
};


export const analyzeGeometry = async (imageBase64: string, mimeType: string): Promise<AnalysisResult> => {
  const prompt = `You are an expert geometry analysis agent. Analyze the provided image.
1. Identify the primary geometric figure.
2. Create an SVG string of ONLY the primary geometric figure, cropping out all other elements. The SVG must be well-formed.
3. Extract all relevant geometric data from the figure. This includes:
   - Coordinates of all vertices, estimating a coordinate system (e.g., from 0,0 at top-left).
   - Labels for each vertex and point (e.g., 'A', 'B', 'O').
   - Identification of all lines, specifying whether they are 'solid' or 'dashed'.
4. Return a single JSON object that strictly adheres to the provided schema.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: {
      parts: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: analysisSchema,
    }
  });
  
  const text = response.text.trim();
  try {
    return JSON.parse(text) as AnalysisResult;
  } catch(e) {
    console.error("Failed to parse Gemini analysis response:", text);
    throw new Error("Could not parse the geometry analysis from the AI. The response was not valid JSON.");
  }
};


const latexSchema = {
    type: Type.OBJECT,
    properties: {
        latexCode: {
            type: Type.STRING,
            description: "A string containing the complete LaTeX code using the TikZ library to draw the figure. It should start with \\begin{tikzpicture} and end with \\end{tikzpicture}."
        }
    },
    required: ["latexCode"]
};

export const generateLatex = async (geometryData: GeometryData): Promise<LatexResult> => {
    const prompt = `You are a LaTeX generation expert specializing in the TikZ library.
Based on the following structured JSON data describing a geometric figure, generate the TikZ code to draw it.

JSON Data:
${JSON.stringify(geometryData, null, 2)}

Instructions:
1.  Verify the geometric data seems correct and complete. If it's logical, proceed.
2.  Generate a complete TikZ code block (\`\\begin{tikzpicture}...\`\\end{tikzpicture}\`) that accurately represents the figure.
3.  Use the provided coordinates for nodes.
4.  Draw all lines, applying 'dashed' or 'solid' styles as specified.
5.  Place all labels correctly.
6.  Return the result as a JSON object that strictly adheres to the provided schema.`;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: latexSchema,
        }
    });
    
    const text = response.text.trim();
    try {
        return JSON.parse(text) as LatexResult;
    } catch(e) {
      console.error("Failed to parse Gemini LaTeX response:", text);
      throw new Error("Could not parse the LaTeX code from the AI. The response was not valid JSON.");
    }
};
