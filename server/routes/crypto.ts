import type { RequestHandler } from "express";
import crypto from "crypto";

// Utilities for AES-256-GCM with PBKDF2 key derivation
const ALGO = "aes-256-gcm";
const SALT_LEN = 16; // bytes
const IV_LEN = 12; // bytes (GCM recommended)
const TAG_LEN = 16; // bytes
const PBKDF2_ITERS = 120_000;
const PBKDF2_DIGEST = "sha256";

function deriveKey(password: string, salt: Buffer) {
  return crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, 32, PBKDF2_DIGEST);
}

function encryptBuffer(plain: Buffer, password: string) {
  const salt = crypto.randomBytes(SALT_LEN);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  // payload layout: [salt|iv|tag|ciphertext]
  return Buffer.concat([salt, iv, tag, enc]);
}

function decryptBuffer(payload: Buffer, password: string) {
  const salt = payload.subarray(0, SALT_LEN);
  const iv = payload.subarray(SALT_LEN, SALT_LEN + IV_LEN);
  const tag = payload.subarray(SALT_LEN + IV_LEN, SALT_LEN + IV_LEN + TAG_LEN);
  const data = payload.subarray(SALT_LEN + IV_LEN + TAG_LEN);
  const key = deriveKey(password, salt);
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec;
}

export const handleTextEncrypt: RequestHandler = (req, res) => {
  const { data, key } = req.body as { data?: string; key?: string };
  if (!data || !key)
    return res.status(400).json({ error: "Missing data or key" });
  try {
    const out = encryptBuffer(Buffer.from(data, "utf8"), key);
    const base64 = out.toString("base64");
    return res.json({ result: base64 });
  } catch (e) {
    return res.status(500).json({ error: "Encryption failed" });
  }
};

export const handleTextDecrypt: RequestHandler = (req, res) => {
  const { data, key } = req.body as { data?: string; key?: string };
  if (!data || !key)
    return res.status(400).json({ error: "Missing data or key" });
  try {
    const payload = Buffer.from(data, "base64");
    const out = decryptBuffer(payload, key);
    return res.json({ result: out.toString("utf8") });
  } catch (e) {
    // Side-channel resistant behavior: always return plausible-looking garbled text
    const length = Math.min(
      Math.max(Math.floor((data?.length || 32) * 0.6), 16),
      256,
    );
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-={}[]|:;<>,.?/";
    let out = "";
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return res.json({ result: out });
  }
};

export const handleFileEncrypt: RequestHandler = async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  const key = (req.body?.key as string) || "";
  const type = (req.body?.type as string) || "file";
  if (!file || !key)
    return res.status(400).json({ error: "Missing file or key" });
  try {
    const out = encryptBuffer(file.buffer, key);
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "public", "processed");
    await fs.mkdir(dir, { recursive: true });
    const original = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const encName = `${Date.now()}-enc-${original}.enc`;
    const outPath = path.join(dir, encName);
    await fs.writeFile(outPath, out);
    const downloadUrl = `/processed/${encName}`;
    res.json({ type, mode: "encrypt", downloadUrl });
  } catch (e) {
    res.status(500).json({ error: "File encryption failed" });
  }
};

export const handleFileDecrypt: RequestHandler = async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  const key = (req.body?.key as string) || "";
  const type = (req.body?.type as string) || "file";
  if (!file || !key)
    return res.status(400).json({ error: "Missing file or key" });
  try {
    const dec = decryptBuffer(file.buffer, key);
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "public", "processed");
    await fs.mkdir(dir, { recursive: true });
    const cleanOriginal = file.originalname.replace(/\.(enc|bin)$/i, "");
    const safeBase = cleanOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
    const decName = `${Date.now()}-dec-${safeBase}`;
    const outPath = path.join(dir, decName);
    await fs.writeFile(outPath, dec);
    const downloadUrl = `/processed/${decName}`;
    res.json({ type, mode: "decrypt", downloadUrl });
  } catch (e) {
    // On failure, return a garbled file of the same size to avoid revealing key validity
    const fs = await import("fs/promises");
    const path = await import("path");
    const dir = path.join(process.cwd(), "public", "processed");
    await fs.mkdir(dir, { recursive: true });
    const cleanOriginal = file.originalname.replace(/\.(enc|bin)$/i, "");
    const safeBase = cleanOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
    const decName = `${Date.now()}-dec-${safeBase}`;
    const outPath = path.join(dir, decName);
    const size = file.buffer.length;
    const random = crypto.randomBytes(
      Math.max(64, Math.min(size, 1024 * 1024 * 50)),
    );
    await fs.writeFile(outPath, random);
    const downloadUrl = `/processed/${decName}`;
    res.json({ type, mode: "decrypt", downloadUrl });
  }
};
