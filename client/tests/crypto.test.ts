import { describe, it, expect } from 'vitest';
import {
  generateKeyPair,
  exportPublicKey,
  importPublicKey,
  deriveSharedKey,
  generateAesKey,
  exportAesKey,
  importAesKey,
  encrypt,
  decrypt,
  encryptBinary,
  decryptBinary,
  wrapAesKey,
  unwrapAesKey,
} from '../src/services/crypto';

describe('generateKeyPair', () => {
  it('生成的密钥对包含 publicKey 和 privateKey', async () => {
    const pair = await generateKeyPair();
    expect(pair.publicKey).toBeTruthy();
    expect(pair.privateKey).toBeTruthy();
  });

  it('私钥不可导出（extractable 为 false）', async () => {
    const pair = await generateKeyPair();
    await expect(
      crypto.subtle.exportKey('pkcs8', pair.privateKey)
    ).rejects.toThrow();
  });
});

describe('exportPublicKey / importPublicKey', () => {
  it('导出再导入的公钥与原始公钥等价（可用于加密相同内容）', async () => {
    const pair = await generateKeyPair();
    const exported = await exportPublicKey(pair.publicKey);
    const imported = await importPublicKey(exported);

    const otherPair = await generateKeyPair();
    const key1 = await deriveSharedKey(otherPair.privateKey, pair.publicKey);
    const key2 = await deriveSharedKey(otherPair.privateKey, imported);

    const payload = await encrypt('test', key1);
    const decrypted = await decrypt(payload, key2);
    expect(decrypted).toBe('test');
  });

  it('导出的公钥是合法的 Base64 字符串', async () => {
    const pair = await generateKeyPair();
    const exported = await exportPublicKey(pair.publicKey);
    expect(() => atob(exported)).not.toThrow();
    expect(exported.length).toBeGreaterThan(50);
  });
});

describe('deriveSharedKey', () => {
  it('Alice 和 Bob 用对方公钥各自推导出相同的共享密钥', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();

    const aliceShared = await deriveSharedKey(alice.privateKey, bob.publicKey);
    const bobShared = await deriveSharedKey(bob.privateKey, alice.publicKey);

    const payload = await encrypt('秘密消息', aliceShared);
    const result = await decrypt(payload, bobShared);
    expect(result).toBe('秘密消息');
  });

  it('不同用户对无法解密彼此的消息', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const charlie = await generateKeyPair();

    const aliceBobKey = await deriveSharedKey(alice.privateKey, bob.publicKey);
    const aliceCharlieKey = await deriveSharedKey(alice.privateKey, charlie.publicKey);

    const payload = await encrypt('仅限 Bob', aliceBobKey);
    await expect(decrypt(payload, aliceCharlieKey)).rejects.toThrow();
  });
});

describe('encrypt / decrypt', () => {
  it('加密后再解密得到原始明文', async () => {
    const key = await generateAesKey();
    const plaintext = '你好，江湖！';

    const payload = await encrypt(plaintext, key);
    const result = await decrypt(payload, key);

    expect(result).toBe(plaintext);
  });

  it('每次加密生成不同的 IV，密文不同', async () => {
    const key = await generateAesKey();
    const p1 = await encrypt('same', key);
    const p2 = await encrypt('same', key);

    expect(p1.iv).not.toBe(p2.iv);
    expect(p1.ciphertext).not.toBe(p2.ciphertext);
  });

  it('篡改密文后解密失败', async () => {
    const key = await generateAesKey();
    const payload = await encrypt('原始内容', key);

    const tampered = {
      ...payload,
      ciphertext: payload.ciphertext.slice(0, -1) + 'X',
    };

    await expect(decrypt(tampered, key)).rejects.toThrow();
  });

  it('篡改 IV 后解密失败', async () => {
    const key = await generateAesKey();
    const payload = await encrypt('原始内容', key);

    const tampered = {
      ...payload,
      iv: btoa('000000000000'),
    };

    await expect(decrypt(tampered, key)).rejects.toThrow();
  });

  it('可加密包含特殊字符和 emoji 的内容', async () => {
    const key = await generateAesKey();
    const text = '行走江湖 🗡️ special chars: <>&"\'';

    const payload = await encrypt(text, key);
    const result = await decrypt(payload, key);

    expect(result).toBe(text);
  });
});

describe('wrapAesKey / unwrapAesKey', () => {
  it('用 ECDH 共享密钥包裹并还原 AES 群组密钥', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();

    const aliceShared = await deriveSharedKey(alice.privateKey, bob.publicKey);
    const bobShared = await deriveSharedKey(bob.privateKey, alice.publicKey);

    const hallKey = await generateAesKey();
    const wrapped = await wrapAesKey(hallKey, aliceShared);

    const restoredKey = await unwrapAesKey(wrapped, bobShared);

    const payload = await encrypt('大厅消息', hallKey);
    const result = await decrypt(payload, restoredKey);
    expect(result).toBe('大厅消息');
  });

  it('用错误的共享密钥无法解包', async () => {
    const alice = await generateKeyPair();
    const bob = await generateKeyPair();
    const charlie = await generateKeyPair();

    const aliceBobKey = await deriveSharedKey(alice.privateKey, bob.publicKey);
    const aliceCharlieKey = await deriveSharedKey(alice.privateKey, charlie.publicKey);

    const hallKey = await generateAesKey();
    const wrapped = await wrapAesKey(hallKey, aliceBobKey);

    await expect(unwrapAesKey(wrapped, aliceCharlieKey)).rejects.toThrow();
  });
});

describe('generateAesKey / exportAesKey / importAesKey', () => {
  it('导出再导入的 AES 密钥可用于解密原密钥加密的内容', async () => {
    const key = await generateAesKey();
    const exported = await exportAesKey(key);
    const imported = await importAesKey(exported);

    const payload = await encrypt('test', key);
    const result = await decrypt(payload, imported);
    expect(result).toBe('test');
  });
});

describe('encryptBinary / decryptBinary', () => {
  it('encrypts and decrypts binary data', async () => {
    const key = await generateAesKey();
    const original = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const encrypted = await encryptBinary(original.buffer as ArrayBuffer, key);
    const decrypted = await decryptBinary(encrypted, key);
    expect(new Uint8Array(decrypted)).toEqual(original);
  });
});
