
import { GoogleGenAI, Type } from "@google/genai";
import type { AnalysisResult, GeometryData, LatexResult, RegionDetectionResult, GeometryAnalysisResult } from '../types';

// According to guidelines, API key must be from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

// ============================================================================
// FR-1: REGION DETECTION
// ============================================================================

/**
 * Detects geometry region in ORIGINAL untouched image.
 * Returns bounding box with confidence score.
 */
export const detectRegion = async (imageBase64: string, mimeType: string): Promise<RegionDetectionResult> => {
  const model = 'gemini-2.0-flash-exp';

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };

  const textPart = {
    text: `
Analyze this image and identify the EXACT region containing the geometric figure.

TASK: Find the bounding box that tightly encompasses ALL geometric content, including:
- All vertices and lines
- All labels and annotations
- All angle markers and measurements
- EXCLUDE: Document borders, background, watermarks, unrelated text

COORDINATE SYSTEM:
- Top-left corner of image = (0, 0)
- X increases right
- Y increases down
- Provide pixel coordinates (integers)

CRITICAL: Analyze the ORIGINAL image quality. Do not assume preprocessing.

Return ONLY a JSON object with this structure:
{
  "boundingBox": {
    "x": <number>,
    "y": <number>,
    "width": <number>,
    "height": <number>
  },
  "confidence": <number 0-1>,
  "detectionMethod": "ai-vision"
}

Confidence scoring:
- 1.0: Perfect clarity, unambiguous geometry
- 0.9: Very clear, minor edge uncertainty  
- 0.8: Clear but some background noise
- 0.7: Detectable but challenging
- <0.7: Poor quality or ambiguous
`
  };

  const regionSchema = {
    type: Type.OBJECT,
    properties: {
      boundingBox: {
        type: Type.OBJECT,
        properties: {
          x: { type: Type.INTEGER },
          y: { type: Type.INTEGER },
          width: { type: Type.INTEGER },
          height: { type: Type.INTEGER },
        },
        required: ['x', 'y', 'width', 'height']
      },
      confidence: { type: Type.NUMBER },
      detectionMethod: { type: Type.STRING }
    },
    required: ['boundingBox', 'confidence', 'detectionMethod']
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [imagePart, textPart] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: regionSchema,
      },
    });

    const jsonText = response.text;
    const result = JSON.parse(jsonText) as RegionDetectionResult;
    return result;

  } catch (error) {
    console.error("Error detecting region with Gemini:", error);
    throw new Error("Gemini failed to detect geometry region.");
  }
};

const geometryDataSchema = {
    type: Type.OBJECT,
    properties: {
        vertices: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    label: { type: Type.STRING },
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                },
                required: ['label', 'x', 'y'],
            }
        },
        lines: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    from: { type: Type.STRING },
                    to: { type: Type.STRING },
                    style: { type: Type.STRING, enum: ['solid', 'dashed'] },
                },
                required: ['from', 'to', 'style'],
            }
        },
        annotations: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    label: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['angle', 'side-label', 'relationship'] },
                    position: { type: Type.STRING, description: "A descriptive position, e.g., 'inside triangle near vertex B'" },
                },
                required: ['label', 'type', 'position'],
            }
        }
    },
    required: ['vertices', 'lines', 'annotations']
};

const analysisResultSchema = {
    type: Type.OBJECT,
    properties: {
        geometryFound: {
            type: Type.BOOLEAN,
            description: "Set to true if a geometric figure is clearly identifiable, otherwise false."
        },
        boundingBox: {
            type: Type.OBJECT,
            description: "The bounding box of the identified geometric figure. Only include if geometryFound is true.",
            properties: {
                x: { type: Type.INTEGER },
                y: { type: Type.INTEGER },
                width: { type: Type.INTEGER },
                height: { type: Type.INTEGER },
            },
            required: ['x', 'y', 'width', 'height']
        },
        geometryData: {
            ...geometryDataSchema,
            description: "Detailed analysis of the geometry. Only include if geometryFound is true."
        },
        confidenceScore: {
            type: Type.NUMBER,
            description: "A score from 0.0 to 1.0 indicating confidence in the analysis. Only include if geometryFound is true."
        }
    },
    required: ['geometryFound']
};


export const analyzeGeometry = async (imageBase64: string, mimeType: string): Promise<AnalysisResult> => {
    // Per guidelines for complex reasoning/STEM, use 'gemini-2.5-pro'.
    const model = 'gemini-2.5-pro';

    const imagePart = {
        inlineData: {
            data: imageBase64,
            mimeType: mimeType,
        },
    };

    const textPart = {
        text: `
Analyze the provided image to identify geometric figures. Your task is to extract structural components even if the image quality is not perfect.

Instructions:
1.  Look for ANY geometric figures (triangles, circles, polygons, lines, angles, etc.). Be GENEROUS - even hand-drawn or imperfect shapes should be detected.
2.  If ANY geometric content is found (even partial or unclear):
    a.  Define a bounding box around the geometric content (normalized 0-100 coordinates).
    b.  Identify vertices with labels (A, B, C, etc.) and normalized x/y coordinates (0-100 scale).
    c.  Identify lines/edges connecting vertices, noting style (solid/dashed).
    d.  Identify annotations: angle markers, measurements, labels, or symbols.
    e.  Provide a confidence score (0.0 to 1.0). Be LENIENT - use >0.5 for any detectable geometry.
3.  ONLY set geometryFound=false if there is absolutely NO geometric content visible.

IMPORTANT: This image has already been cropped and enhanced for analysis. Assume geometric content is present unless clearly absent.

Return your analysis in the specified JSON format.
`
    };

    try {
        const response = await ai.models.generateContent({
            model,
            contents: [{ parts: [imagePart, textPart] }],
            config: {
                responseMimeType: "application/json",
                responseSchema: analysisResultSchema,
            },
        });

        // According to guidelines, use response.text
        const jsonText = response.text;
        const result = JSON.parse(jsonText) as AnalysisResult;
        return result;

    } catch (error) {
        console.error("Error analyzing geometry with Gemini:", error);
        throw new Error("The AI service failed to analyze the image's geometry.");
    }
};

