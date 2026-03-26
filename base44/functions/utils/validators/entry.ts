/**
 * Validation utilities for backend functions
 */

/**
 * Normalize phone number to E.164 format
 * @param {string} phone - Raw phone number
 * @returns {string} - E.164 formatted phone (+972501234567)
 */
export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;

  // Remove all non-digit characters except leading +
  let digits = phone.replace(/[^\d+]/g, '');

  // If starts with +, strip it and work with digits only
  if (digits.startsWith('+')) {
    digits = digits.substring(1);
  }

  // Already in international format with country code 972
  if (digits.startsWith('972')) {
    return '+' + digits;
  }

  // Local Israeli format: 05X (10 digits starting with 0)
  if (digits.startsWith('0') && digits.length === 10) {
    return '+972' + digits.substring(1);
  }

  // 9-digit Israeli number without leading 0 (e.g. 5XXXXXXXX)
  if (digits.length === 9 && digits.startsWith('5')) {
    return '+972' + digits;
  }

  // Other international numbers
  if (digits.length >= 10) {
    return '+' + digits;
  }

  return null;
}

/**
 * Normalize and validate numerical amount
 * @param {unknown} value - Value to normalize
 * @returns {number} - Valid number or throws error
 */
export function normalizeAmount(value) {
  if (value === null || value === undefined) {
    throw new Error('Amount is required');
  }
  
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  
  if (isNaN(num)) {
    throw new Error('Invalid amount: must be a number');
  }
  
  if (!isFinite(num)) {
    throw new Error('Invalid amount: must be finite');
  }
  
  if (num < 0) {
    throw new Error('Invalid amount: must be non-negative');
  }
  
  return num;
}

/**
 * Validate that required fields exist in an object
 * @param {object} body - Request body or object to validate
 * @param {string[]} fields - Array of required field names
 * @returns {boolean} - True if valid
 * @throws {Error} - If validation fails
 */
export function validateRequiredFields(body, fields) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }
  
  const missing = [];
  
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      missing.push(field);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
  
  return true;
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate wallet address for specific blockchain
 * @param {string} address - Wallet address
 * @param {string} chain - Blockchain type (avalanche, ethereum, solana, bitcoin)
 * @returns {boolean}
 */
export function isValidWalletAddress(address, chain = 'avalanche') {
  if (!address || typeof address !== 'string') return false;
  
  switch (chain.toLowerCase()) {
    case 'avalanche':
    case 'ethereum':
    case 'polygon':
    case 'bsc':
    case 'base':
      // EVM addresses: 0x + 40 hex chars
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    
    case 'solana':
      // Solana addresses: 32-44 base58 chars
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    
    case 'bitcoin':
      // Bitcoin addresses: various formats
      return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
    
    default:
      return false;
  }
}

/**
 * Validate and parse JSON
 * @param {string} jsonString - JSON string to parse
 * @returns {object|null} - Parsed object or null if invalid
 */
export function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

/**
 * Validate date string
 * @param {string} dateString - Date string to validate
 * @returns {boolean}
 */
export function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Sanitize string input to prevent injection attacks
 * @param {string} input - String to sanitize
 * @returns {string}
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>\"']/g, '');
}