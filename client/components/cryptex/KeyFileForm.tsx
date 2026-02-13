import React, { useState } from "react";

export type MediaType = "text" | "image" | "video" | "audio" | "file";

export default function KeyFileForm({
  mode,
  type,
  textData,
  onStatus,
  onResult,
  onError,
}: {
  mode: "encrypt" | "decrypt";
  type: MediaType;
  textData?: string;
  onStatus?: (msg: { text: string; variant?: "step" | "success" | "error" }) => void;
  onResult: (content: React.ReactNode) => void;
  onError?: (err: string) => void;
}) {
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [extractInfo, setExtractInfo] = useState<{
    chars: number;
    truncated: boolean;
  } | null>(null);

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      onStatus?.({ text: "Copied to clipboard.", variant: "success" });
    } catch {
      onError?.("Copy failed. Please copy manually.");
    }
  }

  function downloadBase64(dataBase64: string, filename: string) {
    const binary = atob(dataBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "download.bin";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function getKeyStrength(value: string) {
    const lengthScore = value.length >= 12 ? 2 : value.length >= 8 ? 1 : 0;
    const hasLower = /[a-z]/.test(value);
    const hasUpper = /[A-Z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSymbol = /[^A-Za-z0-9]/.test(value);
    const variety = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean)
      .length;
    const varietyScore = variety >= 3 ? 2 : variety === 2 ? 1 : 0;
    const total = lengthScore + varietyScore;
    if (value.length === 0) {
      return { label: "Enter a key", level: "none" as const };
    }
    if (total <= 1) return { label: "Weak", level: "weak" as const };
    if (total === 2) return { label: "Fair", level: "fair" as const };
    if (total === 3) return { label: "Good", level: "good" as const };
    return { label: "Strong", level: "strong" as const };
  }

  async function processTextPayload(textValue: string) {
    if (!textValue || !textValue.trim()) {
      onError?.(
        "Please include text to process, e.g. 'Encrypt this text: hello world'.",
      );
      return;
    }
    onStatus?.({
      text: mode === "encrypt" ? "Preparing your input..." : "Validating key...",
      variant: "step",
    });
    await new Promise((r) => setTimeout(r, 500));
    onStatus?.({
      text: mode === "encrypt" ? "Encrypting with AES-256..." : "Decrypting...",
      variant: "step",
    });
    const res = await fetch(
      `/api/${mode === "encrypt" ? "encrypt" : "decrypt"}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text", mode, data: textValue, key }),
      },
    );
    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const t = await res.clone().text();
        const e = JSON.parse(t);
        if (e?.error) msg = e.error;
      } catch {}
      throw new Error(msg);
    }
    const json = await res.json();
    onStatus?.({
      text:
        mode === "encrypt"
          ? "Here is your encrypted output."
          : "Here is your decrypted result.",
      variant: "success",
    });
    onResult(
      <div className="break-all">
        {mode === "encrypt" ? (
          <>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Encrypted (Base64)
            </div>
            <div className="flex items-start gap-2">
              <code className="text-[hsl(var(--primary))] break-all">
                {json.result}
              </code>
              <button
                type="button"
                onClick={() => copyText(json.result)}
                className="text-xs px-2 py-1 rounded-md bg-blue-50 text-[hsl(var(--primary))] hover:bg-blue-100"
              >
                Copy
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Decrypted Text
            </div>
            <div className="flex items-start gap-2">
              <span className="break-all">{json.result}</span>
              <button
                type="button"
                onClick={() => copyText(json.result)}
                className="text-xs px-2 py-1 rounded-md bg-blue-50 text-[hsl(var(--primary))] hover:bg-blue-100"
              >
                Copy
              </button>
            </div>
          </>
        )}
      </div>,
    );
  }

  function uploadWithProgress(url: string, formData: FormData) {
    return new Promise<any>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      xhr.responseType = "json";
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
        else {
          const msg =
            (xhr.response && (xhr.response as any).error) ||
            `Request failed (${xhr.status})`;
          reject(new Error(msg));
        }
      };
      xhr.onerror = () => reject(new Error("Network error"));
      xhr.send(formData);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key) {
      onError?.("Please enter a secret key.");
      return;
    }
    try {
      setLoading(true);
      if (type === "text") {
        await processTextPayload(textData || "");
      } else {
        if (!file) {
          onError?.("Please choose a file to upload.");
          return;
        }
        onStatus?.({
          text: mode === "encrypt" ? "Preparing your input..." : "Validating key...",
          variant: "step",
        });
        await new Promise((r) => setTimeout(r, 500));
        onStatus?.({
          text: mode === "encrypt" ? "Encrypting with AES-256..." : "Decrypting...",
          variant: "step",
        });
        const fd = new FormData();
        fd.set("type", type);
        fd.set("mode", mode);
        fd.set("key", key);
        fd.set("file", file);
        const endpoint = `/api/${mode === "encrypt" ? "encrypt-file" : "decrypt-file"}`;
        setUploadProgress(0);
        const json = await uploadWithProgress(endpoint, fd);
        onStatus?.({
          text:
            mode === "encrypt"
              ? "Here is your encrypted output."
              : "Here is your decrypted result.",
          variant: "success",
        });
        onResult(
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-600 mb-2">
              Processed {type === "file" ? "document" : type}
            </div>
            {json.downloadUrl ? (
              <a
                href={json.downloadUrl}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors"
                download
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>Download File</span>
              </a>
            ) : json.dataBase64 ? (
              <button
                type="button"
                onClick={() =>
                  downloadBase64(
                    json.dataBase64,
                    json.filename || "download.bin",
                  )
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors"
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-white"
                >
                  <path
                    d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <span>Download File</span>
              </button>
            ) : (
              <div className="text-xs text-muted-foreground">
                No downloadable file returned.
              </div>
            )}
          </div>,
        );
      }
    } catch (err: any) {
      const msg = String(err?.message || "Something went wrong");
      if (/413|LIMIT_FILE_SIZE/i.test(msg)) {
        onError?.("File too large. Please use a smaller file.");
      } else {
        onError?.(
          msg.includes("not supported")
            ? "This file type may be blocked by your browser. Try selecting again or use a .bin/.enc for decrypt."
            : msg,
        );
      }
    } finally {
      setLoading(false);
      setUploadProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {type !== "text" && (
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">
            Upload {type === "file" ? "document" : type} file
          </label>
          <input
            type="file"
            accept={
              mode === "decrypt"
                ? ".bin,.enc,*/*"
                : type === "image"
                  ? "image/*,*/*"
                  : type === "video"
                    ? "video/*,*/*"
                    : type === "audio"
                      ? "audio/*,*/*"
                      : ".pdf,.doc,.docx,.txt,*/*"
            }
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="file:mr-4 file:rounded-md file:border-0 file:bg-[hsl(var(--primary))] file:text-white file:px-3 file:py-2 file:hover:bg-[hsl(var(--primary))]/90 file:transition-colors text-sm"
          />
          {file && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Selected: {file.name} ({formatBytes(file.size)})
              </span>
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setExtractedText(null);
                  setExtractInfo(null);
                }}
                className="text-[hsl(var(--primary))] hover:underline"
              >
                Clear
              </button>
            </div>
          )}
          {mode === "encrypt" && type === "file" && file && (
            <div className="grid gap-2">
              <button
                type="button"
                disabled={extracting}
                onClick={async () => {
                  if (!key) {
                    onError?.("Please enter a secret key.");
                    return;
                  }
                  setExtracting(true);
                  setExtractedText(null);
                  setExtractInfo(null);
                  try {
                    const fd = new FormData();
                    fd.set("file", file);
                    const res = await fetch("/api/extract-text", {
                      method: "POST",
                      body: fd,
                    });
                    if (!res.ok) {
                      let msg = `Request failed (${res.status})`;
                      try {
                        const t = await res.clone().text();
                        const e = JSON.parse(t);
                        if (e?.error) msg = e.error;
                      } catch {}
                      throw new Error(msg);
                    }
                    const json = await res.json();
                    setExtractedText(String(json.text || ""));
                    setExtractInfo({
                      chars: Number(json.chars || 0),
                      truncated: Boolean(json.truncated),
                    });
                    onStatus?.({
                      text: "Text extracted from document.",
                      variant: "success",
                    });
                  } catch (err: any) {
                    onError?.(String(err?.message || "Extraction failed"));
                  } finally {
                    setExtracting(false);
                  }
                }}
                className="justify-self-start inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-[hsl(var(--primary))] hover:bg-blue-100 transition-colors disabled:opacity-60"
              >
                {extracting ? "Extracting..." : "Extract Text (PDF/DOCX/TXT)"}
              </button>
              {extractedText && (
                <div className="rounded-lg border border-border bg-card p-3 text-xs text-foreground">
                  <div className="flex items-center justify-between mb-2">
                    <span className="uppercase tracking-wider text-muted-foreground">
                      Extracted Preview
                    </span>
                    {extractInfo && (
                      <span className="text-muted-foreground">
                        {extractInfo.chars} chars
                        {extractInfo.truncated ? " (truncated)" : ""}
                      </span>
                    )}
                  </div>
                  <div className="max-h-28 overflow-auto whitespace-pre-wrap">
                    {extractedText.slice(0, 600)}
                    {extractedText.length > 600 ? "..." : ""}
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => processTextPayload(extractedText)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors"
                    >
                      Encrypt Extracted Text
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <div className="grid gap-1">
        <label className="text-xs text-muted-foreground">Secret Key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          aria-label="Secret key"
          className="w-full rounded-lg bg-secondary border border-border focus:border-[hsl(var(--primary))] focus:bg-[hsl(var(--primary))]/10 outline-none px-3 py-2 text-sm text-foreground transition-all"
          placeholder="Enter your secret key"
        />
        {(() => {
          const strength = getKeyStrength(key);
          if (strength.level === "none") return null;
          const color =
            strength.level === "weak"
              ? "text-rose-600"
              : strength.level === "fair"
                ? "text-amber-600"
                : strength.level === "good"
                  ? "text-emerald-600"
                  : "text-emerald-700";
          const note =
            strength.level === "weak"
              ? "Use 12+ chars and mix letters, numbers, symbols."
              : strength.level === "fair"
                ? "Consider adding more length or symbols."
                : "Looks good.";
          return (
            <div className="text-xs text-muted-foreground">
              <span className={`font-semibold ${color}`}>
                {strength.label}
              </span>
              <span className="ml-2">{note}</span>
            </div>
          );
        })()}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="justify-self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-white hover:bg-[hsl(var(--primary))]/90 transition-colors disabled:opacity-60"
      >
        <span>
          {loading
            ? mode === "encrypt"
              ? "Encrypting..."
              : "Decrypting..."
            : mode === "encrypt"
              ? "Encrypt"
              : "Decrypt"}
        </span>
      </button>
      {uploadProgress !== null && (
        <div className="grid gap-1">
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-[hsl(var(--primary))] transition-all"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Uploading: {uploadProgress}%
          </div>
        </div>
      )}
    </form>
  );
}
