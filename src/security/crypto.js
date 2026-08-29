/**
 * AntiGravity Duo — Zero-Knowledge Cryptography Engine
 * Pure Client-Side End-to-End Encryption (AES-GCM-256 & PBKDF2)
 * Web Crypto API (Hardware-Accelerated SubtleCrypto)
 */

export class CryptoEngine {
  constructor() {
    this.crypto = window.crypto || window.msCrypto;
    this.subtle = this.crypto.subtle;
    this.activeKey = null;
    this.spaceId = null;
  }

  /**
   * Generates a random alphanumeric Space ID for a couple
   */
  generateSpaceId() {
    const prefixes = ['AG-ORBIT', 'AG-COSMOS', 'AG-GRAVITI', 'AG-NEBULA', 'AG-SOLAR'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${randomHex}${randomNum}`;
  }

  /**
   * Generates a random high-entropy Passphrase / Secret Key
   */
  generatePassphrase() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    let result = '';
    const randomValues = new Uint8Array(18);
    this.crypto.getRandomValues(randomValues);
    for (let i = 0; i < 18; i++) {
      result += chars[randomValues[i] % chars.length];
    }
    return result;
  }

  /**
   * Derives a 256-bit AES-GCM encryption key from user Passphrase + Space ID salt
   */
  async deriveKey(passphrase, spaceId) {
    const enc = new TextEncoder();
    const keyMaterial = await this.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = enc.encode(`AntiGravity-Duo-Salt-${spaceId}`);

    const key = await this.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    this.activeKey = key;
    this.spaceId = spaceId;
    return key;
  }

  /**
   * Encrypts a plaintext string with AES-GCM-256
   */
  async encryptText(plainText) {
    if (!this.activeKey) throw new Error('Crypto key not initialized');
    const enc = new TextEncoder();
    const encoded = enc.encode(plainText);

    // 96-bit random initialization vector
    const iv = this.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await this.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.activeKey,
      encoded
    );

    return {
      iv: this.arrayBufferToBase64(iv),
      data: this.arrayBufferToBase64(ciphertext),
      timestamp: Date.now()
    };
  }

  /**
   * Decrypts ciphertext back to string
   */
  async decryptText(payload) {
    if (!this.activeKey) throw new Error('Crypto key not initialized');
    const iv = this.base64ToArrayBuffer(payload.iv);
    const ciphertext = this.base64ToArrayBuffer(payload.data);

    const decrypted = await this.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      this.activeKey,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted);
  }

  /**
   * Encrypts binary data (Blob, File, Audio, Video)
   */
  async encryptBinary(blob) {
    if (!this.activeKey) throw new Error('Crypto key not initialized');
    const arrayBuffer = await blob.arrayBuffer();
    const iv = this.crypto.getRandomValues(new Uint8Array(12));

    const ciphertext = await this.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.activeKey,
      arrayBuffer
    );

    return {
      iv: this.arrayBufferToBase64(iv),
      data: this.arrayBufferToBase64(ciphertext),
      mimeType: blob.type,
      size: blob.size,
      timestamp: Date.now()
    };
  }

  /**
   * Decrypts binary payload and returns a Blob
   */
  async decryptBinary(payload) {
    if (!this.activeKey) throw new Error('Crypto key not initialized');
    const iv = this.base64ToArrayBuffer(payload.iv);
    const ciphertext = this.base64ToArrayBuffer(payload.data);

    const decrypted = await this.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      this.activeKey,
      ciphertext
    );

    return new Blob([decrypted], { type: payload.mimeType || 'application/octet-stream' });
  }

  // Helpers
  arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary_string = window.atob(base64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const cryptoEngine = new CryptoEngine();
