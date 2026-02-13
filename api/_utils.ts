import type { IncomingMessage, ServerResponse } from "http";
import Busboy from "busboy";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const MAX_UPLOAD_BYTES = Number(
  process.env.MAX_UPLOAD_BYTES || 4 * 1024 * 1024,
);

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(data);
}

export async function readJsonBody<T = any>(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buf);
    size += buf.length;
    if (size > MAX_UPLOAD_BYTES) {
      throw new HttpError(413, "Payload too large");
    }
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

type MultipartFile = {
  buffer: Buffer;
  filename: string;
  mime: string;
};

export async function parseMultipart(
  req: IncomingMessage,
): Promise<{ fields: Record<string, string>; file?: MultipartFile }> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    let fileData: MultipartFile | undefined;
    let fileTooLarge = false;

    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_UPLOAD_BYTES },
    });

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("file", (_name, stream, info) => {
      const { filename, mimeType } = info;
      const chunks: Buffer[] = [];
      stream.on("data", (d: Buffer) => {
        chunks.push(d);
      });
      stream.on("limit", () => {
        fileTooLarge = true;
        stream.resume();
      });
      stream.on("end", () => {
        if (!fileTooLarge) {
          fileData = {
            buffer: Buffer.concat(chunks),
            filename: filename || "upload.bin",
            mime: mimeType || "application/octet-stream",
          };
        }
      });
    });

    bb.on("error", (err) => reject(err));
    bb.on("close", () => {
      if (fileTooLarge) {
        reject(new HttpError(413, "File too large"));
        return;
      }
      resolve({ fields, file: fileData });
    });

    req.pipe(bb);
  });
}

export function sanitizeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
