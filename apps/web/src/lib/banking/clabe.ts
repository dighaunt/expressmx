import 'server-only';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const CIPHER_VERSION = 'v1';

export function normalizarClabe(value: string): string {
  return value.replace(/\D/g, '');
}

export function esClabeValida(value: string): boolean {
  const clabe = normalizarClabe(value);
  if (!/^\d{18}$/.test(clabe)) return false;

  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    sum += (Number(clabe.charAt(i)) * weights[i % 3]!) % 10;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(clabe[17]);
}

export function mascaraClabe(ultimos4: string | null | undefined): string | null {
  if (!ultimos4) return null;
  return `**************${ultimos4}`;
}

export function hashClabe(clabe: string): string {
  return createHash('sha256').update(normalizarClabe(clabe)).digest('hex');
}

export function encryptClabe(clabe: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalizarClabe(clabe), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    CIPHER_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptClabe(ciphertext: string): string {
  const [version, ivRaw, tagRaw, encryptedRaw] = ciphertext.split(':');
  if (version !== CIPHER_VERSION || !ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Formato de CLABE cifrada no soportado');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function encryptionKey(): Buffer {
  const secret = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
  if (!secret || secret.length < 24) {
    throw new Error('BANK_ACCOUNT_ENCRYPTION_KEY debe tener al menos 24 caracteres');
  }
  return createHash('sha256').update(secret).digest();
}
