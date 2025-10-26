# GeoLaTeX Agent - Project Overview

This project is a sophisticated web application designed to convert images of geometric diagrams into compilable LaTeX code using the TikZ library. It leverages the Google Gemini API for its core intelligence.

### Project Goal

The primary goal is to automate the tedious process of writing LaTeX code for geometric figures. A user can simply upload a picture of a diagram (e.g., from a textbook or a sketch), and the application will analyze it and generate the precise TikZ code needed to recreate it.

### Core Technologies

*   **Frontend:** React with TypeScript, providing a robust and type-safe development environment.
*   **Styling:** Tailwind CSS is used for a modern, responsive, and utility-first design.
*   **AI Engine:** The application is powered by the **Google Gemini API**. It intelligently uses two different models for distinct tasks to optimize for both quality and speed:
    1.  **`gemini-2.5-pro`**: Used for the complex and vision-intensive task of analyzing the input image to extract structured geometric data (vertices, lines, etc.).
    2.  **`gemini-2.5-flash`**: Used for the faster task of converting the structured JSON data from the first step into formatted LaTeX code.
*   **Image Processing:** Client-side image manipulation is handled in the browser using the **Canvas API**.

### Application Workflow

The process is executed in a clear, multi-step pipeline:

1.  **Image Upload:** The user uploads an image file via a drag-and-drop interface.
2.  **Client-Side Preprocessing:** Before being sent to the AI, the image is processed in the browser. It's converted to grayscale and then binarized and inverted. This creates a high-contrast, black-and-white image (white geometry on a black background), which significantly improves the AI's analysis accuracy.
3.  **AI Geometry Analysis (`gemini-2.5-pro`):** The preprocessed image is sent to the Gemini Pro model. The model is instructed to identify the geometric figure and return a structured JSON object containing:
    *   The figure's **bounding box** for precise cropping.
    *   Detailed **geometric data**, including vertices, lines (with styles like 'solid' or 'dashed'), and annotations.
    *   A **confidence score** indicating how sure the AI is about its analysis.
4.  **Client-Side Cropping:** The application uses the bounding box coordinates returned by the AI to crop the image, isolating only the relevant geometric figure.
5.  **AI LaTeX Generation (`gemini-2.5-flash`):** The structured JSON data is then sent to the Gemini Flash model. Through specific prompt engineering, the model is tasked with generating a complete, human-readable, and compilable LaTeX document using the TikZ package. The prompt explicitly requests properly formatted code with newlines for readability.
6.  **Displaying Results:** The UI presents the final output in a clean, organized layout, showing:
    *   The isolated geometric figure.
    *   The AI's confidence score.
    *   The raw JSON analysis data.
    *   The final, formatted LaTeX code with a convenient copy button.

### Key Features & UI/UX Highlights

*   **Intuitive Interface:** A simple, single-page application that is easy to understand and use.
*   **Step-by-Step Guidance:** A visual progress indicator shows the user which stage of the process is currently active (Analyzing, Generating, Done).
*   **Clear Feedback:** The application provides loading states, informative error messages, and a confidence score to manage user expectations.
*   **Organized Results:** The output is neatly arranged in cards, separating the visual result from the underlying data and the final code.
*   **Developer-Friendly Output:** The generated code is displayed in a formatted block with a one-click copy button, making it extremely easy for the user to integrate it into their documents.
