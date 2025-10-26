
/**
 * Provides a user-friendly error message from a given error object.
 * @param error The error object, which can be of any type.
 * @returns A string containing a user-friendly error message.
 */
export const getFriendlyErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    // Check for common, generic network errors
    if (error.message.toLowerCase().includes('failed to fetch')) {
      return 'A network error occurred. Please check your internet connection and try again.';
    }

    // Check for specific API error messages (example)
    if (error.message.includes('API key not valid')) {
      return 'Authentication Error: The API key is invalid or missing. Please check your configuration.';
    }

    // Return the error message directly for other Error instances
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  console.error('An unknown error occurred:', error);
  return 'An unexpected error occurred. Please see the console for more details.';
};
