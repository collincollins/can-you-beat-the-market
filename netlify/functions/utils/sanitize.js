// netlify/functions/utils/sanitize.js
// Utility functions for input sanitization and validation

/**
 * Sanitizes HTML by removing all HTML tags and dangerous characters
 * @param {string} input - The input string to sanitize
 * @returns {string} Sanitized string safe for display
 */
function sanitizeHTML(input) {
  if (typeof input !== 'string') {
    return '';
  }

  let sanitized = input;

  // Remove script tags and their content first (case insensitive, multiline)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gis, '');

  // Remove all HTML tags (including self-closing ones)
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // Remove event handler attributes that might be left
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');

  // Remove dangerous protocols
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  sanitized = sanitized.replace(/vbscript:/gi, '');

  // Decode HTML entities that could be used for evasion
  sanitized = sanitized
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&amp;/gi, '&');

  // Remove any tags that were entity-encoded
  sanitized = sanitized.replace(/<[^>]+>/g, '');

  // Final trim
  return sanitized.trim();
}

/**
 * Validates player name meets all requirements
 * @param {string} playerName - The player name to validate
 * @returns {{valid: boolean, error?: string, sanitized?: string}}
 */
function validatePlayerName(playerName) {
  // Type check
  if (typeof playerName !== 'string') {
    return { valid: false, error: 'Player name must be a string' };
  }

  // Trim whitespace
  const trimmed = playerName.trim();

  // Empty check
  if (trimmed === '') {
    return { valid: false, error: 'Player name cannot be empty' };
  }

  // Max length check (prevent DoS)
  const MAX_LENGTH = 50;
  if (trimmed.length > MAX_LENGTH) {
    return {
      valid: false,
      error: `Player name must be ${MAX_LENGTH} characters or less`
    };
  }

  // Sanitize HTML
  const sanitized = sanitizeHTML(trimmed);

  // Check if sanitization removed everything
  if (sanitized === '') {
    return {
      valid: false,
      error: 'Player name contains only invalid characters'
    };
  }

  // Check for null bytes
  if (sanitized.includes('\x00')) {
    return { valid: false, error: 'Player name contains invalid characters' };
  }

  return { valid: true, sanitized };
}

/**
 * Validates score value
 * @param {*} score - The score to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateScore(score) {
  // Type check
  if (typeof score !== 'number') {
    return { valid: false, error: 'Score must be a number' };
  }

  // NaN check
  if (isNaN(score)) {
    return { valid: false, error: 'Score cannot be NaN' };
  }

  // Infinity check
  if (!isFinite(score)) {
    return { valid: false, error: 'Score must be finite' };
  }

  // Negative check
  if (score < 0) {
    return { valid: false, error: 'Score cannot be negative' };
  }

  // Integer check
  if (!Number.isInteger(score)) {
    return { valid: false, error: 'Score must be an integer' };
  }

  // Reasonable maximum check
  const MAX_SCORE = 1000000; // 1 million wins is unrealistic
  if (score > MAX_SCORE) {
    return { valid: false, error: 'Score exceeds maximum allowed value' };
  }

  return { valid: true };
}

/**
 * Validates userId format
 * @param {*} userId - The userId to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateUserId(userId) {
  // Required check
  if (!userId) {
    return { valid: false, error: 'User ID is required' };
  }

  // Type check
  if (typeof userId !== 'string') {
    return { valid: false, error: 'User ID must be a string' };
  }

  // UUID format check (standard v4 UUID format)
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(userId)) {
    return { valid: false, error: 'Invalid user ID format' };
  }

  return { valid: true };
}

module.exports = {
  sanitizeHTML,
  validatePlayerName,
  validateScore,
  validateUserId
};
