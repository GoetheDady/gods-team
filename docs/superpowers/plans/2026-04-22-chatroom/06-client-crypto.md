# Task 06: 客户端加密服务

**Files:**
- Create: `client/src/services/crypto.ts`

---

- [ ] **Step 1: 创建 `client/src/services/crypto.ts`**

```typescript
// ECDH P-256 + AES-GCM 256 端对端加密服务

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    false, // 私钥不可导出（extractable: false）
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
  ciphertext: string; // Base64
  iv: string;         // Base64
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

// 用 ECDH 共享密钥包裹 AES 群组密钥（用于大厅密钥分发）
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
```

- [ ] **Step 2: 在浏览器控制台验证加密服务可用**

启动 client（`npm run dev`），打开浏览器控制台，逐行执行：

```javascript
// 在 vite 项目中直接引用模块进行快速验证
const { generateKeyPair, exportPublicKey, deriveSharedKey, encrypt, decrypt } = 
  await import('/src/services/crypto.ts');

const alice = await generateKeyPair();
const bob = await generateKeyPair();

// 双方各自计算共享密钥
const aliceShared = await deriveSharedKey(alice.privateKey, bob.publicKey);
const bobShared = await deriveSharedKey(bob.privateKey, alice.publicKey);

// alice 加密
const payload = await encrypt('Hello, Bob!', aliceShared);
console.log('encrypted:', payload);

// bob 解密
const plaintext = await decrypt(payload, bobShared);
console.log('decrypted:', plaintext); // 期望: "Hello, Bob!"
```

- [ ] **Step 3: 提交**

```bash
git add client/src/services/crypto.ts
git commit -m "feat: add E2EE crypto service (ECDH + AES-GCM)"
```