export const generateLatex = async (geometryData: GeometryData): Promise<LatexResult> => {
    // Per guidelines for complex coding, use 'gemini-2.5-pro'.
    const model = 'gemini-2.5-pro';
    const prompt = `
Based on the following JSON data describing a geometric figure, generate a COMPLETE and COMPILABLE LaTeX document using the TikZ package.

JSON Data:
\`\`\`json
${JSON.stringify(geometryData, null, 2)}
\`\`\`

**CRITICAL REQUIREMENTS (Failure to follow will result in compilation errors):**

1.  **COMPLETE DOCUMENT:** The output MUST be a full, standalone LaTeX file. It MUST start with \`\\documentclass{standalone}\` and MUST contain a \`\\begin{document} ... \\end{document}\` environment.
2.  **REQUIRED PACKAGES:** You MUST include \`\\usepackage{tikz}\` and \`\\usepackage{amsmath}\` in the preamble.
3.  **REQUIRED TIKZ LIBRARIES:** You MUST load the necessary TikZ libraries. ALWAYS include \`\\usetikzlibrary{angles,quotes,calc}\` to handle geometric annotations and calculations. This is not optional and is required to prevent compilation errors.
4.  **TIKZ ENVIRONMENT:** All drawing commands must be inside a \`\\begin{tikzpicture} ... \\end{tikzpicture}\` environment.
5.  **COORDINATE SCALING:** The provided coordinates are on a 100x100 grid. Scale them for a visually pleasing output (e.g., by a factor of 0.05 to fit a 5x5 area).
6.  **OUTPUT FORMAT:** The final output must be ONLY the raw LaTeX code. Do NOT include any explanations, comments, or Markdown fences like \`\`\`latex.
7.  **CODE FORMATTING:** The generated LaTeX code MUST be well-formatted and human-readable. Use proper indentation and ensure commands are on separate lines (using newline characters). Do not output a single, minified line of code.
`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });

        // Per guidelines, use response.text
        let latexCode = response.text;

        // Clean up the response just in case the model includes markdown fences
        latexCode = latexCode.replace(/^```latex\n/i, '').replace(/\n```$/, '').trim();

        return { latexCode };

    } catch (error) {
        console.error("Error generating LaTeX with Gemini:", error);
        throw new Error("The AI service failed to generate the LaTeX code.");
    }
};

export const fixLatex = async (brokenCode: string, errorLog: string): Promise<LatexResult> => {
    // Use the more powerful model for correction
    const model = 'gemini-2.5-pro';
    const prompt = `
The following LaTeX code, intended to render a geometric figure with TikZ, has failed to compile. Your task is to act as an expert LaTeX debugger and fix it.

**Broken LaTeX Code:**
\`\`\`latex
${brokenCode}
\`\`\`

**Compilation Error Log:**
\`\`\`
${errorLog}
\`\`\`

**Instructions for Correction:**

1.  **Analyze the Errors:** Carefully read the compilation error log. Identify the root cause of each error. The errors indicate problems like:
    *   A missing \`\\documentclass{...}\` or missing \`\\begin{document}\`.
    *   Missing packages like \`\\usepackage{tikz}\`.
    *   Missing critical TikZ libraries, especially \`\\usetikzlibrary{angles,quotes,calc}\`. This is a very common cause of failure for angle-related commands.
    *   Syntax errors within the \`tikzpicture\` environment (e.g., misspelled commands, incorrect options).

2.  **Rewrite the Code:** Rewrite the entire LaTeX document to fix all identified errors. Do not just make minor edits.

3.  **Ensure Completeness:** The corrected code MUST be a complete, standalone, and compilable document. This means it must include \`\\documentclass\`, all necessary \`\\usepackage\` and \`\\usetikzlibrary\` commands, and the \`\\begin{document}\`...\`\\end{document}\` structure.

4.  **Final Output:** Return ONLY the corrected, raw LaTeX code. Do not include any explanations, apologies, or Markdown fences.
5.  **CODE FORMATTING:** The corrected code must be well-formatted and human-readable, with proper indentation and newlines.
`;

    try {
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });

        let latexCode = response.text;
        latexCode = latexCode.replace(/^```latex\n/i, '').replace(/\n```$/, '').trim();

        return { latexCode };
    } catch (error) {
        console.error("Error fixing LaTeX with Gemini:", error);
        throw new Error("The AI service failed to correct the LaTeX code.");
    }
};
