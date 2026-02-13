import type { RequestHandler } from "express";
import fsp from "fs/promises";
import path from "path";
import {
  SALT_LEN,
  IV_LEN,
  TAG_LEN,
  encryptBuffer,
  decryptBuffer,
  encryptFileStream,
  decryptFileStream,
  writeGarbledFile,
} from "../crypto-core";

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
