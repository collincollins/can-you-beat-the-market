// __tests__/sanitize.test.js
// Tests for input sanitization utilities

const { sanitizeHTML, validatePlayerName, validateScore, validateUserId } = require('../netlify/functions/utils/sanitize');

describe('sanitizeHTML', () => {
  test('Removes script tags', () => {
    const input = '<script>alert("XSS")</script>Hello';
    const result = sanitizeHTML(input);
    expect(result).toBe('Hello');
    expect(result).not.toContain('<script>');
  });

  test('Removes img tags with onerror', () => {
    const input = '<img src=x onerror="alert(1)">Test';
    const result = sanitizeHTML(input);
    expect(result).toBe('Test');
    expect(result).not.toContain('<img');
    expect(result).not.toContain('onerror');
  });

  test('Removes event handlers', () => {
    const input = '<div onclick="malicious()">Click</div>';
    const result = sanitizeHTML(input);
    expect(result).toBe('Click');
    expect(result).not.toContain('onclick');
  });

  test('Removes javascript: protocol', () => {
    const input = '<a href="javascript:alert(1)">Link</a>';
    const result = sanitizeHTML(input);
    expect(result).not.toContain('javascript:');
  });

  test('Removes all HTML tags', () => {
    const input = '<b>Bold</b> <i>Italic</i> <u>Underline</u>';
    const result = sanitizeHTML(input);
    expect(result).toBe('Bold Italic Underline');
  });

  test('Handles plain text without modification', () => {
    const input = 'Just plain text';
    const result = sanitizeHTML(input);
    expect(result).toBe('Just plain text');
  });

  test('Handles Unicode characters', () => {
    const input = '你好世界🎮💯';
    const result = sanitizeHTML(input);
    expect(result).toBe('你好世界🎮💯');
  });

  test('Returns empty string for non-string input', () => {
    expect(sanitizeHTML(null)).toBe('');
    expect(sanitizeHTML(undefined)).toBe('');
    expect(sanitizeHTML(123)).toBe('');
  });
});

describe('validatePlayerName', () => {
  test('Accepts valid player name', () => {
    const result = validatePlayerName('ProGamer123');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('ProGamer123');
  });

  test('Rejects empty string', () => {
    const result = validatePlayerName('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  test('Rejects whitespace-only string', () => {
    const result = validatePlayerName('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('empty');
  });

  test('Rejects non-string input', () => {
    const result = validatePlayerName(123);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('string');
  });

  test('Rejects name longer than 50 characters', () => {
    const longName = 'A'.repeat(51);
    const result = validatePlayerName(longName);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('50 characters');
  });

  test('Accepts name exactly 50 characters', () => {
    const name = 'A'.repeat(50);
    const result = validatePlayerName(name);
    expect(result.valid).toBe(true);
  });

  test('Sanitizes XSS attempt', () => {
    const malicious = '<script>alert("XSS")</script>GoodName';
    const result = validatePlayerName(malicious);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('GoodName');
    expect(result.sanitized).not.toContain('<script>');
  });

  test('Rejects name that becomes empty after sanitization', () => {
    const malicious = '<script>alert(1)</script>';
    const result = validatePlayerName(malicious);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });

  test('Trims whitespace', () => {
    const result = validatePlayerName('  SpacedName  ');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('SpacedName');
  });

  test('Rejects null bytes', () => {
    const malicious = 'Test\x00Hidden';
    const result = validatePlayerName(malicious);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('invalid characters');
  });

  test('Accepts Unicode characters', () => {
    const result = validatePlayerName('你好世界🎮');
    expect(result.valid).toBe(true);
    expect(result.sanitized).toBe('你好世界🎮');
  });
});

describe('validateScore', () => {
  test('Accepts valid score', () => {
    const result = validateScore(42);
    expect(result.valid).toBe(true);
  });

  test('Accepts zero', () => {
    const result = validateScore(0);
    expect(result.valid).toBe(true);
  });

  test('Rejects negative score', () => {
    const result = validateScore(-10);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('negative');
  });

  test('Rejects NaN', () => {
    const result = validateScore(NaN);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('NaN');
  });

  test('Rejects Infinity', () => {
    const result = validateScore(Infinity);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('finite');
  });

  test('Rejects -Infinity', () => {
    const result = validateScore(-Infinity);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('finite');
  });

  test('Rejects non-number', () => {
    const result = validateScore("42");
    expect(result.valid).toBe(false);
    expect(result.error).toContain('number');
  });

  test('Rejects float', () => {
    const result = validateScore(42.5);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('integer');
  });

  test('Rejects score exceeding maximum', () => {
    const result = validateScore(2000000);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('maximum');
  });

  test('Accepts score at maximum', () => {
    const result = validateScore(1000000);
    expect(result.valid).toBe(true);
  });

  test('Accepts MAX_SAFE_INTEGER if under limit', () => {
    const result = validateScore(999999);
    expect(result.valid).toBe(true);
  });
});

describe('validateUserId', () => {
  test('Accepts valid UUID v4', () => {
    const result = validateUserId('123e4567-e89b-12d3-a456-426614174000');
    expect(result.valid).toBe(true);
  });

  test('Rejects empty string', () => {
    const result = validateUserId('');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  test('Rejects null', () => {
    const result = validateUserId(null);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  test('Rejects undefined', () => {
    const result = validateUserId(undefined);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('required');
  });

  test('Rejects non-string', () => {
    const result = validateUserId(12345);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('string');
  });

  test('Rejects invalid UUID format', () => {
    const result = validateUserId('not-a-uuid');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid user ID format');
  });

  test('Rejects UUID with wrong number of segments', () => {
    const result = validateUserId('123e4567-e89b-12d3-a456');
    expect(result.valid).toBe(false);
  });

  test('Rejects UUID with invalid characters', () => {
    const result = validateUserId('123e4567-e89b-12d3-a456-42661417400g');
    expect(result.valid).toBe(false);
  });

  test('Accepts uppercase UUID', () => {
    const result = validateUserId('123E4567-E89B-12D3-A456-426614174000');
    expect(result.valid).toBe(true);
  });

  test('Accepts lowercase UUID', () => {
    const result = validateUserId('123e4567-e89b-12d3-a456-426614174000');
    expect(result.valid).toBe(true);
  });
});
