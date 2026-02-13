import type { IncomingMessage, ServerResponse } from "http";
import {
  SALT_LEN,
  IV_LEN,
  TAG_LEN,
  decryptBuffer,
  randomBytes,
} from "../server/crypto-core";
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

    const cleanOriginal = file.filename.replace(/\.(enc|bin)$/i, "");
    const safeBase = sanitizeFilename(cleanOriginal);
    const decName = `${Date.now()}-dec-${safeBase || "file"}`;

    try {
      const decrypted = decryptBuffer(file.buffer, key);
      return sendJson(res, 200, {
        type,
        mode: "decrypt",
        filename: decName,
        dataBase64: decrypted.toString("base64"),
      });
    } catch {
      const size = Math.max(0, file.buffer.length - (SALT_LEN + IV_LEN + TAG_LEN));
      const garbled = randomBytes(size || 64);
      return sendJson(res, 200, {
        type,
        mode: "decrypt",
        filename: decName,
        dataBase64: garbled.toString("base64"),
      });
    }
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || "File decryption failed";
    return sendJson(res, status, { error: message });
  }
}
