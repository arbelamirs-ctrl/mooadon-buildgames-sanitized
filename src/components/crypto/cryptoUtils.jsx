// Browser-safe crypto utilities using Web Crypto API

const ENCRYPTION_KEY = 'V459@rf3';

// Convert hex string to Uint8Array
function hexToUint8Array(hexString) {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substr(i, 2), 16);
  }
  return bytes;
}

// Convert Uint8Array to hex string
function uint8ArrayToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 hash using Web Crypto API
async function sha256(message) {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
}

// Decrypt private key using Web Crypto API
export async function decryptPrivateKey(encryptedData, encryptionKey = ENCRYPTION_KEY) {
  try {
    const [ivHex, encryptedHex] = encryptedData.split(':');
    const iv = hexToUint8Array(ivHex);
    const encrypted = hexToUint8Array(encryptedHex);
    const keyHash = await sha256(encryptionKey);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyHash, { name: 'AES-CBC' }, false, ['decrypt']
    );
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv }, cryptoKey, encrypted
    );
    
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt: ' + error.message);
  }
}