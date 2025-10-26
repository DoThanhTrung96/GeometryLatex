# GeoLaTeX Agent - Project Overview

This project is a sophisticated web application that acts as an intelligent agent to convert images of geometric diagrams into compilable LaTeX code using the TikZ library. It leverages the Google Gemini API for its core intelligence, featuring an advanced self-correction mechanism to ensure code quality.

### Project Goal

The primary goal is to automate the tedious process of writing LaTeX code for geometric figures. A user can simply upload a picture of a diagram (e.g., from a textbook or a sketch), and the application will analyze it, generate the precise TikZ code, verify it, and even debug its own code if compilation errors are found.

### Core Technologies

*   **Frontend:** React with TypeScript, providing a robust and type-safe development environment.
*   **Styling:** Tailwind CSS is used for a modern, responsive, and utility-first design.
*   **AI Engine:** The application is powered by the **Google Gemini API**. It uses the powerful **`gemini-2.5-pro`** model for all core AI tasks, including vision analysis, code generation, and code correction, to ensure the highest quality results.
*   **Image Processing:** Advanced, client-side image manipulation is handled in the browser using the **Canvas API**.
*   **Verification:** An external, live LaTeX compilation service is used to validate the AI-generated code, providing a crucial feedback loop.

### Application Workflow

The process is a robust, multi-step pipeline that includes a closed-loop feedback system for self-correction:

1.  **Image Upload & Adaptive Preprocessing:** The user uploads an image. The application performs intelligent preprocessing in the browser. This is not a simple filter; it adaptively detects and crops dark borders (both solid and dashed), calculates dynamic thresholds for binarization, and inverts the image to create a high-contrast, standardized input that is optimal for AI analysis.
2.  **AI Geometry Analysis (`gemini-2.5-pro`):** The processed image is sent to Gemini Pro. The model identifies the geometric figure and returns a structured JSON object containing:
    *   The figure's **bounding box** for precise cropping.
    *   Detailed **geometric data**, including vertices, lines (with styles), and annotations.
    *   A **confidence score** indicating its certainty.
3.  **Initial AI LaTeX Generation (`gemini-2.5-pro`):** The structured JSON data is sent back to Gemini Pro, which acts as a specialized LaTeX programmer to generate the first draft of a complete and compilable TikZ document.
4.  **Verification & Self-Correction Loop:**
    *   **Verify:** The generated LaTeX code is sent to an external online compiler.
    *   **Check:** If the code compiles successfully, the process is complete.
    *   **Correct:** If the compiler returns errors, the agent enters a debugging phase. The original faulty code and the compiler's error log are sent back to Gemini Pro. The AI is instructed to act as an expert LaTeX debugger, analyze the errors, and rewrite the code to fix them. This loop can repeat multiple times to maximize the chance of a successful result.
5.  **Displaying Results:** The UI presents the final, validated output in a clean layout, showing:
    *   The isolated geometric figure.
    *   The AI's confidence score.
    *   The final, formatted, and compilable LaTeX code with a convenient copy button.

### Key Features & UI/UX Highlights

*   **AI Self-Correction:** The application's standout feature is its ability to validate and debug its own code, making it significantly more reliable than a simple one-shot generator.
*   **Intelligent Image Preprocessing:** The adaptive cropping and filtering logic makes the agent resilient to varied image sources and quality.
*   **Detailed Progress Indicator:** The UI provides clear, step-by-step feedback, showing the user the active stage of the process, including "Verifying" and "Self-Correcting."
*   **Organized Results:** The output is neatly arranged in cards, separating the visual result from the underlying data and the final code.
*   **Developer-Friendly Output:** The generated code is displayed in a formatted block with a one-click copy button, ready for immediate use.