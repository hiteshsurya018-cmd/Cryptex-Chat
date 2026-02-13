import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "../index";
import type { Server } from "http";
import path from "path";
import os from "os";
import fs from "fs/promises";
import crypto from "crypto";

const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const PBKDF2_ITERS = 120_000;
const PBKDF2_DIGEST = "sha256";

function pbkdf2Encrypt(plain: Buffer, password: string) {
  const salt = crypto.randomBytes(SALT_LEN);
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERS, 32, PBKDF2_DIGEST);
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, enc]);
}

async function startServer() {
  const app = createServer();
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") {
    throw new Error("Failed to start server");
  }
  const base = `http://127.0.0.1:${addr.port}`;
  return { server, base };
}

describe("crypto api", () => {
  let server: Server;
  let base: string;
  const createdFiles: string[] = [];
  const processedDir = path.join(process.cwd(), "public", "processed");

  beforeAll(async () => {
    const started = await startServer();
    server = started.server;
    base = started.base;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const name of createdFiles) {
      await fs.unlink(path.join(processedDir, name)).catch(() => undefined);
    }
  });

  it("encrypts and decrypts text", async () => {
    const key = "super-secret";
    const msg = "hello world";
    const encRes = await fetch(`${base}/api/encrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "text", mode: "encrypt", data: msg, key }),
    });
    expect(encRes.ok).toBe(true);
    const encJson = await encRes.json();
    const enc = encJson.result as string;

    const decRes = await fetch(`${base}/api/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "text", mode: "decrypt", data: enc, key }),
    });
    expect(decRes.ok).toBe(true);
    const decJson = await decRes.json();
    expect(decJson.result).toBe(msg);
  });

  it("rejects wrong key with non-matching text", async () => {
    const key = "correct";
    const msg = "sensitive data";
    const encRes = await fetch(`${base}/api/encrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "text", mode: "encrypt", data: msg, key }),
    });
    const enc = (await encRes.json()).result as string;

    const decRes = await fetch(`${base}/api/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "text",
        mode: "decrypt",
        data: enc,
        key: "wrong",
      }),
    });
    const dec = (await decRes.json()).result as string;
    expect(dec).not.toBe(msg);
  });

  it("decrypts legacy PBKDF2 text payloads", async () => {
    const key = "legacy-key";
    const msg = "legacy payload";
    const payload = pbkdf2Encrypt(Buffer.from(msg, "utf8"), key).toString(
      "base64",
    );

    const decRes = await fetch(`${base}/api/decrypt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "text",
        mode: "decrypt",
        data: payload,
        key,
      }),
    });
    const dec = (await decRes.json()).result as string;
    expect(dec).toBe(msg);
  });

  it("encrypts and decrypts files via streaming", async () => {
    const key = "file-key";
    const original = Buffer.from("file content");
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cryptex-test-"));
    const tmpPath = path.join(tmpDir, "sample.txt");
    await fs.writeFile(tmpPath, original);

    const fd = new FormData();
    fd.set("type", "file");
    fd.set("mode", "encrypt");
    fd.set("key", key);
    fd.set("file", new Blob([original]), "sample.txt");

    const encRes = await fetch(`${base}/api/encrypt-file`, {
      method: "POST",
      body: fd,
    });
    expect(encRes.ok).toBe(true);
    const encJson = await encRes.json();
    const encUrl = encJson.downloadUrl as string;
    const encName = path.basename(encUrl);
    createdFiles.push(encName);

    const encFetch = await fetch(`${base}${encUrl}`);
    const encBuf = Buffer.from(await encFetch.arrayBuffer());

    const fd2 = new FormData();
    fd2.set("type", "file");
    fd2.set("mode", "decrypt");
    fd2.set("key", key);
    fd2.set("file", new Blob([encBuf]), "sample.txt.enc");

    const decRes = await fetch(`${base}/api/decrypt-file`, {
      method: "POST",
      body: fd2,
    });
    expect(decRes.ok).toBe(true);
    const decJson = await decRes.json();
    const decUrl = decJson.downloadUrl as string;
    const decName = path.basename(decUrl);
    createdFiles.push(decName);

    const decFetch = await fetch(`${base}${decUrl}`);
    const decBuf = Buffer.from(await decFetch.arrayBuffer());
    expect(decBuf.toString("utf8")).toBe(original.toString("utf8"));
  });
});
