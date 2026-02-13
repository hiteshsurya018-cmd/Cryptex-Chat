import type { IncomingMessage, ServerResponse } from "http";
import { sendJson } from "./_utils";

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end();
  }
  const ping = process.env.PING_MESSAGE ?? "ping";
  return sendJson(res, 200, { message: ping });
}
