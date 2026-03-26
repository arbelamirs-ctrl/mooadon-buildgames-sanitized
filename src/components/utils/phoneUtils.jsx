/**
 * Phone Normalization Utility
 * Single source of truth for phone number handling
 * 
 * USAGE:
 * import { normalizePhone, validatePhone, formatPhoneDisplay } from '@/components/utils/phoneUtils';
 */

export function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;

  let digits = phone.replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) {
    digits = digits.substring(1);
  }

  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 10) return '+972' + digits.substring(1);
  if (digits.length === 9 && digits.startsWith('5')) return '+972' + digits;
  if (digits.length >= 10) return '+' + digits;

  return null;
}

export function validatePhone(phone) {
  if (!phone) return false;
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  return /^\+9725[0-9]{8}$/.test(normalized);
}

export function formatPhoneDisplay(phone) {
  if (!phone) return '';
  const normalized = normalizePhone(phone);
  if (!normalized) return phone;

  if (normalized.startsWith('+972')) {
    const local = '0' + normalized.substring(4);
    if (local.length === 10) {
      return `${local.substring(0, 3)}-${local.substring(3, 6)}-${local.substring(6)}`;
    }
    return local;
  }

  return phone;
}

export function formatPhoneWhatsApp(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `whatsapp:${normalized}`;
}

export function getCountryCode(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;

  const digits = normalized.substring(1);
  const countryCodes = ['972', '1', '44', '49', '33', '39', '34', '81', '86'];

  for (const code of countryCodes) {
    if (digits.startsWith(code)) return code;
  }

  return null;
}

export default {
  normalizePhone,
  validatePhone,
  formatPhoneDisplay,
  formatPhoneWhatsApp,
  getCountryCode
};