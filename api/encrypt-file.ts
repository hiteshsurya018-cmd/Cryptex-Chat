import type { IncomingMessage, ServerResponse } from "http";
import { encryptBuffer } from "../server/crypto-core";
import {
  HttpError,
  parseMultipart,
  sanitizeFilename,
  sendJson,
} from "./_utils";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Allow", "POST");
      return res.end();
    }

    const { fields, file } = await parseMultipart(req);
    const key = fields.key || "";
    const type = fields.type || "file";
    if (!file || !key) throw new HttpError(400, "Missing file or key");

    const safe = sanitizeFilename(file.filename);
    const encName = `${Date.now()}-enc-${safe}.enc`;
    const encrypted = encryptBuffer(file.buffer, key);

    return sendJson(res, 200, {
      type,
      mode: "encrypt",
      filename: encName,
      dataBase64: encrypted.toString("base64"),
    });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || "File encryption failed";
    return sendJson(res, status, { error: message });
  }
}
