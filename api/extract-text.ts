import type { IncomingMessage, ServerResponse } from "http";
import path from "path";
import { HttpError, parseMultipart, sendJson } from "./_utils";

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

    const { file } = await parseMultipart(req);
    if (!file) throw new HttpError(400, "Missing file");

    const original = file.filename.toLowerCase();
    const ext = path.extname(original);
    let text = "";

    if (ext === ".pdf" || file.mime === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default as any;
      const data = await pdfParse(file.buffer);
      text = String(data?.text || "");
    } else if (
      ext === ".docx" ||
      file.mime ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = (await import("mammoth")).default as any;
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = String(result?.value || "");
    } else if (ext === ".txt" || file.mime === "text/plain") {
      text = file.buffer.toString("utf8");
    } else {
      throw new HttpError(415, "Unsupported document type. Use PDF, DOCX, or TXT.");
    }

    const maxChars = 200_000;
    const truncated = text.length > maxChars;
    if (truncated) text = text.slice(0, maxChars);

    return sendJson(res, 200, { text, chars: text.length, truncated });
  } catch (err: any) {
    const status = err?.status || 500;
    const message = err?.message || "Text extraction failed";
    return sendJson(res, status, { error: message });
  }
}
