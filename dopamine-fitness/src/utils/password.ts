// ─── Password hashing using Web Crypto API (PBKDF2) ──────────────────────────
// No bcrypt — it's not available in Workers. PBKDF2 with SHA-256 is secure.

const ITERATIONS = 100_000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const key = await deriveKey(password, salt);
  const saltHex = toHex(salt);
  const keyHex = toHex(new Uint8Array(key));
  return `${saltHex}:${keyHex}`;
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const [saltHex, keyHex] = hash.split(":");
  if (!saltHex || !keyHex) return false;

  const salt = fromHex(saltHex);
  const derivedKey = await deriveKey(password, salt);
  const derivedHex = toHex(new Uint8Array(derivedKey));

  // Constant-time comparison
  return timingSafeEqual(derivedHex, keyHex);
}

async function deriveKey(
  password: string,
  salt: Uint8Array
): Promise<ArrayBuffer> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    KEY_LENGTH * 8
  );
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
