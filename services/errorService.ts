/**
 * Takes an error of unknown type and returns a user-friendly error message string.
 * This function is designed to interpret common API and network errors and provide
 * clearer feedback to the user than a raw error message or stack trace.
 *
 * @param error The error object, which can be of any type.
 * @returns A string containing a user-friendly error message.
 */
export const getFriendlyErrorMessage = (error: unknown): string => {
    // Log the full error for developers to debug
    console.error("An error occurred during processing:", error);

    if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();

        // Specific, user-friendly messages from our own application logic
        if (errorMessage.includes("no geometric figure could be identified")) {
            return "No geometric figure could be identified in the image. Please try a different or clearer image.";
        }
        if (errorMessage.includes("could not parse the json response")) {
            return "The AI returned an unexpected data format. This can happen with very complex images. Please try again.";
        }

        // Check for potential API key issues (heuristic based on common error messages)
        if (errorMessage.includes("api key not valid") || errorMessage.includes("permission denied")) {
            return "Authentication failed. Please ensure the API key is valid and has the necessary permissions.";
        }

        // Check for quota/rate limiting issues
        if (errorMessage.includes("quota") || errorMessage.includes("rate limit")) {
            return "The request limit has been reached. Please wait a while before trying again.";
        }

        // Check for network-related issues
        if (errorMessage.includes("failed to fetch") || errorMessage.includes("networkerror")) {
            return "Failed to connect to the AI service. Please check your internet connection.";
        }
        
        // Generic fallback using the error message for unexpected but typed errors
        return `An unexpected error occurred: ${error.message}`;
    }
    
    // Final fallback for non-Error types or other unknown issues
    return "An unknown error occurred during processing. Please try again.";
};