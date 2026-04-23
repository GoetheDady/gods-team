export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveKey']
  );
}

// Persist the ECDH key pair across React StrictMode double-mounts and page refreshes
const KEY_STORAGE = 'ecdh_keypair_v1';

export async function getOrCreateKeyPair(): Promise<CryptoKeyPair> {
  try {
    const stored = localStorage.getItem(KEY_STORAGE);
    if (stored) {
      const { pub, priv } = JSON.parse(stored);
      const pubBuf = Uint8Array.from(atob(pub), c => c.charCodeAt(0));
      const privBuf = Uint8Array.from(atob(priv), c => c.charCodeAt(0));
      const publicKey = await crypto.subtle.importKey('spki', pubBuf, { name: 'ECDH', namedCurve: 'P-256' }, true, []);
      const privateKey = await crypto.subtle.importKey('pkcs8', privBuf, { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']);
      return { publicKey, privateKey };
    }
  } catch {
    // fall through to generate new key pair
  }
  const keyPair = await generateKeyPair();
  const pubBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privBuf = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  localStorage.setItem(KEY_STORAGE, JSON.stringify({
    pub: btoa(String.fromCharCode(...new Uint8Array(pubBuf))),
    priv: btoa(String.fromCharCode(...new Uint8Array(privBuf))),
  }));
  return keyPair;
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

function u8ToBase64(buf: Uint8Array): string {
  let s = '';
  for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i]);
  return btoa(s);
}

export async function encrypt(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const cipherbuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    ciphertext: u8ToBase64(new Uint8Array(cipherbuf)),
    iv: u8ToBase64(iv),
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

export async function encryptBinary(data: ArrayBuffer, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipherbuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    ciphertext: u8ToBase64(new Uint8Array(cipherbuf)),
    iv: u8ToBase64(new Uint8Array(iv)),
  };
}

export async function decryptBinary(payload: EncryptedPayload, key: CryptoKey): Promise<ArrayBuffer> {
  const cipherbuf = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherbuf);
}
