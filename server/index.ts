import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import multer from "multer";
import { handleDemo } from "./routes/demo";
import {
  handleTextEncrypt,
  handleTextDecrypt,
  handleFileEncrypt,
  handleFileDecrypt,
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

  // Upload handler (memory)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  });

  // Text encryption/decryption
  app.post("/api/encrypt", handleTextEncrypt);
  app.post("/api/decrypt", handleTextDecrypt);
  app.post("/encrypt", handleTextEncrypt);
  app.post("/decrypt", handleTextDecrypt);

  // File encryption/decryption (image/video/audio)
  app.post("/api/encrypt-file", upload.single("file"), handleFileEncrypt);
  app.post("/api/decrypt-file", upload.single("file"), handleFileDecrypt);
  app.post("/encrypt-file", upload.single("file"), handleFileEncrypt);
  app.post("/decrypt-file", upload.single("file"), handleFileDecrypt);

  return app;
}
