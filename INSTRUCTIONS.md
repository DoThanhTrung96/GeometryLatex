# GeoLaTeX Agent - Instructions & Technical Notes

This document provides brief instructions and technical details about the operation of the Geometry to LaTeX conversion agent.

## Core Functionality

The application follows a multi-step process:

1.  **Image Upload & Preprocessing**: The user uploads an image containing a geometric figure. The application preprocesses the image client-side, converting it to a high-contrast black-and-white format that is optimal for AI analysis.
2.  **AI Geometry Analysis**: The preprocessed image is sent to the Gemini Pro model. The AI's task is to identify the geometric figure, determine its bounding box for cropping, extract all vertices, lines (solid/dashed), and annotations, and assess its confidence in the analysis.
3.  **Client-Side Cropping**: The application uses the bounding box returned by the AI to perform a pixel-perfect crop of the preprocessed image.
4.  **AI LaTeX Generation**: The structured geometric data (JSON) is sent to the Gemini Flash model. The AI uses this data to generate a complete, compilable LaTeX document using the TikZ library.
5.  **Display Results**: The application displays the isolated (cropped) geometry, the AI's confidence score, the raw JSON analysis, and the final, formatted LaTeX code.

## Technical Note: LaTeX Code Formatting

A key requirement for this application is that the generated LaTeX code must be human-readable and ready to use. A common challenge when working with AI models that generate code within a JSON structure is that they may produce a single, unformatted line of text.

### The Challenge

An AI might return a JSON object like this:

```json
{
  "latexCode": "\\documentclass{standalone}\\n\\usepackage{tikz}\\n\\begin{document}..."
}
```

While technically a valid string, this is not user-friendly when displayed.

### The Solution

To solve this, the application uses specific and explicit prompt engineering for the LaTeX generation step. The prompt sent to the Gemini model includes the following critical instruction:

> **CRITICAL INSTRUCTIONS FOR FORMATTING:**
> - The 'latexCode' string value itself MUST contain newline characters (`\n`) to ensure it is formatted for readability across multiple lines.
> - DO NOT output a single-line string. The output must be human-readable when displayed.

By being direct and technical in the instructions, we guide the AI to produce a JSON string that has the newline characters properly embedded. This results in the code being displayed correctly in the UI's `<pre>` block, making it easy for users to read, copy, and paste into a `.tex` editor for immediate compilation.
