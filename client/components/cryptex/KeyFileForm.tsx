import React, { useState } from "react";

export type MediaType = "text" | "image" | "video" | "audio";

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
  onStatus?: (msg: string) => void;
  onResult: (content: React.ReactNode) => void;
  onError?: (err: string) => void;
}) {
  const [key, setKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!key) {
      onError?.("Please enter a secret key.");
      return;
    }
    try {
      setLoading(true);
      if (type === "text") {
        if (!textData || !textData.trim()) {
          onError?.(
            "Please include text to process, e.g. 'Encrypt this text: hello world'.",
          );
          return;
        }
        onStatus?.(
          mode === "encrypt" ? "Preparing your input..." : "Validating key...",
        );
        await new Promise((r) => setTimeout(r, 500));
        onStatus?.(
          mode === "encrypt" ? "Encrypting with AES-256..." : "Decrypting...",
        );
        const res = await fetch(
          `/${mode === "encrypt" ? "encrypt" : "decrypt"}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "text", mode, data: textData, key }),
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
        onStatus?.(
          mode === "encrypt"
            ? "Here is your encrypted output."
            : "Here is your decrypted result.",
        );
        onResult(
          <div className="break-all">
            {mode === "encrypt" ? (
              <>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Encrypted (Base64)
                </div>
                <code className="text-[hsl(var(--primary))]">
                  {json.result}
                </code>
              </>
            ) : (
              <>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Decrypted Text
                </div>
                <span>{json.result}</span>
              </>
            )}
          </div>,
        );
      } else {
        if (!file) {
          onError?.("Please choose a file to upload.");
          return;
        }
        onStatus?.(
          mode === "encrypt" ? "Preparing your input..." : "Validating key...",
        );
        await new Promise((r) => setTimeout(r, 500));
        onStatus?.(
          mode === "encrypt" ? "Encrypting with AES-256..." : "Decrypting...",
        );
        const fd = new FormData();
        fd.set("type", type);
        fd.set("mode", mode);
        fd.set("key", key);
        fd.set("file", file);
        const endpoint = `/${mode === "encrypt" ? "encrypt-file" : "decrypt-file"}`;
        const res = await fetch(endpoint, { method: "POST", body: fd });
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
        onStatus?.(
          mode === "encrypt"
            ? "Here is your encrypted output."
            : "Here is your decrypted result.",
        );
        onResult(
          <div>
            <div className="text-xs uppercase tracking-wider text-gray-600 mb-2">
              Processed {type}
            </div>
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
          </div>,
        );
      }
    } catch (err: any) {
      const msg = String(err?.message || "Something went wrong");
      if (/413|LIMIT_FILE_SIZE/i.test(msg)) {
        onError?.("File too large. Please use files up to 50MB.");
      } else {
        onError?.(
          msg.includes("not supported")
            ? "This file type may be blocked by your browser. Try selecting again or use a .bin/.enc for decrypt."
            : msg,
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      {type !== "text" && (
        <div className="grid gap-1">
          <label className="text-xs text-gray-600">Upload {type} file</label>
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
                      : "*/*"
            }
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="file:mr-4 file:rounded-md file:border-0 file:bg-[hsl(var(--primary))] file:text-white file:px-3 file:py-2 file:hover:bg-[hsl(var(--primary))]/90 file:transition-colors text-sm"
          />
        </div>
      )}
      <div className="grid gap-1">
        <label className="text-xs text-gray-600">Secret Key</label>
        <input
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="w-full rounded-lg bg-gray-50 border border-gray-200 focus:border-[hsl(var(--primary))] focus:bg-blue-50 outline-none px-3 py-2 text-sm text-gray-800 transition-all"
          placeholder="Enter your secret key"
        />
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
    </form>
  );
}
