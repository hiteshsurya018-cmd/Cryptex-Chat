import type { IncomingMessage, ServerResponse } from "http";
import { decryptBuffer } from "../server/crypto-core";
import { HttpError, readJsonBody, sendJson } from "./_utils";

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
    const body = await readJsonBody<{ data?: string; key?: string }>(req);
    const { data, key } = body;
    if (!data || !key) throw new HttpError(400, "Missing data or key");
    const payload = Buffer.from(data, "base64");
    const out = decryptBuffer(payload, key);
    return sendJson(res, 200, { result: out.toString("utf8") });
  } catch {
    // Side-channel resistant behavior: always return plausible-looking garbled text
    const chars =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-={}[]|:;<>,.?/";
    let out = "";
    const length = 64;
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return sendJson(res, 200, { result: out });
  }
}
