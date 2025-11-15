// netlify/functions/utils/parseJSON.js
// Utility for safely parsing JSON from request bodies

/**
 * Safely parse JSON from request body with proper error handling
 * @param {string} body - The request body to parse
 * @returns {{success: boolean, data?: any, error?: string}} Parse result
 */
function safeParseJSON(body) {
  // Validate body exists and is a string
  if (body === null || body === undefined) {
    return {
      success: false,
      error: 'Request body is missing'
    };
  }

  if (typeof body !== 'string') {
    return {
      success: false,
      error: 'Request body must be a string'
    };
  }

  if (body.trim() === '') {
    return {
      success: false,
      error: 'Request body is empty'
    };
  }

  // Attempt to parse JSON
  try {
    const data = JSON.parse(body);
    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      error: `Invalid JSON: ${error.message}`
    };
  }
}

/**
 * Create a standardized 400 error response for bad JSON
 * @param {string} errorMessage - The error message
 * @returns {{statusCode: number, body: string}} Error response
 */
function createBadRequestResponse(errorMessage) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      message: 'Bad Request',
      error: errorMessage
    })
  };
}

module.exports = {
  safeParseJSON,
  createBadRequestResponse
};
