import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptToken, decryptToken } from '../src/lib/crypto/encryption.ts';

test('crypto: encrypts and decrypts OAuth tokens successfully', () => {
  const secretToken = 'act.tiktok_sample_access_token_1234567890abcdef';
  const encrypted = encryptToken(secretToken);

  assert.notEqual(encrypted, secretToken);
  assert.match(encrypted, /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);

  const decrypted = decryptToken(encrypted);
  assert.equal(decrypted, secretToken);
});

test('crypto: produces randomized initialization vectors (IVs) for same plaintext', () => {
  const token = 'static_refresh_token_value_abc';
  const enc1 = encryptToken(token);
  const enc2 = encryptToken(token);

  assert.notEqual(enc1, enc2);
  assert.equal(decryptToken(enc1), token);
  assert.equal(decryptToken(enc2), token);
});

test('crypto: rejects tampered ciphertext or corrupted auth tag', () => {
  const token = 'valid_token_data';
  const encrypted = encryptToken(token);
  const parts = encrypted.split(':');

  // Tamper with ciphertext guaranteed
  const replacement = parts[2].endsWith('ff') ? '00' : 'ff';
  const tamperedCiphertext = `${parts[0]}:${parts[1]}:${parts[2].slice(0, -2)}${replacement}`;

  assert.throws(
    () => decryptToken(tamperedCiphertext),
    (err: Error) => err.message.length > 0
  );

  // Tamper with auth tag
  const tamperedTag = `${parts[0]}:00000000000000000000000000000000:${parts[2]}`;

  assert.throws(
    () => decryptToken(tamperedTag),
    (err: Error) => err.message.length > 0
  );
});

test('crypto: validates input format and rejects empty values', () => {
  assert.throws(
    () => encryptToken(''),
    (err: Error) => err.message.includes('Cannot encrypt empty')
  );

  assert.throws(
    () => decryptToken('invalid_format_without_colons'),
    (err: Error) => err.message.includes('Invalid encrypted token format')
  );
});
