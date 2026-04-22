export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    ['deriveKey']
  );
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('spki', publicKey);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importPublicKey(base64: string): Promise<CryptoKey> {
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'spki',
    binary,
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    []
  );
}

export async function deriveSharedKey(
  privateKey: CryptoKey,
  peerPublicKey: CryptoKey
): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: 'ECDH', public: peerPublicKey },
    privateKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function generateAesKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportAesKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importAesKey(base64: string): Promise<CryptoKey> {
  const binary = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey('raw', binary, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
  ]);
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherbuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(cipherbuf))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const cipherbuf = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  const plainbuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherbuf);
  return new TextDecoder().decode(plainbuf);
}

export async function wrapAesKey(
  aesKey: CryptoKey,
  wrappingKey: CryptoKey
): Promise<EncryptedPayload> {
  const keyBase64 = await exportAesKey(aesKey);
  return encrypt(keyBase64, wrappingKey);
}

export async function unwrapAesKey(
  payload: EncryptedPayload,
  wrappingKey: CryptoKey
): Promise<CryptoKey> {
  const keyBase64 = await decrypt(payload, wrappingKey);
  return importAesKey(keyBase64);
}
