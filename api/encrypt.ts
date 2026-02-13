import type { IncomingMessage, ServerResponse } from "http";
import { encryptBuffer } from "../server/crypto-core";
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
    const out = encryptBuffer(Buffer.from(data, "utf8"), key);
    const base64 = out.toString("base64");
    return sendJson(res, 200, { result: base64 });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || "Encryption failed";
    return sendJson(res, status, { error: message });
  }
}
