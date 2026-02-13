import type { RequestHandler } from "express";
import crypto from "crypto";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { pipeline } from "stream/promises";

// Utilities for AES-256-GCM with scrypt key derivation
const ALGO = "aes-256-gcm";
const SALT_LEN = 16; // bytes
const IV_LEN = 12; // bytes (GCM recommended)
const TAG_LEN = 16; // bytes

const PBKDF2_ITERS = 120_000;
const PBKDF2_DIGEST = "sha256";

type KdfFn = (password: string, salt: Buffer) => Buffer;

const deriveKeyScrypt: KdfFn = (password, salt) =>
  crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
const deriveKeyPbkdf2: KdfFn = (password, salt) =>
  crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, 32, PBKDF2_DIGEST);

function encryptBuffer(plain: Buffer, password: string) {
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

function decryptBuffer(payload: Buffer, password: string) {
  try {
    return decryptBufferWithKdf(payload, password, deriveKeyScrypt);
  } catch {
    return decryptBufferWithKdf(payload, password, deriveKeyPbkdf2);
  }
}

async function encryptFileStream(
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

async function decryptFileStream(
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

async function writeGarbledFile(outputPath: string, size: number) {
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

export const handleExtractText: RequestHandler = async (req, res) => {
  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: "Missing file" });
  const original = file.originalname.toLowerCase();
  const ext = path.extname(original);
  try {
    const buffer = await fsp.readFile(file.path);
    let text = "";
    if (ext === ".pdf" || file.mimetype === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default as any;
      const data = await pdfParse(buffer);
      text = String(data?.text || "");
    } else if (
      ext === ".docx" ||
      file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = (await import("mammoth")).default as any;
      const result = await mammoth.extractRawText({ buffer });
      text = String(result?.value || "");
    } else if (ext === ".txt" || file.mimetype === "text/plain") {
      text = buffer.toString("utf8");
    } else {
      return res.status(415).json({
        error: "Unsupported document type. Use PDF, DOCX, or TXT.",
      });
    }

    const maxChars = 200_000;
    const truncated = text.length > maxChars;
    if (truncated) text = text.slice(0, maxChars);

    res.json({ text, chars: text.length, truncated });
  } catch (e) {
    res.status(500).json({ error: "Text extraction failed" });
  } finally {
    await fsp.unlink(file.path).catch(() => undefined);
  }
};

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
    const dir = path.join(process.cwd(), "public", "processed");
    await fsp.mkdir(dir, { recursive: true });
    const original = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const encName = `${Date.now()}-enc-${original}.enc`;
    const outPath = path.join(dir, encName);
    await encryptFileStream(file.path, outPath, key);
    await fsp.unlink(file.path).catch(() => undefined);
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
    const dir = path.join(process.cwd(), "public", "processed");
    await fsp.mkdir(dir, { recursive: true });
    const cleanOriginal = file.originalname.replace(/\.(enc|bin)$/i, "");
    const safeBase = cleanOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
    const decName = `${Date.now()}-dec-${safeBase}`;
    const outPath = path.join(dir, decName);
    await decryptFileStream(file.path, outPath, key);
    await fsp.unlink(file.path).catch(() => undefined);
    const downloadUrl = `/processed/${decName}`;
    res.json({ type, mode: "decrypt", downloadUrl });
  } catch (e) {
    // On failure, return a garbled file of the same size to avoid revealing key validity
    const dir = path.join(process.cwd(), "public", "processed");
    await fsp.mkdir(dir, { recursive: true });
    const cleanOriginal = file.originalname.replace(/\.(enc|bin)$/i, "");
    const safeBase = cleanOriginal.replace(/[^a-zA-Z0-9._-]/g, "_");
    const decName = `${Date.now()}-dec-${safeBase}`;
    const outPath = path.join(dir, decName);
    const stat = await fsp.stat(file.path).catch(() => undefined);
    const size = stat ? Math.max(0, stat.size - (SALT_LEN + IV_LEN + TAG_LEN)) : 64;
    await writeGarbledFile(outPath, size);
    await fsp.unlink(file.path).catch(() => undefined);
    const downloadUrl = `/processed/${decName}`;
    res.json({ type, mode: "decrypt", downloadUrl });
  }
};
