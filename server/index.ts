import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import os from "os";
import fs from "fs";
import { handleDemo } from "./routes/demo";
import {
  handleTextEncrypt,
  handleTextDecrypt,
  handleFileEncrypt,
  handleFileDecrypt,
  handleExtractText,
} from "./routes/crypto";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Static for processed downloads
  const processedDir = path.join(process.cwd(), "public", "processed");
  app.use("/processed", express.static(processedDir));

  // Health/demo
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });
  app.get("/api/demo", handleDemo);

  // Upload handler (disk) for streaming crypto
  const uploadDir = path.join(os.tmpdir(), "cryptex-uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (_req: any, file: any, cb: any) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}-${safe}`);
      },
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // Text encryption/decryption
  app.post("/api/encrypt", handleTextEncrypt);
  app.post("/api/decrypt", handleTextDecrypt);

  // File encryption/decryption (image/video/audio)
  app.post("/api/encrypt-file", upload.single("file"), handleFileEncrypt);
  app.post("/api/decrypt-file", upload.single("file"), handleFileDecrypt);

  // Extract text from documents (pdf/docx/txt)
  app.post("/api/extract-text", upload.single("file"), handleExtractText);

  return app;
}
