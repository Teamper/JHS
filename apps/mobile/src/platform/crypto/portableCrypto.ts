import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync, CryptoDigestAlgorithm, digest, getRandomValues, randomUUID } from 'expo-crypto';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

function bytes(value: BufferSource) {
  return value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
}

export function installPortableCrypto() {
  if (globalThis.crypto?.subtle) return;
  // The shared credential codec supplies these parameters and owns the wire format.
  const subtle = {
    async importKey(format: string, material: BufferSource, algorithm: string) {
      if (format !== 'raw' || algorithm !== 'PBKDF2') throw new Error('不支持的密钥格式。');
      return bytes(material).slice();
    },
    async deriveKey(algorithm: Pbkdf2Params, material: Uint8Array, target: AesDerivedKeyParams) {
      if (algorithm.name !== 'PBKDF2' || algorithm.hash !== 'SHA-256' || target.name !== 'AES-GCM' || target.length !== 256) {
        throw new Error('不支持的密钥派生算法。');
      }
      const key = await pbkdf2Async(sha256, material, bytes(algorithm.salt), { c: algorithm.iterations, dkLen: 32 });
      return AESEncryptionKey.import(key);
    },
    async encrypt(options: AesGcmParams, key: AESEncryptionKey, value: BufferSource) {
      if (options.name !== 'AES-GCM') throw new Error('不支持的加密算法。');
      const sealed = await aesEncryptAsync(bytes(value), key, { nonce: { bytes: bytes(options.iv) } });
      return (await sealed.ciphertext({ includeTag: true })).slice().buffer;
    },
    async decrypt(options: AesGcmParams, key: AESEncryptionKey, value: BufferSource) {
      if (options.name !== 'AES-GCM') throw new Error('不支持的解密算法。');
      return (await aesDecryptAsync(AESSealedData.fromParts(bytes(options.iv), bytes(value)), key)).slice().buffer;
    },
    digest(algorithm: CryptoDigestAlgorithm, value: BufferSource) { return digest(algorithm, value); },
  };
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID, getRandomValues, subtle } });
}
