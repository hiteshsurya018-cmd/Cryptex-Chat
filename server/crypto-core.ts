import crypto from "crypto";
import fs from "fs";
import fsp from "fs/promises";
import { pipeline } from "stream/promises";

// Utilities for AES-256-GCM with scrypt key derivation
const ALGO = "aes-256-gcm";
export const SALT_LEN = 16; // bytes
export const IV_LEN = 12; // bytes (GCM recommended)
export const TAG_LEN = 16; // bytes

const PBKDF2_ITERS = 120_000;
const PBKDF2_DIGEST = "sha256";

type KdfFn = (password: string, salt: Buffer) => Buffer;

const deriveKeyScrypt: KdfFn = (password, salt) =>
  crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
const deriveKeyPbkdf2: KdfFn = (password, salt) =>
  crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, 32, PBKDF2_DIGEST);

export function encryptBuffer(plain: Buffer, password: string) {
  const salt = crypto.randomBytes(SALT_LEN);
  const key = deriveKeyScrypt(password, salt);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  // payload layout: [salt|iv|tag|ciphertext]
  return Buffer.concat([salt, iv, tag, enc]);
}

function decryptBufferWithKdf(payload: Buffer, password: string, kdf: KdfFn) {
  const salt = payload.subarray(0, SALT_LEN);
  const iv = payload.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = payload.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const data = payload.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = kdf(password, salt);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec;
}

export function decryptBuffer(payload: Buffer, password: string) {
  try {
    return decryptBufferWithKdf(payload, password, deriveKeyScrypt);
  } catch {
    return decryptBufferWithKdf(payload, password, deriveKeyPbkdf2);
  }
}

export async function encryptFileStream(
  inputPath: string,
  outputPath: string,
  password: string,
) {
  const salt = crypto.randomBytes(SALT_LEN);
  const key = deriveKeyScrypt(password, salt);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  // Write placeholder header [salt|iv|tag]
  const header = Buffer.concat([salt, iv, Buffer.alloc(TAG_LEN)]);
  await fsp.writeFile(outputPath, header);

  // Stream file -> cipher -> output (append)
  const inStream = fs.createReadStream(inputPath);
  const outStream = fs.createWriteStream(outputPath, { flags: "a" });
  await pipeline(inStream, cipher, outStream);

  // Patch in auth tag
  const tag = cipher.getAuthTag();
  const fd = await fsp.open(outputPath, "r+");
  try {
    await fd.write(tag, 0, tag.length, SALT_LEN + IV_LEN);
  } finally {
    await fd.close();
  }
}

async function decryptFileStreamWithKdf(
  inputPath: string,
  outputPath: string,
  password: string,
  kdf: KdfFn,
) {
  const headerLen = SALT_LEN + IV_LEN + TAG_LEN;
  const fd = await fsp.open(inputPath, "r");
  let header: Buffer;
  try {
    header = Buffer.alloc(headerLen);
    await fd.read(header, 0, headerLen, 0);
  } finally {
    await fd.close();
  }
  const salt = header.subarray(0, SALT_LEN);
  const iv = header.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = header.subarray(SALT_LEN + IV_LEN, headerLen);
  const key = kdf(password, salt);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);

  const inStream = fs.createReadStream(inputPath, { start: headerLen });
  const outStream = fs.createWriteStream(outputPath, { flags: "w" });
  await pipeline(inStream, decipher, outStream);
}

export async function decryptFileStream(
  inputPath: string,
  outputPath: string,
  password: string,
) {
  try {
    await decryptFileStreamWithKdf(
      inputPath,
      outputPath,
      password,
      deriveKeyScrypt,
    );
  } catch {
    await fsp.unlink(outputPath).catch(() => undefined);
    await decryptFileStreamWithKdf(
      inputPath,
      outputPath,
      password,
      deriveKeyPbkdf2,
    );
  }
}

export async function writeGarbledFile(outputPath: string, size: number) {
  const out = fs.createWriteStream(outputPath, { flags: "w" });
  try {
    let remaining = size;
    while (remaining > 0) {
      const chunkSize = Math.min(1024 * 1024, remaining);
      const buf = crypto.randomBytes(chunkSize);
      if (!out.write(buf)) {
        await new Promise((r) => out.once("drain", r));
      }
      remaining -= chunkSize;
    }
  } finally {
    out.end();
  }
}

export function randomBytes(size: number) {
  return crypto.randomBytes(size);
}
